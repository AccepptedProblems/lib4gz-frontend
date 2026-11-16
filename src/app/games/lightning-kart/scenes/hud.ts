import Phaser from 'phaser';
import { C } from '../engine/constants';
import { HudState } from '../engine/race';
import { DEPTH } from './depth';
import { formatTime, label, slant } from './widgets';

const UI = C.ui;
const FX = UI.fx;
const HUD = UI.hud;
const W = UI.stage.w;
const MUTED = Phaser.Display.Color.HexStringToColor(UI.colors.muted).color;

/** Lap and the empty position slot top left, time and best top right under the corner buttons. Nothing is timed here. */
export class Hud {
  private readonly lap: Phaser.GameObjects.Text;
  private readonly time: Phaser.GameObjects.Text;
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(private readonly scene: Phaser.Scene, bestMs: number | undefined) {
    const row = UI.pad + 18; // the corner buttons' centre line
    const underButtons = UI.pad + 36 + 6;
    this.lap = label(scene, UI.pad, row, '', { size: UI.font.hudBig, bold: true, originX: 0 }).setDepth(DEPTH.hud);
    this.time = label(scene, W - UI.pad, underButtons, '', { size: UI.font.hudBig, bold: true, originX: 1, originY: 0 }).setDepth(DEPTH.hud);
    label(scene, W - UI.pad, underButtons + 34, `BEST ${bestMs === undefined ? '–' : formatTime(bestMs)}`, { size: UI.font.hud, bold: true, originX: 1, originY: 0, color: UI.colors.muted }).setDepth(DEPTH.hud);
    this.g = scene.add.graphics().setDepth(DEPTH.hud);
  }

  draw(hud: HudState): void {
    this.lap.setText(`LAP ${hud.lap} / ${hud.laps}`);
    this.time.setText(formatTime(Math.floor(hud.elapsedMs / 100) * 100));
    // The empty position slot after the lap, measured on the label's unscaled width so the lap pop leaves it still.
    const slot = HUD.slot;
    this.g.clear().lineStyle(2, MUTED, slot.alpha).strokePoints(slant(UI.pad + this.lap.width + slot.gap, UI.pad + 18 - slot.h / 2, slot.w, slot.h), true);
  }

  /** The lap label pops when a lap completes; nothing under reduced motion. */
  lapFlip(calm: boolean): void {
    if (calm) return;
    this.lap.setScale(1.4);
    this.scene.tweens.add({ targets: this.lap, scale: 1, duration: FX.lapPopMs, ease: 'Back.easeOut' });
  }
}
