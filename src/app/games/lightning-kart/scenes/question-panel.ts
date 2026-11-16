import Phaser from 'phaser';
import { RaceQuestion } from '../bridge';
import { C, cssHex } from '../engine/constants';
import { Tier } from '../engine/streak';
import { DEPTH } from './depth';
import { reducedMotion } from './motion';
import { fit, label, wrapText } from './widgets';

const UI = C.ui;
const FX = UI.fx;
const CARDS = UI.cards;
const STREAK = UI.streak;
const W = UI.stage.w;
const H = UI.stage.h;
const INK = cssHex(CARDS.ink);
// Layout px. The room right of the bar and the question is the countdown number's; a card's
// caption is inset past the shape and the key.
const PAD_X = 16;
const BOARD_PAD_Y = 8;
const PAD_Y = 10;
const NUMBER_W = 48;
const CORNER = 12;
const CAPTION_LEFT = CORNER + 2 * CARDS.shapeR + 10;
const CAPTION_RIGHT = 30;

export interface OpenQuestion {
  question: RaceQuestion;
  openedMs: number;
  container: Phaser.GameObjects.Container;
  countdown: Phaser.GameObjects.Text;
  bar: Phaser.GameObjects.Graphics;
  barX: number;
  barY: number;
  barW: number;
  /** One per option in reading order, each placed at its card's centre. */
  cards: Phaser.GameObjects.Container[];
  /** The board's top edge, its bottom edge with its shadow, and the top edge of the first card row. */
  boardTop: number;
  boardBottom: number;
  cardsTop: number;
  /** The block's highest edge: the board's, the next-tier tag's on it, or the ring's widest pulse round it. The layout spec reads it; nothing draws from it. */
  top: number;
  /** One right answer short of a tier: the ring round the board that pulses in its colour, and the board's top left and size. */
  ring: { g: Phaser.GameObjects.Graphics; colour: number; x: number; y: number; w: number; h: number } | null;
  /** Answered or timed out, waiting for the verdict: the countdown stands still and a tap answers nothing. */
  locked: boolean;
  /** The "Checking…" tag, once the verdict is slow; it goes with the panel. */
  checking: Phaser.GameObjects.Container | null;
}

/**
 * The question overlay, one block standing on the stage's bottom pad: one card per option,
 * two to a row in reading order (a row of one is centred), and on them, `C.ui.cards.gap`
 * above the first row, a board with the question, the seconds left and a bar that drains on
 * race time. The block grows upward with the text and may cover the kart. One right answer
 * short of a streak tier, a ring round the board pulses in the tier's colour and a tag on
 * its top edge names it. `onAnswer` gets the chosen index, or `null` on a timeout; the outcome is the
 * scene's, which locks the panel until its verdict comes and then closes it.
 */
export class QuestionPanel {
  private open: OpenQuestion | null = null;
  private readonly calm = reducedMotion();

  constructor(private readonly scene: Phaser.Scene, private readonly onAnswer: (index: number | null) => void) {}

  /** The question showing now, or null. */
  get question(): RaceQuestion | null {
    return this.open?.question ?? null;
  }

  /** This showing of the open question, or null: a new one per `show`, gone at `close`. A verdict is for one showing. */
  get showing(): object | null {
    return this.open;
  }

  /** True while the open question waits for its verdict. */
  get locked(): boolean {
    return this.open?.locked ?? false;
  }

