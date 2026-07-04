import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { defer, firstValueFrom, of } from 'rxjs';
import { openDB } from 'idb';
import { CourseCacheService } from './course-cache.service';
import { environment } from '../../environments/environment';
import { CacheResourceType } from '../shared/models';

const COURSE_ID = 'crs_spec';
const LAST_UPDATES_URL = `${environment.apiUrl}/v1/courses/${COURSE_ID}/last-updates`;

function tokens(overrides: Partial<Record<CacheResourceType, number>> = {}) {
  return {
    courseId: COURSE_ID,
    lastUpdates: {
      SYLLABUS: 0,
      LESSON: 0,
      SUMMARY: 0,
      EXERCISE: 0,
      SUBMISSION: 0,
      ...overrides,
    },
  };
}

/** Counts real subscriptions so cache hits are observable. */
function trackedFetch<T>(value: T) {
  let calls = 0;
  const fetch$ = defer(() => {
    calls++;
    return of(value);
  });
  return { fetch$, calls: () => calls };
}

async function eventually(condition: () => Promise<boolean>, timeoutMs = 3000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await condition()) return;
    await new Promise(resolve => setTimeout(resolve, 20));
  }
  throw new Error('eventually(): condition not met within timeout');
}

describe('CourseCacheService', () => {
  let service: CourseCacheService;
  let httpMock: HttpTestingController;

  // Fire-and-forget IndexedDB writes land after the observable completes;
  // tests poll the store instead of racing them.
  async function storeEntries(): Promise<{ count: number; tokenOf: (keyPart: string) => number | undefined }> {
    const db = await openDB(service.dbName, 1);
    // The service may not have opened its DB at all (e.g. pure-fallback paths);
    // then this open created an empty DB with no store — treat as zero entries.
    const all = db.objectStoreNames.contains('responses') ? await db.getAll('responses') : [];
    db.close();
    return {
      count: all.length,
      tokenOf: keyPart => all.find(e => (e.key as string).includes(keyPart))?.token,
    };
  }

  function cachedGet<T>(fetch$: import('rxjs').Observable<T>) {
    return firstValueFrom(
      service.cachedGet({
        courseId: COURSE_ID,
        resourceType: 'LESSON',
        cacheKey: 'lesson:les_1',
        fetch$,
      }),
    );
  }

  beforeEach(() => {
    localStorage.setItem('user_id', 'usr_spec');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CourseCacheService);
    // Unique DB per spec run so IndexedDB state never leaks between tests.
    service.dbName = `lib4gz-cache-spec-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    localStorage.removeItem('user_id');
    httpMock.verify();
  });

  it('cache miss: fetches from network and stores the entry with the server token', async () => {
    const { fetch$, calls } = trackedFetch({ id: 'les_1', title: 'Lesson 1' });

    const result = cachedGet(fetch$);
    httpMock.expectOne(LAST_UPDATES_URL).flush(tokens({ LESSON: 5 }));

    expect(await result).toEqual({ id: 'les_1', title: 'Lesson 1' });
    expect(calls()).toBe(1);
    await eventually(async () => (await storeEntries()).count === 1);
    expect((await storeEntries()).tokenOf('lesson:les_1')).toBe(5);
  });

  it('cache hit: equal token serves from IndexedDB without re-subscribing fetch$', async () => {
    const { fetch$, calls } = trackedFetch({ id: 'les_1' });

    const first = cachedGet(fetch$);
    httpMock.expectOne(LAST_UPDATES_URL).flush(tokens({ LESSON: 5 }));
    await first;
    await eventually(async () => (await storeEntries()).count === 1);

    service.bustFreshness(); // force a fresh last-updates check, same token
    const second = cachedGet(fetch$);
    httpMock.expectOne(LAST_UPDATES_URL).flush(tokens({ LESSON: 5 }));

    expect(await second).toEqual({ id: 'les_1' });
    expect(calls()).toBe(1);
  });

  it('changed token: refetches and overwrites the entry', async () => {
    const { fetch$, calls } = trackedFetch({ id: 'les_1' });

    const first = cachedGet(fetch$);
    httpMock.expectOne(LAST_UPDATES_URL).flush(tokens({ LESSON: 5 }));
    await first;
    await eventually(async () => (await storeEntries()).count === 1);

    service.bustFreshness();
    const second = cachedGet(fetch$);
    httpMock.expectOne(LAST_UPDATES_URL).flush(tokens({ LESSON: 9 }));

    expect(await second).toEqual({ id: 'les_1' });
    expect(calls()).toBe(2);
    await eventually(async () => (await storeEntries()).tokenOf('lesson:les_1') === 9);
  });

  it('freshness memo: two cachedGets within the TTL issue a single last-updates request', async () => {
    const { fetch$, calls } = trackedFetch({ id: 'les_1' });

    const first = cachedGet(fetch$);
    httpMock.expectOne(LAST_UPDATES_URL).flush(tokens({ LESSON: 5 }));
    await first;
    await eventually(async () => (await storeEntries()).count === 1);

    const second = cachedGet(fetch$);
    httpMock.expectNone(LAST_UPDATES_URL);

    expect(await second).toEqual({ id: 'les_1' });
    expect(calls()).toBe(1);
  });

  it('last-updates failure: falls back to the network fetch and stores nothing', async () => {
    const { fetch$, calls } = trackedFetch({ id: 'les_1' });

    const result = cachedGet(fetch$);
    httpMock
      .expectOne(LAST_UPDATES_URL)
      .flush('boom', { status: 500, statusText: 'Server Error' });

    expect(await result).toEqual({ id: 'les_1' });
    expect(calls()).toBe(1);
    // Give any (wrong) write a chance to land, then assert the store stayed empty.
    await new Promise(resolve => setTimeout(resolve, 100));
    expect((await storeEntries()).count).toBe(0);
  });

  it('no user_id: passes fetch$ through untouched, no freshness request, nothing stored', async () => {
    localStorage.removeItem('user_id');
    const { fetch$, calls } = trackedFetch({ id: 'les_1' });

    const result = await cachedGet(fetch$);
    httpMock.expectNone(LAST_UPDATES_URL);

    expect(result).toEqual({ id: 'les_1' });
    expect(calls()).toBe(1);
  });

  it('clearAll: empties the object store', async () => {
    const { fetch$ } = trackedFetch({ id: 'les_1' });

    const first = cachedGet(fetch$);
    httpMock.expectOne(LAST_UPDATES_URL).flush(tokens({ LESSON: 5 }));
    await first;
    await eventually(async () => (await storeEntries()).count === 1);

    await service.clearAll();
    expect((await storeEntries()).count).toBe(0);
  });
});
