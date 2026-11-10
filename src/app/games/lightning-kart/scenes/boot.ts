import Phaser from 'phaser';
import { bridgeOf, GameData } from '../bridge';
import { C } from '../engine/constants';
import { SCENE } from './keys';
import { button, setupStage, wrapText } from './widgets';

const UI = C.ui;

/** "Loading…" until the host has the questions and modules; an error shows with Retry; then Home. */
export class BootScene extends Phaser.Scene {
  constructor() {
    super(SCENE.boot);
  }

  create(): void {
    setupStage(this);
    const bridge = bridgeOf(this);
    const unsubscribe = bridge.onDataChanged(data => this.render(data));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.render(bridge.data);
  }

  private render(data: GameData): void {
    this.children.removeAll(true);
    const cx = UI.stage.w / 2;
    const cy = UI.stage.h / 2;
    if (data.debug) {
      // The debug scenes need no questions, so they open whatever the load says.
      this.scene.start(SCENE.debug, { mode: data.debug, track: data.track ?? 'lap' });
      return;
    }
    if (data.loading) {
      wrapText(this, cx, cy, 'Loading…', UI.stage.w - 2 * UI.pad, { color: UI.colors.muted });
      return;
    }
    if (data.error) {
      wrapText(this, cx, cy - 40, data.error, UI.stage.w - 4 * UI.pad, { color: UI.colors.danger });
      button(this, cx, cy + 40, 'Retry', () => bridgeOf(this).intent('retry'));
      return;
    }
    this.scene.start(SCENE.home);
  }
}