  /** Opens `question` at race time `nowMs`; `next` is the streak tier a right answer reaches, if any. */
  show(question: RaceQuestion, nowMs: number, next: Tier | null = null): void {
    const { panelW } = UI.question;
    const { gap, shadow } = CARDS;
    const cx = W / 2;
    const left = cx - panelW / 2;

    // The cards first, standing on the stage's bottom pad: a long option wraps inside its card
    // and both cards in a row take the taller one's height, so the rows grow upward.
    const cardW = (panelW - gap) / 2;
    const captions = question.options.map((option) =>
      fit(wrapText(this.scene, 0, 0, option, cardW - CAPTION_LEFT - CAPTION_RIGHT, { originX: 0, originY: 0, family: UI.read.stack, weight: UI.read.option }).setStroke(INK, CARDS.stroke),
        CARDS.optionSizes, CARDS.optionLines));
    const rows: number[][] = [];
    for (let i = 0; i < captions.length; i += 2) rows.push(captions.slice(i, i + 2).map((_, k) => i + k));
    const rowH = rows.map((row) => Math.max(CARDS.h, ...row.map((i) => Math.ceil(captions[i].height) + 2 * PAD_Y)));
    const cardsTop = H - UI.pad - shadow - rowH.reduce((sum, h) => sum + h + gap, -gap);
    let y = cardsTop;
    const cards = rows.flatMap((row, r) => {
      const h = rowH[r];
      const placed = row.map((i, k) => this.card(i, row.length === 1 ? cx : left + cardW / 2 + k * (cardW + gap), y + h / 2, cardW, h, captions[i]));
      y += h + gap;
      return placed;
    });
    if (!this.calm) {
      cards.forEach((card, i) => {
        card.setScale(CARDS.popFrom);
        this.scene.tweens.add({ targets: card, scale: 1, duration: CARDS.popMs, delay: i * CARDS.popStaggerMs, ease: 'Back.easeOut' });
      });
    }

    // The board on them, its shadow `gap` above the first row, as tall as the question needs.
    const text = fit(wrapText(this.scene, left + PAD_X, 0, question.content, panelW - 2 * PAD_X - NUMBER_W, { originX: 0, originY: 0, color: INK, family: UI.read.stack, weight: UI.read.question }),
      CARDS.questionSizes, CARDS.questionLines);
    const textTop = BOARD_PAD_Y + FX.timerBarH + 6; // under the countdown bar, from the board's top
    const boardH = textTop + text.height + BOARD_PAD_Y;
    const boardTop = cardsTop - gap - shadow - boardH;
    text.setY(boardTop + textTop);
    const board = plate(this.scene.add.graphics(), left, boardTop, panelW, boardH, CARDS.board);
    const bar = this.scene.add.graphics();
    const countdown = label(this.scene, left + panelW - PAD_X, boardTop + boardH / 2, String(C.questionCountdownS), { size: UI.font.hudBig, bold: true, originX: 1, color: INK });

    // The anticipation: the ring under the board, so its outline stays crisp, and an ink tag in
    // the tier's colour standing on the board's top edge, clear of the question's first line.
    let ring: OpenQuestion['ring'] = null;
    const [, thick] = STREAK.nextRing;
    let top = boardTop;
    const tag: Phaser.GameObjects.GameObject[] = [];
    if (next) {
      const colour = STREAK.tiers[next].colour;
      ring = { g: this.scene.add.graphics(), colour, x: left, y: boardTop, w: panelW, h: boardH };
      const caption = label(this.scene, cx, 0, `1 more: ${next.toUpperCase()}`, { size: UI.font.small, bold: true, color: cssHex(colour) });
      const tagW = caption.width + 2 * CORNER;
      const tagH = caption.height + 2;
      const tagTop = boardTop + CARDS.outline - tagH;
      caption.setY(tagTop + tagH / 2);
      tag.push(plate(this.scene.add.graphics(), cx - tagW / 2, tagTop, tagW, tagH, CARDS.ink, tagH / 2), caption);
      top = Math.min(boardTop - STREAK.nextGap - thick, tagTop);
    }
    const container = this.scene.add.container(0, 0, [...(ring ? [ring.g] : []), board, bar, text, countdown, ...tag, ...cards]).setDepth(DEPTH.overlay);
    this.open = {
      question, openedMs: nowMs, container, countdown, bar,
      barX: left + PAD_X, barY: boardTop + BOARD_PAD_Y, barW: panelW - 2 * PAD_X - NUMBER_W,
      cards, boardTop, boardBottom: boardTop + boardH + shadow, cardsTop, top, ring, locked: false, checking: null,
    };
    this.tick(nowMs);
  }

  /** The countdown runs on race time and stops when the panel locks. The bar drains from good to danger; at zero `onAnswer(null)`. */
  tick(nowMs: number): void {
    const open = this.open;
    if (!open) return;
    if (!open.locked) {
      const total = C.questionCountdownS * 1000;
      const left = total - (nowMs - open.openedMs);
      if (left <= 0) {
        this.onAnswer(null);
        return;
      }
      open.countdown.setText(String(Math.ceil(left / 1000)));
      const t = left / total;
      // good → yellow over the first half, yellow → danger over the second: a straight lerp passes through grey.
      const [from, to, k] = t > 0.5 ? [UI.colors.yellow, UI.colors.good, (t - 0.5) * 2] : [UI.colors.danger, UI.colors.yellow, t * 2];
      const colour = Phaser.Display.Color.Interpolate.ColorWithColor(
        Phaser.Display.Color.ValueToColor(from), Phaser.Display.Color.ValueToColor(to), 100, Math.round(k * 100));
      const h = FX.timerBarH;
      const w = open.barW * t;
      open.bar.clear().fillStyle(CARDS.ink, 1).fillRoundedRect(open.barX, open.barY, open.barW, h, h / 2)
        .fillStyle(Phaser.Display.Color.GetColor(colour.r, colour.g, colour.b), 1).fillRoundedRect(open.barX, open.barY, w, h, Math.min(h, w) / 2);
    }

    const ring = open.ring;
    if (ring) {
      const pulse = 0.5 + 0.5 * Math.sin(((nowMs - open.openedMs) / 1000) * STREAK.nextHz * 2 * Math.PI);
      const [thin, thick] = STREAK.nextRing;
      const lw = thin + (thick - thin) * pulse;
      const out = STREAK.nextGap + lw / 2;
      ring.g.clear().lineStyle(lw, ring.colour, 0.5 + 0.5 * pulse)
        .strokeRoundedRect(ring.x - out, ring.y - out, ring.w + 2 * out, ring.h + 2 * out, CARDS.radius + out);
    }
  }

