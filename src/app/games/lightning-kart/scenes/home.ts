import Phaser from 'phaser';
import { bridgeOf, GameData } from '../bridge';
import { C } from '../engine/constants';
import { characterOf, kartOf } from '../look/catalogue';
import { drawRacer } from '../look/draw';
import { SCENE } from './keys';
import { backdrop, button, label, setupStage, title } from './widgets';

const UI = C.ui;
const LEFT_X = 260; // the title and the buttons, left of the racer
const RACER_X = 700;
const GROUND_Y = 450; // the racer's bottom centre, on the ground
const HINT_Y = 492;
// The tap zone: the tallest racer (Rex's crest, 1.81 kart widths) down to the hint's bottom.
const ZONE = { x: RACER_X - 130, y: 130, w: 260, h: HINT_Y + 24 - 130 };

/** Title, Start (to Scope) and How to Play on the left; the player's racer on the right, a tap on it opens the Garage. */
export class HomeScene extends Phaser.Scene {
  private racer!: Phaser.GameObjects.Graphics;

  constructor() {
    super(SCENE.home);
  }

  create(): void {
    setupStage(this);
    backdrop(this);
    const bridge = bridgeOf(this);

    title(this, LEFT_X, 170, 'LIGHTNING KART', { size: UI.font.title * 1.6, maxWidth: 2 * (LEFT_X - UI.pad) });
    this.link(LEFT_X, 396, 'START', SCENE.scope);
    this.link(LEFT_X, 396 + UI.button.h + 16, 'HOW TO PLAY', SCENE.howToPlay);
    label(this, LEFT_X, UI.stage.h - UI.pad, `racing as ${bridge.data.user.name}`, { color: UI.colors.muted, size: UI.font.small });

    // drawn at full size in its own Graphics, never a scaled container, since a head must not be
    this.racer = this.add.graphics().setPosition(RACER_X, GROUND_Y);
    label(this, RACER_X, HINT_Y, 'tap to change');
    const driver = this.add.zone(ZONE.x, ZONE.y, ZONE.w, ZONE.h).setOrigin(0).setInteractive({ useHandCursor: true });
    let pressed = false;
    driver.on('pointerdown', () => { pressed = true; });
    driver.on('pointerout', () => { pressed = false; });
    driver.on('pointerup', () => {
      if (pressed) this.scene.start(SCENE.garage);
      pressed = false;
    });

    const unsubscribe = bridge.onDataChanged(data => this.show(data));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.show(bridge.data);
  }

  private show(data: GameData): void {
    this.racer.clear();
    drawRacer(this.racer, 0, 0, UI.home.kartW, 0, characterOf(data.look.characterId), kartOf(data.look.kartId), null, 'front');
  }

  /** A button to another scene, greyed while that scene is not registered. */
  private link(x: number, y: number, text: string, key: string): void {
    const exists = this.scene.get(key) !== null;
    button(this, x, y, text, () => this.scene.start(key), { disabled: !exists });
  }
}
