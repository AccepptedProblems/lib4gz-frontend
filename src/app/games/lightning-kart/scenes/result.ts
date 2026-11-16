import Phaser from 'phaser';
import { RaceResultResponse } from '../../../shared/models';
import { bridgeOf, GameData, RaceSave } from '../bridge';
import { C, cssHex } from '../engine/constants';
import { tierOf } from '../engine/streak';
import { Badge } from './badge';
import { perfectRace, RaceOutcome } from './data';
import { SCENE } from './keys';
import { reducedMotion } from './motion';
import { backdrop, button, fit, formatTime, label, leaderboard, panel, setupStage, slant, title, wrapText } from './widgets';

const UI = C.ui;
const MISSED_SHOWN = UI.question.missedShown;
const BOARD_PAD = 16;
const BOARD_TOP = 104; // under the title; the boards end above the buttons' row
const BOARD_W = 420; // each board's content width; the panel adds BOARD_PAD each side
const LEFT_X = UI.pad;
const RIGHT_X = 500;
const HEADING_Y = BOARD_TOP + BOARD_PAD; // a board's heading centre
const HEADING_GAP = 28; // from the heading centre to the first row's centre
const BOARD_ROWS = 11; // the top ten and the own row below them
const ROWS_TOP = HEADING_Y + HEADING_GAP;
const BOARD_H = BOARD_PAD + HEADING_GAP + (BOARD_ROWS - 0.5) * UI.result.rowH + BOARD_PAD;
const ROW_GAP = 12; // between two missed questions
const MORE_H = 24; // the "and N more" line
const UNSEEN_H = 44; // the two-line note on answers the server counted and the list lacks
const PERFECT = UI.result.perfect;
/** The name of every fireworks object, so a spec can tell none was made. */
export const FIREWORK = 'firework';

/**
 * Finish time, the server's right and wrong counts once the save replies, the best streak and
 * the missed questions on the left board, each with its right option where the save's answer
 * key holds one (a perfect race shows the PERFECT banner there instead, with fireworks), the
 * refreshed leaderboard with the player's row on the right one, Race again and Home. Kept
 * plain: phase 3 rebuilds it for a full room. The Race scene fired `finished`; a failed save
 * shows here with the game's own counts and Retry, which fires it again.
 */
export class ResultScene extends Phaser.Scene {
  private outcome!: RaceOutcome;
  private sheet!: Phaser.GameObjects.Container;
  private counts!: Phaser.GameObjects.Text;
  private left!: Phaser.GameObjects.Container; // the left board and its missed list, redrawn when the key comes
  private missedTop = 0;
  private live: Phaser.GameObjects.GameObject[] = [];
  /** PERFECT by the game's tally, and its fireworks; both go if the server's counts say otherwise. */
  private banner: Phaser.GameObjects.Container | null = null;
  private bursts: { tween: Phaser.Tweens.Tween; g: Phaser.GameObjects.Graphics }[] = [];
  /** The last save of this race seen on the bridge; another race's leaves it be. */
  private save: RaceSave | null = null;

  constructor() {
    super(SCENE.result);
  }

  init(outcome: RaceOutcome): void {
    this.outcome = outcome;
  }