  /**
   * An answer given (`index`) or the time run out (`null`): the countdown stops, the chosen card
   * stays lit and the rest dim, none lifted and none showing the hand. The cards stay
   * interactive, so a tap on one is not taken for a hold of that half of the stage; the scene
   * ignores an answer while locked.
   */
  lock(index: number | null): void {
    const open = this.open;
    if (!open || open.locked) return;
    open.locked = true;
    open.cards.forEach((card, i) => {
      card.setAlpha(i === index ? 1 : CARDS.lockedAlpha).setY(card.getData('restY') as number);
      if (card.input) card.input.cursor = false; // no hand: a tap answers nothing now
    });
    const canvas = this.scene.input.manager.canvas;
    if (canvas) canvas.style.cursor = ''; // a hand shown on the card under the pointer goes too
  }

  /**
   * The verdict is slow: "Checking…" in an ink tag on the board's top edge, right, its alpha
   * pulsing on race time `nowMs` (standing at full under reduced motion). Call every frame
   * while it should show; `close` takes it down with the panel.
   */
  checking(nowMs: number): void {
    const open = this.open;
    if (!open) return;
    if (!open.checking) {
      const caption = label(this.scene, 0, 0, 'Checking…', { size: UI.font.small, bold: true });
      const w = caption.width + 2 * CORNER;
      const h = caption.height + 2;
      const right = W / 2 + UI.question.panelW / 2 - CORNER;
      const top = open.boardTop + CARDS.outline - h;
      caption.setPosition(right - w / 2, top + h / 2);
      open.checking = this.scene.add.container(0, 0, [plate(this.scene.add.graphics(), right - w, top, w, h, CARDS.ink, h / 2), caption]);
      open.container.add(open.checking);
    }
    open.checking.setAlpha(this.calm ? 1 : 0.7 + 0.3 * Math.cos((nowMs / 1000) * CARDS.checkingHz * 2 * Math.PI));
  }

  /** Takes the panel down. */
  close(): void {
    if (this.open) {
      this.scene.tweens.killTweensOf(this.open.cards);
      this.open.container.destroy();
    }
    this.open = null;
  }

  /** Card `i` centred at `x, y`: colour and shape by index, the key number, the caption; a tap answers `i`. */
  private card(i: number, x: number, y: number, w: number, h: number, caption: Phaser.GameObjects.Text): Phaser.GameObjects.Container {
    const g = plate(this.scene.add.graphics(), -w / 2, -h / 2, w, h, CARDS.fill[i]);
    // The shape, the key and the caption's first line share one line at the card's top, whatever the row's height.
    const cornerY = -h / 2 + CARDS.h / 2;
    shape(g, i, -w / 2 + CORNER + CARDS.shapeR, cornerY);
    const key = label(this.scene, w / 2 - CORNER, cornerY, String(i + 1), { size: UI.font.small, bold: true, originX: 1 }).setStroke(INK, CARDS.stroke);
    caption.setPosition(-w / 2 + CAPTION_LEFT, -h / 2 + PAD_Y);
    const card = this.scene.add.container(x, y, [g, caption, key]).setSize(w, h).setInteractive({ useHandCursor: true });
    let pressed = false;
    card.setData('restY', y);
    card.on('pointerover', () => { if (!this.locked) card.setY(y - 2); });
    card.on('pointerout', () => { card.setY(y); pressed = false; });
    card.on('pointerdown', () => { pressed = true; });
    card.on('pointerup', () => {
      if (pressed) this.onAnswer(i);
      pressed = false;
    });
    return card;
  }
}

/** Card `i`'s shape centred at `x, y`: triangle, diamond, circle, square. */
function shape(g: Phaser.GameObjects.Graphics, i: number, x: number, y: number): void {
  const r = CARDS.shapeR;
  g.fillStyle(CARDS.shape, 1);
  if (i === 0) g.fillTriangle(x, y - r, x + r, y + r * 0.8, x - r, y + r * 0.8);
  else if (i === 1) g.fillPoints([{ x, y: y - r }, { x: x + r, y }, { x, y: y + r }, { x: x - r, y }], true);
  else if (i === 2) g.fillCircle(x, y, r * 0.85);
  else g.fillRect(x - r * 0.75, y - r * 0.75, r * 1.5, r * 1.5);
}

/** A rounded plate at `x, y` (top left), `w` by `h`, in `fill`: the hard ink shadow, the fill, the ink outline. */
function plate(g: Phaser.GameObjects.Graphics, x: number, y: number, w: number, h: number, fill: number, radius: number = CARDS.radius): Phaser.GameObjects.Graphics {
  const { outline, shadow } = CARDS;
  return g.fillStyle(CARDS.ink, 1).fillRoundedRect(x + shadow, y + shadow, w, h, radius)
    .fillStyle(fill, 1).fillRoundedRect(x, y, w, h, radius)
    .lineStyle(outline, CARDS.ink, 1).strokeRoundedRect(x, y, w, h, radius);
}
