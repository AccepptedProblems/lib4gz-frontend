import Phaser from 'phaser';
import { bridgeOf, GameData } from '../bridge';
import { C } from '../engine/constants';
import { RaceOutcome } from './data';
import { SCENE } from './keys';
import { reducedMotion } from './motion';
import { button, formatTime, label, leaderboard, setupStage, wrapText } from './widgets';

const UI = C.ui;
const MISSED_SHOWN = UI.question.missedShown;

/**
 * Finish time, right and wrong counts, the missed questions with their correct option, the
 * refreshed leaderboard with the player's row, Race again and Home. The Race scene fired
 * `finished`; a failed save shows here with Retry, which fires it again.
 */
export class ResultScene extends Phaser.Scene {
  private outcome!: RaceOutcome;
  private sheet!: Phaser.GameObjects.Container;
  private live: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE.result);
  }

  init(outcome: RaceOutcome): void {
    this.outcome = outcome;
  }

  create(): void {
    setupStage(this);
    const bridge = bridgeOf(this);
    const o = this.outcome;
    const left = UI.pad;
    const sheet = this.sheet = this.add.container(0, 0, [
      label(this, left, UI.pad + 22, `FINISHED  ${formatTime(o.finishMs)}`, { size: UI.font.title * 0.8, bold: true, originX: 0 }),
      label(this, left, UI.pad + 60, `${o.correctCount} right, ${o.wrongCount} wrong`, { color: UI.colors.muted, originX: 0 }),
      ...this.missedList(left, 130),
      label(this, 500, 130, 'Best times', { color: UI.colors.muted, originX: 0, size: UI.font.small }),
      button(this, UI.stage.w / 2 - UI.button.w / 2 - UI.pad / 2, UI.stage.h - UI.pad - UI.button.h / 2, 'Race again', () => this.raceAgain()),
      button(this, UI.stage.w / 2 + UI.button.w / 2 + UI.pad / 2, UI.stage.h - UI.pad - UI.button.h / 2, 'Home', () => this.goHome()),
    ]);
    // The result slides in from below.
    if (!reducedMotion()) {
      sheet.setY(UI.stage.h);
      this.tweens.add({ targets: sheet, y: 0, duration: UI.fx.resultSlideMs, ease: 'Cubic.easeOut' });
    }

    const unsubscribe = bridge.onDataChanged(data => this.render(data));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.render(bridge.data);
  }

  raceAgain(): void {
    this.scene.start(SCENE.race, this.outcome.choice);
  }

  goHome(): void {
    this.scene.start(SCENE.home);
  }

  /** Fires `finished` again after a failed save. The race itself is not replayed. */
  retrySave(): void {
    const o = this.outcome;
    bridgeOf(this).intent('finished', { scope: o.choice.scope, finishMs: o.finishMs, correctCount: o.correctCount, wrongCount: o.wrongCount, seed: o.seed });
  }

  private missedList(x: number, top: number): Phaser.GameObjects.GameObject[] {
    const out: Phaser.GameObjects.GameObject[] = [];
    const missed = this.outcome.missed;
    if (missed.length === 0) {
      out.push(label(this, x, top, 'Nothing missed. Clean run.', { color: UI.colors.good, originX: 0, size: UI.font.small }));
      return out;
    }
    out.push(label(this, x, top, 'Missed', { color: UI.colors.muted, originX: 0, size: UI.font.small }));
    let y = top + 28;
    missed.slice(0, MISSED_SHOWN).forEach(q => {
      const text = wrapText(this, x, y, q.content, 420, { originX: 0, originY: 0, size: UI.font.small });
      const answer = wrapText(this, x, y + text.height + 2, `→ ${q.options[q.correctIndex]}`, 420, { originX: 0, originY: 0, size: UI.font.small, color: UI.colors.good });
      out.push(text, answer);
      y += text.height + answer.height + 12;
    });
    if (missed.length > MISSED_SHOWN) out.push(label(this, x, y, `and ${missed.length - MISSED_SHOWN} more`, { color: UI.colors.muted, originX: 0, size: UI.font.small }));
    return out;
  }

  /** The board and the save state redraw on every data change. */
  private render(data: GameData): void {
    this.live.forEach(o => o.destroy());
    this.live = [];
    if (data.saveError) {
      this.live.push(wrapText(this, 500, 160, data.saveError, 420, { color: UI.colors.danger, originX: 0, originY: 0, size: UI.font.small }));
      this.live.push(button(this, 560, 230, 'Retry', () => this.retrySave(), { w: 120, h: 40, size: UI.font.small }));
      this.sheet.add(this.live);
      return;
    }
    this.live = leaderboard(this, data, 500, 165, 420, 26);
    this.sheet.add(this.live);
  }
}
