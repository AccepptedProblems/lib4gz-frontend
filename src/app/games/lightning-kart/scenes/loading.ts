import Phaser from 'phaser';
import { C } from '../engine/constants';
import { boltPoints } from '../look/bolt';
import { label, panel, slant, title } from './widgets';

const UI = C.ui;
const L = UI.ready.loading;
const W = UI.stage.w;
const H = UI.stage.h;

/**
 * One piece of the work before a race, in words a player understands: `line` shows while its
 * slices run. A slice is either sync work, which freezes the stage while it runs, or returns
 * a promise the loading waits for; that promise must settle, so the step owns its timeout.
 * One that throws or rejects ends the loading with that error. `cancel`, when given, runs
 * whenever the loading stops (done, failed, its scene shut down or the game destroyed), to
 * free what an unfinished step holds; after a finished step it must do nothing. A slice may
 * call the `say` it is given to change the line while it is the one running.
 */
export interface LoadStep {
  line: string;
  slices: ((say: (line: string) => void) => void | Promise<void>)[];
  cancel?: () => void;
}

/**
 * The GET READY panel over the stage, a bar and the line of the step under way, and the
 * slices of `steps` run in order, one per frame from the scene's `update` (`tick`), the first
 * call skipped so the panel is drawn before any work, and the stage shows the bar move
 * between them; after a slice's promise settles, one call is skipped again for the same reason. The bar is the slices done over all of them. The bolt's pulse is its one
 * motion, dropped under reduced motion. `stop` on the scene's shutdown and destroy, which
 * must not touch an object; `destroy` to take the panel off a running scene.
 */
export class Loading {
  private readonly slices: { line: string; run: (say: (line: string) => void) => void | Promise<void> }[];
  private done = 0;
  private skipped = false;
  private waiting = false;
  private stopped = false;
  private readonly box: Phaser.GameObjects.Container;
  private readonly bar: Phaser.GameObjects.Graphics;
  private readonly line: Phaser.GameObjects.Text;
  private readonly pulse: Phaser.Tweens.Tween | null;

  constructor(scene: Phaser.Scene, private readonly steps: LoadStep[], calm: boolean, private readonly failed: (error: unknown) => void) {
    this.slices = steps.flatMap(step => step.slices.map(run => ({ line: step.line, run })));
    const top = (H - L.h) / 2;
    const veil = scene.add.rectangle(W / 2, H / 2, W, H, UI.colors.bg, L.veilAlpha);
    const board = panel(scene, (W - L.w) / 2, top, L.w, L.h);
    const heading = title(scene, W / 2 + L.boltR, top + 50, 'GET READY');
    const bolt = scene.add.graphics({ x: W / 2 - heading.getBounds().width / 2 - L.boltR, y: top + 50 })
      .fillStyle(UI.colors.yellow, 1).fillPoints(boltPoints(0, 0, L.boltR), true);
    this.pulse = calm ? null : scene.tweens.add({ targets: bolt, scale: L.pulse, duration: L.pulseMs, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.bar = scene.add.graphics();
    this.line = label(scene, W / 2, top + L.h - 30, '', { color: UI.colors.muted });
    this.box = scene.add.container(0, 0, [veil, board, heading, bolt, this.bar, this.line]).setDepth(1); // over a leaderboard redrawn under it
    this.draw();
  }

  /** The bar's fill, 0 to 1. */
  get progress(): number {
    return this.done / this.slices.length;
  }

  /** Runs the next slice while no promise is pending, from the second call on. Call from the scene's `update`. */
  tick(): void {
    if (!this.skipped) {
      this.skipped = true;
      return;
    }
    if (this.waiting || this.stopped || this.done === this.slices.length) return;
    let result: void | Promise<void>;
    const at = this.done;
    const say = (line: string): void => { if (!this.stopped && this.done === at) this.line.setText(line); };
    try {
      result = this.slices[at].run(say);
    } catch (error) {
      this.abort(error);
      return;
    }
    if (!result) {
      this.advance();
      return;
    }
    this.waiting = true;
    result.then(() => {
      this.waiting = false;
      if (this.stopped) return;
      this.advance();
      this.skipped = false; // it settled between frames: the next frame draws the bar's move before the next slice
    }, error => this.abort(error));
  }

  /** Runs nothing more, cancels the steps once and touches no object; a promise still pending is ignored. */
  stop(): void {
    if (this.stopped) return;
    this.stopped = true;
    this.steps.forEach(step => step.cancel?.());
  }

  destroy(): void {
    this.stop();
    this.pulse?.remove();
    this.box.destroy();
  }

  private advance(): void {
    this.done++;
    this.draw();
  }

  private abort(error: unknown): void {
    if (this.stopped) return;
    this.stop();
    this.failed(error);
  }

  private draw(): void {
    const x = (W - L.bar.w) / 2;
    const y = (H - L.h) / 2 + 100;
    this.bar.clear()
      .fillStyle(UI.colors.bg, 1).fillPoints(slant(x, y, L.bar.w, L.bar.h), true)
      .fillStyle(UI.colors.yellow, 1).fillPoints(slant(x, y, L.bar.w, L.bar.h, L.bar.w * this.progress), true);
    this.line.setText(this.slices[Math.min(this.done, this.slices.length - 1)].line);
  }
}
