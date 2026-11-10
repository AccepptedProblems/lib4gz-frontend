import Phaser from 'phaser';
import { bridgeOf, GameData } from '../bridge';
import { C } from '../engine/constants';
import { ScopeChoice } from './data';
import { SCENE } from './keys';
import { button, cornerButton, label, leaderboard, setupStage } from './widgets';

const UI = C.ui;

/** The scope's leaderboard and Start. */
export class ReadyScene extends Phaser.Scene {
  private choice!: ScopeChoice;
  private table: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE.ready);
  }

  init(choice: ScopeChoice): void {
    this.choice = choice;
  }

  create(): void {
    setupStage(this);
    const bridge = bridgeOf(this);
    label(this, UI.pad, UI.pad + 18, this.choice.name.toUpperCase(), { size: UI.font.title * 0.7, bold: true, originX: 0 });
    cornerButton(this, 'Back', () => this.scene.start(SCENE.home));
    cornerButton(this, 'Scope', () => this.scene.start(SCENE.scope), 1);
    button(this, UI.stage.w / 2, UI.stage.h - UI.pad - UI.button.h / 2, 'Start', () => this.startRace());

    const unsubscribe = bridge.onDataChanged(data => this.render(data));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.render(bridge.data);
  }

  startRace(): void {
    this.scene.start(SCENE.race, this.choice);
  }

  private render(data: GameData): void {
    this.table.forEach(o => o.destroy());
    this.table = leaderboard(this, data, UI.pad, 100, 640);
  }
}
