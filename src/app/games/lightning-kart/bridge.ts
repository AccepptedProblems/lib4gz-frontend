import Phaser from 'phaser';
import { LeaderboardResponse, RaceAppearance, RaceQuestionResponse } from '../../shared/models';

/**
 * The one seam between Angular and the game. The host owns a Bridge, puts data on it and
 * listens for intents; scenes read `data`, listen for `dataChanged` and fire intents. Nothing
 * here imports Angular or a service, and nothing in a scene reaches past this file.
 */

/** `'course'` for the whole course, otherwise a module id. */
export type RaceScope = 'course' | string;

export interface GameModule {
  id: string;
  title: string;
}

/** What the `finished` intent carries; the host posts it as a race result (step 9). */
export interface FinishedRace {
  scope: RaceScope;
  finishMs: number;
  correctCount: number;
  wrongCount: number;
  seed: number;
}

export interface GameData {
  /** True until the first load has answered. Boot shows "Loading…" while it is. */
  loading: boolean;
  /** The first load failed; the text is for people. Boot shows it with Retry. */
  error: string | null;
  questions: RaceQuestionResponse[];
  modules: GameModule[];
  user: { id: string; name: string };
  look: RaceAppearance;
  /** A failed look save, already reverted; the text is for people. */
  lookError: string | null;
  /** The leaderboard of the chosen scope, null while it loads. */
  leaderboard: LeaderboardResponse | null;
  leaderboardError: string | null;
  /** The last result post failed; the text is for people. Result shows it with Retry. */
  saveError: string | null;
  /** The page's font family, so the stage matches the app. */
  fontFamily: string;
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

export const DATA_CHANGED = 'dataChanged';

/** The key the host stores the bridge under in the game registry. */
export const BRIDGE_KEY = 'bridge';

export class Bridge {
  private readonly emitter = new Phaser.Events.EventEmitter();

  constructor(public data: GameData) {}

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
