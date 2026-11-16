import Phaser from 'phaser';
import { C } from '../engine/constants';

/**
 * For specs only: runs a Phaser game on the spec's clock instead of requestAnimationFrame and
 * the wall clock. `take` waits for the boot, sleeps the game's loop and fakes `Date.now`, which
 * Phaser's tweens read; every wait then steps the game by `stepMs` and moves `Date.now` by as
 * much, so scene clocks, race time and tweens all advance by game time alone. SwiftShader
 * frames and a loaded machine slow a run down but no longer change what a spec sees.
 * Timeouts are in game time. `destroy` runs the game's destroy and gives `Date.now` back.
 *
 * A wait belongs to the game it started on: once that game is destroyed, or another taken,
 * the wait rejects. So a spec that Jasmine abandons on its wall-clock timeout stops at its
 * next wait when `afterEach` destroys its game, instead of stepping the next spec's game.
 */
export class SpecClock {
  private game: Phaser.Game | null = null;
  private time = 0;
  private fakeNow = 0;
  private realNow: (() => number) | null = null;

  /** The longest step the race simulates in one frame. */
  constructor(readonly stepMs = C.maxStepS * 1000) {}

  get taken(): boolean {
    return this.game !== null;
  }

  readonly take = async (game: Phaser.Game): Promise<void> => {
    if (this.game) return;
    const started = Date.now();
    while (!game.isRunning) {
      if (Date.now() - started > 8000) throw new Error('timed out waiting for the game to boot');
      await new Promise(resolve => setTimeout(resolve, 16));
    }
    game.loop.sleep();
    this.game = game;
    this.time = game.loop.now;
    this.realNow = Date.now;
    this.fakeNow = Date.now();
    Date.now = () => this.fakeNow;
  };

  readonly step = async (): Promise<void> => {
    const game = this.current();
    if (game.loop.running) game.loop.sleep(); // in case a focus or visibility change woke it
    this.time += this.stepMs;
    this.fakeNow += this.stepMs;
    if (game.config.renderType === Phaser.HEADLESS) game.headlessStep(this.time, this.stepMs);
    else game.step(this.time, this.stepMs);
    await new Promise(resolve => setTimeout(resolve, 0)); // lets keyboard events and Karma's socket through
    this.current(game);
  };

  readonly until = async (check: () => boolean, what: string, timeoutMs = 8000): Promise<void> => {
    const game = this.current();
    for (let t = 0; !check(); t += this.stepMs) {
      if (t >= timeoutMs) throw new Error(`timed out waiting for ${what}`);
      await this.step();
      this.current(game);
    }
  };

  /** `ms` of game time. */
  readonly play = async (ms: number): Promise<void> => {
    const game = this.current();
    for (let t = 0; t < ms; t += this.stepMs) {
      await this.step();
      this.current(game);
    }
  };

  /** The game taken now; throws when there is none, or when it is not `expected`, the one a wait started on. */
  private current(expected?: Phaser.Game): Phaser.Game {
    if (!this.game || (expected && this.game !== expected)) throw new Error('the spec clock moved on: this wait belongs to a destroyed game');
    return this.game;
  }

  /** Destroys `game`; when it is the game taken, steps once so the destroy runs, and gives `Date.now` back. */
  readonly destroy = async (game: Phaser.Game): Promise<void> => {
    game.destroy(true);
    if (this.game !== game) return; // not the game taken: the one taken keeps its clock
    try {
      await this.step();
    } finally {
      Date.now = this.realNow!;
      this.game = null;
    }
  };
}
