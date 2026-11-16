import Phaser from 'phaser';
import { LeaderboardResponse, RaceAppearance, RaceQuestionResponse, RaceResultResponse } from '../../shared/models';

/**
 * The one seam between Angular and the game. The host owns a Bridge, puts data on it, listens
 * for intents and answers its calls; scenes read `data`, listen for `dataChanged`, fire
 * intents and make calls. Nothing here imports Angular or a service, and nothing in a scene
 * reaches past this file.
 */

/** `'course'` for the whole course, otherwise a module id. */
export type RaceScope = 'course' | string;

export interface GameModule {
  id: string;
  title: string;
}

/** One dealt question as the race shows it: `options` in the dealt order, `seq` its deck position. */
export interface RaceQuestion {
  seq: number;
  content: string;
  options: string[];
}

/** A race the server dealt. The reply also carries a seed; nothing in the game reads it. */
export interface DealtRace {
  raceId: string;
  questions: RaceQuestion[];
}

/** What the `finished` intent carries; the host sends it as the race's finish. */
export interface FinishedRace {
  scope: RaceScope;
  raceId: string;
  /** An integer. */
  finishMs: number;
}

/**
 * A finished race's save, for that race id: the reply, or null when a retry found it already
 * saved. A failed one's `retry` says whether sending it again can help (no reply, a time-out, a
 * server fault), not after the server refused it.
 */
export type RaceSave =
  | { raceId: string; state: 'saving' }
  | { raceId: string; state: 'saved'; result: RaceResultResponse | null }
  | { raceId: string; state: 'failed'; error: string; retry: boolean };

export interface GameData {
  /** True until the first load has answered. Boot shows "Loading…" while it is. */
  loading: boolean;
  /** The first load failed; the text is for people. Boot shows it with Retry. */
  error: string | null;
  /** The bank, for Scope's counts only: a student's carry no options and no key. */
  questions: RaceQuestionResponse[];
  modules: GameModule[];
  user: { id: string; name: string };
  look: RaceAppearance;
  /** A failed look save, already reverted; the text is for people. */
  lookError: string | null;
  /** The leaderboard of the chosen scope, null while it loads. */
  leaderboard: LeaderboardResponse | null;
  leaderboardError: string | null;
  /** The last finished race's save; null before any. A failed one's text is for people; Result shows it with Retry. */
  save: RaceSave | null;
  /** `?debug=top|mode7` on the race page: Boot opens the Debug scene instead of Home. */
  debug: 'top' | 'mode7' | null;
  /** `?track=lap|test`: which track the Race and Debug scenes use; null means the default. */
  track: 'lap' | 'test' | null;
}

export interface Intents {
  scopeChosen: (scope: RaceScope) => void;
  lookChosen: (look: RaceAppearance) => void;
  finished: (race: FinishedRace) => void;
  retry: () => void;
}

/** What scenes ask the host for and wait on. Each promise settles: the host owns the time limits. */
export interface RaceCalls {
  /** Deals a new race. Rejects with a text for people, also when `C.net.dealMs` pass; `signal` aborts the call. */
  deal(scope: RaceScope, questionCount: number, signal: AbortSignal): Promise<DealtRace>;
  /** One attempt at question `seq`, `choice` null for a timeout. Rejects on any failure, a refusal included. */
  answer(raceId: string, seq: number, choice: number | null): Promise<'right' | 'wrong'>;
}

export const DATA_CHANGED = 'dataChanged';

/** The key the host stores the bridge under in the game registry. */
export const BRIDGE_KEY = 'bridge';

export class Bridge {
  private readonly emitter = new Phaser.Events.EventEmitter();

  constructor(public data: GameData, readonly calls: RaceCalls) {}

  /** Host side: replace part of the data and tell every listening scene. */
  set(patch: Partial<GameData>): void {
    this.data = { ...this.data, ...patch };
    this.emitter.emit(DATA_CHANGED, this.data);
  }

  /** Scene side: fired after every `set`. Unsubscribe on scene shutdown. */
  onDataChanged(handler: (data: GameData) => void): () => void {
    this.emitter.on(DATA_CHANGED, handler);
    return () => this.emitter.off(DATA_CHANGED, handler);
  }

  /** Scene side. */
  intent<K extends keyof Intents>(name: K, ...args: Parameters<Intents[K]>): void {
    this.emitter.emit(name, ...args);
  }

  /** Host side. */
  onIntent<K extends keyof Intents>(name: K, handler: Intents[K]): () => void {
    this.emitter.on(name, handler);
    return () => this.emitter.off(name, handler);
  }

  destroy(): void {
    this.emitter.removeAllListeners();
  }
}

/** Reads the bridge a scene was given through the registry. */
export function bridgeOf(scene: Phaser.Scene): Bridge {
  return scene.registry.get(BRIDGE_KEY) as Bridge;
}