  create(): void {
    setupStage(this);
    backdrop(this);
    const bridge = bridgeOf(this);
    const o = this.outcome;
    const calm = reducedMotion();
    const perfect = perfectRace(o);
    const streak = this.bestStreakLine(LEFT_X, HEADING_Y);
    // Where the board is free under the streak line, if there is one.
    const freeTop = streak.length ? HEADING_Y + UI.result.streakRowH / 2 : BOARD_TOP;
    // A perfect race has nothing missed, and PERFECT says so: the banner takes the free board.
    this.missedTop = streak.length ? HEADING_Y + UI.result.streakRowH : HEADING_Y;
    const bannerY = freeTop + PERFECT.bannerAt * (BOARD_TOP + BOARD_H - freeTop);
    const banner = this.banner = perfect ? this.perfectBanner(LEFT_X + BOARD_W / 2, bannerY) : null;
    this.bursts = [];
    this.save = null;
    this.counts = label(this, UI.stage.w - UI.pad, UI.pad + 20, '', { color: UI.colors.muted, originX: 1 });
    this.left = this.add.container(0, 0);
    const sheet = this.sheet = this.add.container(0, 0, [
      title(this, UI.pad, UI.pad + 20, `FINISHED  ${formatTime(o.finishMs)}`, { originX: 0 }),
      this.counts,
      this.left,
      ...streak,
      ...(banner ? [banner] : []),
      panel(this, RIGHT_X - BOARD_PAD, BOARD_TOP, BOARD_W + 2 * BOARD_PAD, BOARD_H),
      label(this, RIGHT_X, HEADING_Y, 'Best times', { color: UI.colors.muted, originX: 0, size: UI.font.small }),
      button(this, UI.stage.w / 2 - UI.button.w / 2 - UI.pad / 2, UI.stage.h - UI.pad - UI.button.h / 2, 'RACE AGAIN', () => this.raceAgain()),
      button(this, UI.stage.w / 2 + UI.button.w / 2 + UI.pad / 2, UI.stage.h - UI.pad - UI.button.h / 2, 'HOME', () => this.goHome()),
    ]);
    // The result slides in from below, then the banner pops and the fireworks go off. Reduced
    // motion keeps the banner still and has no fireworks.
    if (!calm) {
      sheet.setY(UI.stage.h);
      this.tweens.add({ targets: sheet, y: 0, duration: UI.fx.resultSlideMs, ease: 'Cubic.easeOut' });
      if (banner) {
        banner.setScale(PERFECT.popFrom).setAlpha(0);
        this.tweens.add({ targets: banner, scale: 1, alpha: 1, delay: UI.fx.resultSlideMs, duration: PERFECT.popMs, ease: 'Back.easeOut' });
        this.fireworks(banner, freeTop, UI.fx.resultSlideMs + PERFECT.popMs / 2);
      }
    }

    const unsubscribe = bridge.onDataChanged(data => this.render(data));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.render(bridge.data);
  }

  /** Through Ready's loading, which deals a new race: one race per attempt. */
  raceAgain(): void {
    this.scene.start(SCENE.ready, { ...this.outcome.choice, again: true });
  }

  goHome(): void {
    this.scene.start(SCENE.home);
  }

  /** Fires `finished` again after a failed save. The race itself is not replayed. */
  retrySave(): void {
    const o = this.outcome;
    bridgeOf(this).intent('finished', { scope: o.choice.scope, raceId: o.raceId, finishMs: o.finishMs });
  }

  /**
   * "Best streak" and the race's badge for it, centred on `y`, or nothing below the first
   * tier: a badge needs a tier, and "×0" or "×1" is no streak.
   */
  private bestStreakLine(x: number, y: number): Phaser.GameObjects.GameObject[] {
    const best = this.outcome.bestStreak;
    const tier = tierOf(best);
    if (!tier) return [];
    const caption = label(this, x, y, 'Best streak', { color: UI.colors.muted, originX: 0, size: UI.font.small });
    const badge = new Badge(this);
    badge.show(0, 0, UI.result.streakKartW, best, tier, 0); // measures it
    badge.show(x + caption.width + 12 + badge.width / 2, y + badge.height / 2, UI.result.streakKartW, best, tier, 0);
    return [caption, ...badge.objects];
  }

