import Phaser from 'phaser';
import { LeaderboardRow, RaceAppearance } from '../../../shared/models';
import { GameData } from '../bridge';
import { characterOf, kartOf } from '../look/catalogue';
import { drawPortrait } from '../look/draw';
import { C } from '../engine/constants';

const UI = C.ui;
const ACCENT = {
  button: UI.colors[UI.accent.button],
  panel: UI.colors[UI.accent.panel],
  title: UI.colors[UI.accent.title],
  selected: UI.colors[UI.accent.selected],
  mine: UI.colors[UI.accent.mine],
};

/**
 * Stage units are 960 by 540. The canvas is that times the pixel ratio, so the camera zooms
 * by the ratio and every scene calls this first. Returns the ratio for text resolution.
 */
export function setupStage(scene: Phaser.Scene): number {
  const ratio = stageScale(scene);
  scene.cameras.main.setZoom(ratio).centerOn(UI.stage.w / 2, UI.stage.h / 2);
  scene.cameras.main.setBackgroundColor(UI.colors.bg);
  return ratio;
}

export function stageScale(scene: Phaser.Scene): number {
  return scene.scale.gameSize.width / UI.stage.w;
}

type Point = { x: number; y: number };

/**
 * The corners of a parallelogram over the rectangle at `x, y` (top left) of `w` by `h`: the
 * top edge is pushed right and the bottom edge left by half of `C.ui.button.skew`, so every
 * button and panel leans the same way. `stripe` keeps only that many px at the left end.
 */
export function slant(x: number, y: number, w: number, h: number, stripe = w): Point[] {
  const s = UI.button.skew / 2;
  return [{ x: x + s, y }, { x: x + s + stripe, y }, { x: x - s + stripe, y: y + h }, { x: x - s, y: y + h }];
}

export interface LabelOptions {
  size?: number;
  color?: string;
  /** 0 left, 0.5 centre, 1 right. Default 0.5. */
  originX?: number;
  originY?: number;
  bold?: boolean;
}

export function label(scene: Phaser.Scene, x: number, y: number, text: string, opts: LabelOptions = {}): Phaser.GameObjects.Text {
  return scene.add
    .text(x, y, text, {
      fontFamily: UI.font.stack,
      fontSize: `${opts.size ?? UI.font.body}px`,
      fontStyle: opts.bold ? 'bold' : 'normal',
      color: opts.color ?? UI.colors.text,
      resolution: stageScale(scene),
    })
    .setOrigin(opts.originX ?? 0.5, opts.originY ?? 0.5);
}

/** A label that wraps at `width` stage units. */
export function wrapText(scene: Phaser.Scene, x: number, y: number, text: string, width: number, opts: LabelOptions = {}): Phaser.GameObjects.Text {
  return label(scene, x, y, text, opts).setWordWrapWidth(width, true).setAlign(opts.originX === 0 ? 'left' : 'center');
}

/**
 * Gives `text` the first of `sizes` at which it wraps to `maxLines` lines or fewer; past the
 * last size it keeps `maxLines` lines and ends the last with an ellipsis. The server has no
 * length limit, and this keeps the question panel and the Result's missed list from growing off the stage.
 */
export function fit(text: Phaser.GameObjects.Text, sizes: readonly number[], maxLines: number): Phaser.GameObjects.Text {
  for (const size of sizes) {
    text.setFontSize(size);
    if (text.getWrappedText().length <= maxLines) return text;
  }
  const lines = text.getWrappedText().slice(0, maxLines);
  let last = lines.pop()!.trimEnd();
  const cut = (): Phaser.GameObjects.Text => text.setText([...lines, `${last}…`].join('\n'));
  cut();
  while (text.getWrappedText().length > maxLines && last) {
    last = last.slice(0, -1).trimEnd();
    cut();
  }
  return text;
}

export interface TitleOptions {
  size?: number;
  /** 0 left, 0.5 centre, 1 right. Default 0.5. The accent bar follows the text's start. */
  originX?: number;
  /** A caption wider than this scales the whole title down to fit, for names the scene does not control. */
  maxWidth?: number;
}

/** The screen title: bold, `C.ui.font.title`, with a slanted accent bar under its start. */
export function title(scene: Phaser.Scene, x: number, y: number, text: string, opts: TitleOptions = {}): Phaser.GameObjects.Container {
  const originX = opts.originX ?? 0.5;
  const caption = label(scene, 0, 0, text, { size: opts.size ?? UI.font.title, bold: true, originX });
  const bar = UI.title.bar;
  const left = -originX * caption.width;
  const accent = scene.add.graphics().fillStyle(ACCENT.title, 1).fillPoints(slant(left, caption.height / 2 + bar.gap, bar.w, bar.h), true);
  const container = scene.add.container(x, y, [accent, caption]);
  if (opts.maxWidth && caption.width > opts.maxWidth) container.setScale(opts.maxWidth / caption.width);
  return container;
}

