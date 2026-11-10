import Phaser from 'phaser';
import { LeaderboardRow, RaceAppearance } from '../../../shared/models';
import { bridgeOf, GameData } from '../bridge';
import { characterOf, kartOf } from '../catalogue';
import { drawPortrait } from '../draw-racer';
import { C } from '../engine/constants';

const UI = C.ui;

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

function fontOf(scene: Phaser.Scene): string {
  return bridgeOf(scene).data.fontFamily || 'sans-serif';
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
      fontFamily: fontOf(scene),
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
  /** Draws an icon at the left end; the caption moves right to make room. */
  icon?: (g: Phaser.GameObjects.Graphics) => void;
  /** A lettered badge at the left end, for answer options. */
  badge?: string;
  /** Caption at the left, after the icon or badge, instead of centred. */
  alignLeft?: boolean;
}

/**
 * A pointer-only button: hover lights it, a press and release on it calls `onTap`. Disabled
 * buttons are grey and ignore the pointer. No keyboard handling by design.
 */
export function button(scene: Phaser.Scene, x: number, y: number, text: string, onTap: () => void, opts: ButtonOptions = {}): Button {
  const w = opts.w ?? UI.button.w;
  const h = opts.h ?? UI.button.h;
  const bg = scene.add.graphics();
  const caption = label(scene, 0, 0, text, { size: opts.size ?? UI.font.button, bold: true });
  const container = scene.add.container(x, y, [bg, caption]) as Button;
  if (opts.icon || opts.badge) {
    const icon = scene.add.graphics();
    icon.setPosition(-w / 2 + h / 2, 0);
    if (opts.icon) opts.icon(icon);
    if (opts.badge) {
      icon.fillStyle(UI.fx.line, 0.22).fillCircle(0, 0, h / 2 - 8);
      container.add(label(scene, -w / 2 + h / 2, 0, opts.badge, { size: (opts.size ?? UI.font.button) * 0.9, bold: true }));
    }
    container.add(icon);
    container.sendToBack(icon);
    container.sendToBack(bg);
    caption.setX(h / 2 - 4);
  }
  if (opts.alignLeft) caption.setOrigin(0, 0.5).setX(-w / 2 + (opts.icon || opts.badge ? h : 16));
  let disabled = false;
  let selected = opts.selected ?? false;
  let hovered = false;
  let pressed = false;

  const paint = (): void => {
    const fill = disabled ? UI.colors.buttonDisabled : hovered ? UI.colors.buttonHover : UI.colors.button;
    bg.clear().fillStyle(fill, 1).fillRoundedRect(-w / 2, -h / 2, w, h, UI.button.radius);
    if (selected) bg.lineStyle(3, UI.fx.line, 1).strokeRoundedRect(-w / 2, -h / 2, w, h, UI.button.radius);
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
    disabled = value;
    hovered = false;
    pressed = false;
    if (value) container.disableInteractive(); else container.setInteractive({ useHandCursor: true });
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
 * row highlighted, their own best below the ten when outside them. Returns what it drew so
 * the scene can destroy it on the next data change.
 */
export function leaderboard(scene: Phaser.Scene, data: GameData, x: number, top: number, width: number, rowH = 30): Phaser.GameObjects.GameObject[] {
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
    if (mine) out.push(scene.add.graphics().fillStyle(UI.colors.button, 0.35).fillRoundedRect(x - 8, y - rowH / 2, width + 16, rowH, 6));
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

/** A small "Back"-style button in the top right corner. */
export function cornerButton(scene: Phaser.Scene, text: string, onTap: () => void, slot = 0): Button {
  const w = 96;
  const h = 36;
  return button(scene, UI.stage.w - UI.pad - w / 2 - slot * (w + 8), UI.pad + h / 2, text, onTap, { w, h, size: UI.font.small });
}
