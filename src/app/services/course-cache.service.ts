import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, catchError, from, map, of, shareReplay, switchMap, tap } from 'rxjs';
import { IDBPDatabase, openDB } from 'idb';
import { environment } from '../../environments/environment';
import { CacheResourceType, LastUpdatesResponse } from '../shared/models';

/**
 * IndexedDB response cache validated by server freshness tokens.
 *
 * Flow per `cachedGet`: fetch the course's freshness tokens (one tiny
 * `last-updates` call, memoized for FRESHNESS_TTL_MS so rapid tab switches make
 * zero requests), look the entry up in IndexedDB, and serve it only when its
 * stored token strictly equals the server token — otherwise hit the network and
 * overwrite the entry.
 *
 * Invariants:
 * - Tokens are opaque server-issued values compared by `===` against previously
 *   stored server tokens. The client clock never meets a server timestamp, so
 *   clock skew cannot cause staleness. (The TTL memo below is the only place a
 *   client clock appears, and it compares client-time to client-time.)
 * - Race safety: tokens are fetched *before* data, so a mutation landing in
 *   between stores a token *older* than the cached data. The only possible error
 *   direction is one unnecessary refetch later — never serving stale data.
 * - The cache can never break the app: any freshness/IndexedDB failure degrades
 *   to a plain network fetch, and writes are fire-and-forget.
 */

const DB_NAME = 'lib4gz-cache';
// Cache-schema version. Bump whenever any cached payload shape changes; the
// upgrade handler drops and recreates the store, so a version bump is a
// whole-cache eviction on deploy. That is the eviction strategy — no LRU.
const DB_VERSION = 1;
const STORE = 'responses';
const FRESHNESS_TTL_MS = 30_000;

export interface CacheEntry<T = unknown> {
  /** `${userId}:${courseId}:${resourceType}:${cacheKey}` */
  key: string;
  userId: string;
  courseId: string;
  resourceType: CacheResourceType;
  /** Server lastUpdate observed at fetch time (0 = "never bumped"). */
  token: number;
  data: T;
  /** Client time — diagnostics only, never used for freshness decisions. */
  cachedAt: number;
}

interface FreshnessMemo {
  fetchedAt: number;
  tokens$: Observable<Record<CacheResourceType, number>>;
}

@Injectable({ providedIn: 'root' })
export class CourseCacheService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /** Overridable so specs can isolate each run in its own database. */
  dbName = DB_NAME;

  private db?: Promise<IDBPDatabase>;
  private readonly freshness = new Map<string, FreshnessMemo>();

  /**
   * Serve `fetch$` through the cache. Callers that pass no usable identity
   * (no `user_id` in localStorage — e.g. sessions from before this shipped)
   * get the untouched network observable.
   */
  cachedGet<T>(opts: {
    courseId: string;
    resourceType: CacheResourceType;
    cacheKey: string;
    fetch$: Observable<T>;
  }): Observable<T> {
    const userId = this.readUserId();
    if (!userId) {
      return opts.fetch$;
    }

    const key = `${userId}:${opts.courseId}:${opts.resourceType}:${opts.cacheKey}`;

    return this.getTokens(opts.courseId).pipe(
      switchMap(tokens => {
        const serverToken = tokens[opts.resourceType] ?? 0;
        return from(this.read(key)).pipe(map(entry => ({ entry, serverToken })));
      }),
      // Freshness or IndexedDB failure: fall through to a plain network fetch.
      // serverToken null marks "freshness unknown" so we don't store a bogus token.
      catchError(() => of({ entry: undefined as CacheEntry | undefined, serverToken: null as number | null })),
      switchMap(({ entry, serverToken }) => {
        if (entry && serverToken !== null && entry.token === serverToken) {
          return of(entry.data as T);
        }
        return opts.fetch$.pipe(
          tap(data => {
            if (serverToken === null) return;
            void this.write({
              key,
              userId,
              courseId: opts.courseId,
              resourceType: opts.resourceType,
              token: serverToken,
              data,
              cachedAt: Date.now(),
            }).catch(() => {
              // Write failure is only a future cache miss.
            });
          }),
        );
      }),
    );
  }

  /**
   * Forget the in-memory freshness memo (all courses). Called after own
   * mutations: the backend token is already new (bumped in the same
   * transaction), so the next cachedGet re-checks and refetches.
   */
  bustFreshness(): void {
    this.freshness.clear();
  }

  /** Wipe every cached response (logout — shared-machine privacy). Never throws. */
  async clearAll(): Promise<void> {
    this.bustFreshness();
    try {
      const db = await this.openDb();
      await db.clear(STORE);
    } catch {
      // IndexedDB unavailable — nothing was cached anyway.
    }
  }

  private getTokens(courseId: string): Observable<Record<CacheResourceType, number>> {
    const now = Date.now();
    const memo = this.freshness.get(courseId);
    if (memo && now - memo.fetchedAt < FRESHNESS_TTL_MS) {
      return memo.tokens$;
    }
    const tokens$ = this.http
      .get<LastUpdatesResponse>(`${this.apiUrl}/v1/courses/${courseId}/last-updates`)
      .pipe(
        map(response => response.lastUpdates),
        // Drop a failed check from the memo so the next call retries instead
        // of replaying the error for the whole TTL window.
        tap({ error: () => this.freshness.delete(courseId) }),
        shareReplay(1),
      );
    this.freshness.set(courseId, { fetchedAt: now, tokens$ });
    return tokens$;
  }

  private readUserId(): string | null {
    try {
      return localStorage.getItem('user_id');
    } catch {
      return null;
    }
  }

  private openDb(): Promise<IDBPDatabase> {
    this.db ??= openDB(this.dbName, DB_VERSION, {
      upgrade(db) {
        for (const name of Array.from(db.objectStoreNames)) {
          db.deleteObjectStore(name);
        }
        db.createObjectStore(STORE, { keyPath: 'key' });
      },
    });
    return this.db;
  }

  private async read(key: string): Promise<CacheEntry | undefined> {
    const db = await this.openDb();
    return db.get(STORE, key);
  }

  private async write(entry: CacheEntry): Promise<void> {
    const db = await this.openDb();
    try {
      await db.put(STORE, entry);
    } catch (e) {
      if ((e as DOMException | null)?.name === 'QuotaExceededError') {
        // Quota pressure: dropping the whole store only costs cache misses.
        await db.clear(STORE);
      }
    }
  }
}