export interface PanelOptions {
  alpha?: number;
}

/** A skewed board in the panel colour with a thin accent stripe along its left edge. `x, y` is the top left. */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, opts: PanelOptions = {}): Phaser.GameObjects.Graphics {
  return scene.add.graphics()
    .fillStyle(UI.colors.panel, opts.alpha ?? UI.panel.alpha).fillPoints(slant(x, y, w, h), true)
    .fillStyle(ACCENT.panel, 1).fillPoints(slant(x, y, w, h, UI.panel.stripe), true);
}

/**
 * The menu backdrop: the sunset gradient down to the horizon, a sun sitting on it, the dusk
 * ground below, and a few slanted stripes in the bottom right corner. One Graphics object.
 * Menu scenes call it right after `setupStage`; the Race scene's shader covers its own stage.
 */
export function backdrop(scene: Phaser.Scene): Phaser.GameObjects.Graphics {
  const { w, h } = UI.stage;
  const { horizon, bands, sunR, sunX, stripeAlpha } = UI.backdrop;
  const horizonY = Math.round(h * horizon);
  const g = scene.add.graphics();
  const stops = UI.colors.sunset.map(c => Phaser.Display.Color.ValueToColor(c));
  const bandH = horizonY / bands;
  for (let i = 0; i < bands; i++) {
    const t = i / (bands - 1);
    const [from, to, local] = t < 0.5 ? [stops[0], stops[1], t * 2] : [stops[1], stops[2], (t - 0.5) * 2];
    const c = Phaser.Display.Color.Interpolate.ColorWithColor(from, to, 100, Math.round(local * 100));
    g.fillStyle(Phaser.Display.Color.GetColor(c.r, c.g, c.b), 1).fillRect(0, i * bandH, w, bandH + 1);
  }
  g.fillStyle(UI.colors.yellow, 1).fillCircle(w * sunX, horizonY - sunR * 0.35, sunR);
  g.fillStyle(UI.colors.bg, 1).fillRect(0, horizonY, w, h - horizonY);
  g.fillStyle(UI.colors.magenta, 0.6).fillRect(0, horizonY, w, 2);
  const stripes = [UI.colors.magenta, UI.colors.cyan, UI.colors.magenta];
  stripes.forEach((colour, i) => {
    const x = w - 140 + i * 36;
    g.fillStyle(colour, stripeAlpha).fillPoints([{ x: x + 60, y: horizonY + 8 }, { x: x + 72, y: horizonY + 8 }, { x: x + 12, y: h }, { x, y: h }], true);
  });
  return g;
}

export interface Button extends Phaser.GameObjects.Container {
  setDisabled(disabled: boolean): Button;
  setSelected(selected: boolean): Button;
  setLabel(text: string): Button;
}

export interface ButtonOptions {
  w?: number;
  h?: number;
  size?: number;
  disabled?: boolean;
  /** Outlined, for the chosen chip in a group. */
  selected?: boolean;
  /** Draws an icon at the left end, after the stripe; the caption moves right to make room. */
  icon?: (g: Phaser.GameObjects.Graphics) => void;
}

/**
 * A pointer-only button, a skewed block with a stripe at its left end: hover lights it, a
 * press and release on it calls `onTap`. Disabled buttons are dim and ignore the pointer.
 * The caption keeps the case it is given. The hit area is the plain rectangle. No keyboard
 * handling by design.
 */