  /** PERFECT on a slanted sunset band with a hard shadow, centred on `x, y`. */
  private perfectBanner(x: number, y: number): Phaser.GameObjects.Container {
    const { w, h, bands, stripe, shadow } = PERFECT;
    const g = this.add.graphics().fillStyle(UI.colors.bg, 1).fillPoints(slant(-w / 2 + shadow, -h / 2 + shadow, w, h), true);
    // The kit's slant cut into bands top to bottom, magenta to orange like the sky. Bands meet
    // edge to edge: an overlap shows as stripes while the banner fades in.
    const skew = UI.button.skew;
    const left = (by: number): number => -w / 2 + skew / 2 - (skew * (by + h / 2)) / h;
    const from = Phaser.Display.Color.ValueToColor(PERFECT.from);
    const to = Phaser.Display.Color.ValueToColor(PERFECT.to);
    for (let i = 0; i < bands; i++) {
      const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, bands - 1, i);
      const y0 = -h / 2 + (i * h) / bands;
      const y1 = y0 + h / bands;
      g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1)
        .fillPoints([{ x: left(y0), y: y0 }, { x: left(y0) + w, y: y0 }, { x: left(y1) + w, y: y1 }, { x: left(y1), y: y1 }], true);
    }
    g.fillStyle(UI.colors.yellow, 1).fillPoints(slant(-w / 2, -h / 2, w, h, stripe), true);
    const word = label(this, stripe / 2, 0, 'PERFECT', { size: PERFECT.size, bold: true }).setStroke(cssHex(UI.colors.bg), PERFECT.stroke);
    return this.add.container(x, y, [g, word]);
  }

  /**
   * `bursts` bursts of sparks over the left board, above `banner` and under it in the sheet so
   * the word stays readable, and never reaching above `top`, where the streak line ends. The
   * first goes off `startMs` from now, once the sheet is in place. Each burst is one Graphics
   * redrawn by its own tween and destroyed when it ends, so nothing keeps running on a Result
   * left open.
   */
  private fireworks(banner: Phaser.GameObjects.Container, top: number, startMs: number): void {
    const cream = Phaser.Display.Color.HexStringToColor(UI.colors.text).color;
    for (let b = 0; b < PERFECT.bursts; b++) {
      // Spread across the board and alternating sides, so no two bursts in a row sit together.
      const x = LEFT_X + (BOARD_W * (((b * 3) % PERFECT.bursts) + 0.5)) / PERFECT.bursts;
      const [low, high] = PERFECT.rise;
      const y = Math.max(top + PERFECT.burstR, banner.y - low - Math.random() * (high - low)); // a spark flies at most burstR up
      const sparks = Array.from({ length: PERFECT.sparks }, (_, i) => {
        const a = ((i + Math.random() * 0.5) / PERFECT.sparks) * 2 * Math.PI;
        const r = PERFECT.burstR * (0.6 + 0.4 * Math.random());
        return { dx: r * Math.cos(a), dy: r * Math.sin(a), colour: i % 2 ? cream : PERFECT.colours[b % PERFECT.colours.length] };
      });
      const g = this.add.graphics().setName(FIREWORK);
      this.sheet.addAt(g, this.sheet.getIndex(banner));
      const flight = { t: 0 };
      // Flung out fast and slowing, falling more and more, fading only toward the end.
      const at = (dx: number, dy: number, t: number): [number, number] => {
        const out = Phaser.Math.Easing.Cubic.Out(t);
        return [x + dx * out, y + dy * out + PERFECT.fall * t * t];
      };
      const tween = this.tweens.add({
        targets: flight, t: 1, delay: startMs + b * PERFECT.burstGapMs, duration: PERFECT.sparkMs,
        onUpdate: () => {
          const t = flight.t;
          g.clear();
          for (const s of sparks) {
            const [x0, y0] = at(s.dx, s.dy, Math.max(0, t - PERFECT.trail));
            const [x1, y1] = at(s.dx, s.dy, t);
            g.lineStyle(PERFECT.sparkW, s.colour, 1 - t ** 3).lineBetween(x0, y0, x1, y1);
          }
        },
        onComplete: () => g.destroy(),
      });
      this.bursts.push({ tween, g });
    }
  }

  /** The server's counts say the race was not perfect: PERFECT and its fireworks go. The fanfare has played. */
  private dropBanner(): void {
    this.bursts.forEach(({ tween, g }) => { tween.remove(); g.destroy(); });
    this.bursts = [];
    if (this.banner) this.tweens.killTweensOf(this.banner);
    this.banner?.destroy();
    this.banner = null;
  }

  /**
   * The heading at `top` and the first `missedShown` missed questions under it, each with its
   * right option when `key` (the save's answer key) has an entry for it; the server fills only
   * the first questions it judged wrong, null elsewhere. Then, when the server counted `unseen`
   * more wrong answers than the list holds, a line that says why; `bottom` is where the list ends.
   */
  private missedList(x: number, top: number, key: (number | null)[] | null, unseen: number): { objects: Phaser.GameObjects.GameObject[]; bottom: number } {
    const objects: Phaser.GameObjects.GameObject[] = [];
    const missed = this.outcome.missed;
    if (missed.length === 0 && unseen === 0) {
      objects.push(label(this, x, top, 'Nothing missed. Clean run.', { color: UI.colors.good, originX: 0, size: UI.font.small }));
      return { objects, bottom: top + HEADING_GAP };
    }
    objects.push(label(this, x, top, 'Missed', { color: UI.colors.muted, originX: 0, size: UI.font.small }));
    let y = top + HEADING_GAP - UI.result.rowH / 2;
    // At most `missedShown` questions, and the board, "and N more" included, ends 8 px over the
    // buttons: a long question costs a slot. Cut to the panel's line counts, even the first,
    // which always shows, stays clear.
    const limit = UI.stage.h - UI.pad - UI.button.h - 8 - BOARD_PAD - MORE_H - ROW_GAP - (unseen ? UNSEEN_H : 0);
    let shown = 0;
    for (const q of missed.slice(0, MISSED_SHOWN)) {
      const text = fit(wrapText(this, x, y, q.content, BOARD_W, { originX: 0, originY: 0, size: UI.font.small }), [UI.font.small], UI.cards.questionLines);
      const entry = key?.[q.seq]; // null or missing: no right option for this question
      const right = entry === null || entry === undefined ? undefined : q.options[entry];
      const answer = right === undefined ? null
        : fit(wrapText(this, x, y + text.height + 2, `→ ${right}`, BOARD_W, { originX: 0, originY: 0, size: UI.font.small, color: UI.colors.good }), [UI.font.small], UI.cards.optionLines);
      const h = text.height + (answer?.height ?? 0);
      if (shown > 0 && y + h > limit) {
        text.destroy();
        answer?.destroy();
        break;
      }
      objects.push(text, ...(answer ? [answer] : []));
      y += h + ROW_GAP;
      shown++;
    }
    if (missed.length > shown) {
      objects.push(label(this, x, y + 8, `and ${missed.length - shown} more`, { color: UI.colors.muted, originX: 0, size: UI.font.small }));
      y += MORE_H;
    }
    if (unseen) {
      const why = `${unseen === 1 ? 'One answer' : `${unseen} answers`} reached the server after your screen moved on. The server's count is the one that is saved.`;
      const line = fit(wrapText(this, x, y + 4, why, BOARD_W, { originX: 0, originY: 0, size: UI.font.small, color: UI.colors.muted }), [UI.font.small], 2);
      objects.push(line);
      y += 4 + line.height;
    }
    return { objects, bottom: y };
  }

  /**
   * The save of this race and the board redraw on every data change: the counts (saving, the
   * server's, or the game's own after a failed save or a retry that found it saved), the left
   * board with the answer key once it is in, and the board or the failed save with Retry.
   */
  private render(data: GameData): void {
    const o = this.outcome;
    if (data.save?.raceId === o.raceId) this.save = data.save;
    const save = this.save;
    const result: RaceResultResponse | null = save?.state === 'saved' ? save.result : null;
    const own = `${o.correctCount} right, ${o.wrongCount} wrong`;
    this.counts.setText(result ? `${result.correctCount} right, ${result.wrongCount} wrong`
      : save?.state === 'saved' ? `${own} · saved` : save?.state === 'failed' ? own : 'Saving your time…');

    // Once the save is in, the server's counts decide PERFECT, and say how many wrong answers the list lacks.
    if (result && this.banner && !perfectRace(result)) this.dropBanner();
    const unseen = result ? Math.max(0, result.wrongCount - o.missed.length) : 0;
    this.left.removeAll(true);
    const missed = this.banner ? { objects: [], bottom: BOARD_TOP } : this.missedList(LEFT_X, this.missedTop, result?.answerKey ?? null, unseen);
    this.left.add([panel(this, LEFT_X - BOARD_PAD, BOARD_TOP, BOARD_W + 2 * BOARD_PAD, Math.max(BOARD_H, missed.bottom - BOARD_TOP + BOARD_PAD)), ...missed.objects]);

    this.live.forEach(obj => obj.destroy());
    this.live = [];
    if (save?.state === 'failed') {
      // Retry only where sending the finish again can help; a refusal would fail the same way.
      const error = fit(wrapText(this, RIGHT_X, ROWS_TOP - UI.result.rowH / 2, save.error, BOARD_W, { color: UI.colors.danger, originX: 0, originY: 0 }), UI.result.note.sizes, UI.result.note.lines);
      this.live.push(error);
      if (save.retry) this.live.push(button(this, RIGHT_X + 60, error.y + error.height + 32, 'RETRY', () => this.retrySave(), { w: 120, h: 40, size: UI.font.small }));
      this.sheet.add(this.live);
      return;
    }
    this.live = leaderboard(this, data, RIGHT_X, ROWS_TOP, BOARD_W, UI.result.rowH);
    this.sheet.add(this.live);
  }
}
