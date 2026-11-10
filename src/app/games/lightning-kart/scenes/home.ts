import Phaser from 'phaser';
import { bridgeOf } from '../bridge';
import { C } from '../engine/constants';
import { SCENE } from './keys';
import { button, label, setupStage } from './widgets';

const UI = C.ui;

/** Title, Start (to Scope), Garage, and who is racing. */
export class HomeScene extends Phaser.Scene {
  constructor() {
    super(SCENE.home);
  }

  create(): void {
    setupStage(this);
    const data = bridgeOf(this).data;
    const cx = UI.stage.w / 2;

    label(this, cx, 130, 'LIGHTNING KART', { size: UI.font.title, bold: true });
    this.link(cx, 250, 'Start', SCENE.scope);
    this.link(cx, 250 + UI.button.h + UI.pad, 'Garage', SCENE.garage);
    label(this, cx, UI.stage.h - 2 * UI.pad, `racing as ${data.user.name}`, { color: UI.colors.muted, size: UI.font.small });
  }

  /** A button to another scene, greyed while that scene is not registered (step 7 adds them). */
  private link(x: number, y: number, text: string, key: string): void {
    const exists = this.scene.get(key) !== null;
    button(this, x, y, text, () => this.scene.start(key), { disabled: !exists });
  }
}
