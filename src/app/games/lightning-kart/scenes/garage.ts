import Phaser from 'phaser';
import { bridgeOf, GameData } from '../bridge';
import { CHARACTERS, characterOf, KARTS, kartOf } from '../catalogue';
import { drawPortrait, drawRacer } from '../draw-racer';
import { C } from '../engine/constants';
import { SCENE } from './keys';
import { button, cornerButton, label, setupStage, wrapText } from './widgets';

const UI = C.ui;

/** Character and kart chips. A tap fires `lookChosen`; the host saves it and the data comes back. */
export class GarageScene extends Phaser.Scene {
  private chips: Phaser.GameObjects.GameObject[] = [];

  constructor() {
    super(SCENE.garage);
  }

  create(): void {
    setupStage(this);
    const bridge = bridgeOf(this);
    label(this, UI.pad, UI.pad + 18, 'GARAGE', { size: UI.font.title * 0.7, bold: true, originX: 0 });
    cornerButton(this, 'Back', () => this.scene.start(SCENE.home));
    label(this, UI.pad, 130, 'Character', { color: UI.colors.muted, originX: 0 });
    label(this, UI.pad, 260, 'Kart', { color: UI.colors.muted, originX: 0 });
    label(this, UI.pad, UI.stage.h - 2 * UI.pad, 'A pick saves at once.', { color: UI.colors.muted, size: UI.font.small, originX: 0 });

    const unsubscribe = bridge.onDataChanged(data => this.render(data));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.render(bridge.data);
  }

  private render(data: GameData): void {
    this.chips.forEach(c => c.destroy());
    this.chips = [];
    const bridge = bridgeOf(this);
    const gap = 12;
    const row = (y: number, entries: { id: string; name: string }[], chosen: string, icon: (id: string, g: Phaser.GameObjects.Graphics) => void, onPick: (id: string) => void): void => {
      entries.forEach((entry, i) => {
        const x = UI.pad + UI.chip.w / 2 + i * (UI.chip.w + gap);
        this.chips.push(
          button(this, x, y, entry.name, () => onPick(entry.id), {
            w: UI.chip.w, h: UI.chip.h, size: UI.font.body, selected: entry.id === chosen, icon: g => icon(entry.id, g),
          })
        );
      });
    };
    const character = characterOf(data.look.characterId);
    const kart = kartOf(data.look.kartId);
    row(180, CHARACTERS, data.look.characterId,
      (id, g) => drawPortrait(g, UI.chip.h - 12, characterOf(id), kart),
      characterId => bridge.intent('lookChosen', { ...data.look, characterId }));
    row(310, KARTS, data.look.kartId,
      (id, g) => drawRacer(g, 0, UI.chip.h / 2 - 8, UI.chip.h - 10, 0, character, kartOf(id)),
      kartId => bridge.intent('lookChosen', { ...data.look, kartId }));
    if (data.lookError) {
      this.chips.push(wrapText(this, UI.pad, 400, data.lookError, UI.stage.w - 2 * UI.pad, { color: UI.colors.danger, originX: 0 }));
    }
  }
}