export function button(scene: Phaser.Scene, x: number, y: number, text: string, onTap: () => void, opts: ButtonOptions = {}): Button {
  const w = opts.w ?? UI.button.w;
  const h = opts.h ?? UI.button.h;
  const stripe = UI.button.stripe;
  const bg = scene.add.graphics();
  const caption = label(scene, stripe / 2, 0, text, { size: opts.size ?? UI.font.button, bold: true });
  const container = scene.add.container(x, y, [bg, caption]) as Button;
  if (opts.icon) {
    const icon = scene.add.graphics();
    icon.setPosition(-w / 2 + stripe + h / 2, 0);
    opts.icon(icon);
    container.add(icon);
    container.sendToBack(icon);
    container.sendToBack(bg);
    caption.setX((stripe + h) / 2 - 4);
  }
  let disabled = false;
  let selected = opts.selected ?? false;
  let hovered = false;
  let pressed = false;

  const paint = (): void => {
    const fill = disabled ? UI.colors.buttonDisabled : hovered ? UI.colors.buttonHover : UI.colors.button;
    const body = slant(-w / 2, -h / 2, w, h);
    bg.clear().fillStyle(fill, 1).fillPoints(body, true);
    bg.fillStyle(ACCENT.button, disabled ? 0.35 : 1).fillPoints(slant(-w / 2, -h / 2, w, h, stripe), true);
    if (selected) bg.lineStyle(2, ACCENT.selected, 1).strokePoints(body, true);
    caption.setColor(disabled ? UI.colors.muted : UI.colors.text);
  };

  container.setSize(w, h);
  container.setInteractive({ useHandCursor: true });
  container.on('pointerover', () => { hovered = true; paint(); });
  container.on('pointerout', () => { hovered = false; pressed = false; paint(); });
  container.on('pointerdown', () => { pressed = true; });
  container.on('pointerup', () => {
    const tap = pressed && !disabled;
    pressed = false;
    if (tap) onTap();
  });

  container.setDisabled = (value: boolean) => {
    const under = hovered; // turned off under the pointer it gets no pointerout, so its hand cursor is put back here
    disabled = value;
    hovered = false;
    pressed = false;
    if (value) container.disableInteractive(under); else container.setInteractive({ useHandCursor: true });
    paint();
    return container;
  };
  container.setSelected = (value: boolean) => {
    selected = value;
    paint();
    return container;
  };
  container.setLabel = (value: string) => {
    caption.setText(value);
    return container;
  };

  if (opts.disabled) container.setDisabled(true); else paint();
  return container;
}

/** A round portrait of a racer's look; the catalogue's first pair when the look is null. */
export function portrait(scene: Phaser.Scene, x: number, y: number, look: RaceAppearance | null, size = 24): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics().setPosition(x, y);
  drawPortrait(g, size, characterOf(look?.characterId), kartOf(look?.kartId));
  return g;
}

/**
 * The scope's leaderboard: rank, portrait, name, best time, right count; the caller's own
 * row on a low-alpha skewed block, their own best below the ten when outside them. Rows
 * centre on `top`, `top + rowH`, and so on. Returns what it drew so the scene can destroy it
 * on the next data change.
 */
export function leaderboard(scene: Phaser.Scene, data: GameData, x: number, top: number, width: number, rowH = UI.leaderboard.rowH): Phaser.GameObjects.GameObject[] {
  const out: Phaser.GameObjects.GameObject[] = [];
  if (data.leaderboardError) {
    out.push(wrapText(scene, x, top, data.leaderboardError, width, { color: UI.colors.danger, originX: 0, size: UI.font.small }));
    return out;
  }
  const board = data.leaderboard;
  if (!board) {
    out.push(label(scene, x, top, 'Loading the best times…', { color: UI.colors.muted, originX: 0, size: UI.font.small }));
    return out;
  }
  if (board.rows.length === 0) {
    out.push(label(scene, x, top, 'No finished race here yet. Be the first.', { color: UI.colors.muted, originX: 0, size: UI.font.small }));
    return out;
  }
  const rows: { rank: number | null; row: LeaderboardRow }[] = board.rows.map((row, i) => ({ rank: i + 1, row }));
  if (board.mine && !board.rows.some(r => r.userId === board.mine!.userId)) rows.push({ rank: null, row: board.mine });
  const size = rowH >= 30 ? UI.font.body : UI.font.small;
  rows.forEach(({ rank, row }, i) => {
    const y = top + i * rowH;
    const mine = row.userId === data.user.id;
    if (mine) out.push(scene.add.graphics().fillStyle(ACCENT.mine, UI.leaderboard.mineAlpha).fillPoints(slant(x - 8, y - rowH / 2, width + 16, rowH), true));
    const colour = mine ? UI.colors.text : UI.colors.muted;
    out.push(label(scene, x + 20, y, rank === null ? '–' : String(rank), { color: colour, originX: 1, size }));
    out.push(portrait(scene, x + 50, y, row.appearance, rowH * 0.8));
    out.push(label(scene, x + 80, y, row.name, { originX: 0, size }));
    out.push(label(scene, x + width - 90, y, formatTime(row.finishMs), { originX: 1, size }));
    out.push(label(scene, x + width, y, `${row.correctCount} right`, { color: colour, originX: 1, size: UI.font.small }));
  });
  return out;
}

/** `m:ss.d` */
export function formatTime(ms: number): string {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const tenths = Math.floor((ms % 1000) / 100);
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths}`;
}

/** A small "Back"-style button in the top right corner. Its caption is a command word, so it is upper case. */
export function cornerButton(scene: Phaser.Scene, text: string, onTap: () => void, slot = 0): Button {
  const w = 96;
  const h = 36;
  const b = button(scene, UI.stage.w - UI.pad - w / 2 - slot * (w + 8), UI.pad + h / 2, text.toUpperCase(), onTap, { w, h, size: UI.font.small });
  const setLabel = b.setLabel;
  b.setLabel = value => setLabel(value.toUpperCase());
  return b;
}
