import Phaser from 'phaser';
import { RaceAppearance } from '../../../shared/models';
import { bridgeOf, GameData } from '../bridge';
import { C, cssHex } from '../engine/constants';
import { characterOf, kartOf } from '../look/catalogue';
import { drawRacer } from '../look/draw';
import { characterRow, kartRow } from '../look/picker';
import { SCENE } from './keys';
import { reducedMotion } from './motion';
import { backdrop, Button, button, cornerButton, fit, label, setupStage, slant, title, wrapText } from './widgets';

const UI = C.ui;
const G = UI.garage;
const CX = UI.stage.w / 2;
const TABS_Y = UI.pad + 20; // level with the title, between it and Back
const GROUND_Y = 366; // the racer's bottom centre, on the stand at the horizon; the tallest headgear clears the tabs
const NAMES_Y = 416;
const CARDS_Y = 460;
const NOTE_Y = 512; // the note, or a failed save in its place

type Tab = 'character' | 'kart';

/**
 * The chosen look large in the middle: the racer facing front on a slanted stand, bobbing
 * gently (still under reduced motion), its names under the stand. The Character and Kart tabs
 * above it, one row of cards for the open tab below. A tap on a card fires `lookChosen`; the
 * host saves it and the data comes back, which redraws the cards and the preview.
 */
export class GarageScene extends Phaser.Scene {
  private tab!: Tab;
  private tabs!: Record<Tab, Button>;
  private chips: Phaser.GameObjects.GameObject[] = [];
  private preview!: { racer: Phaser.GameObjects.Graphics; character: Phaser.GameObjects.Text; kart: Phaser.GameObjects.Text };
  private note!: Phaser.GameObjects.Text;

  constructor() {
    super(SCENE.garage);
  }

  create(): void {
    setupStage(this);
    backdrop(this);
    const bridge = bridgeOf(this);
    this.tab = 'character';
    title(this, UI.pad, UI.pad + 20, 'GARAGE', { originX: 0 });
    cornerButton(this, 'Back', () => this.scene.start(SCENE.home));
    const tab = (x: number, text: string, which: Tab): Button =>
      button(this, x, TABS_Y, text, () => this.open(which), { w: G.tab.w, h: G.tab.h, size: UI.font.body, selected: which === this.tab });
    this.tabs = {
      character: tab(CX - G.tab.w / 2 - 6, 'CHARACTER', 'character'),
      kart: tab(CX + G.tab.w / 2 + 6, 'KART', 'kart'),
    };
    this.preview = this.stand();
    this.note = label(this, CX, NOTE_Y, 'A tap saves at once.', { color: UI.colors.muted, size: UI.font.small });

    const unsubscribe = bridge.onDataChanged(data => this.render(data));
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, unsubscribe);
    this.render(bridge.data);
  }

  /** Opens a tab: its cards replace the other's. */
  private open(tab: Tab): void {
    this.tab = tab;
    this.tabs.character.setSelected(tab === 'character');
    this.tabs.kart.setSelected(tab === 'kart');
    this.render(bridgeOf(this).data);
  }

  /** The stand, the names under it and the racer's Graphics, which bobs: drawn at its full size, never scaled, since a head must not be. */
  private stand(): GarageScene['preview'] {
    // a slab: the lighter top face the kart stands on, the front face under it with the
    // accent stripe, a hard shadow below
    const { w, h, top, face } = G.stand;
    const left = CX - w / 2;
    const front = GROUND_Y + top / 2;
    this.add.graphics()
      .fillStyle(UI.colors.bg, 1).fillPoints(slant(left + 6, front + 6, w, h), true)
      .fillStyle(face, 1).fillPoints(slant(left + UI.button.skew / 2, front - top, w, top), true)
      .fillStyle(UI.colors.panel, 1).fillPoints(slant(left, front, w, h), true)
      .fillStyle(UI.colors[UI.accent.panel], 1).fillPoints(slant(left, front, w, h, UI.button.stripe), true)
      .fillStyle(UI.colors.cyan, 1).fillPoints(slant(left, front, w, 2), true);
    const racer = this.add.graphics().setPosition(CX, GROUND_Y);
    if (!reducedMotion()) {
      this.tweens.add({ targets: racer, y: GROUND_Y - G.bobPx, duration: G.bobMs / 2, ease: 'Sine.easeInOut', yoyo: true, repeat: -1 });
    }
    return {
      racer,
      character: label(this, CX - 8, NAMES_Y, '', { size: UI.font.button, bold: true, originX: 1 }),
      kart: label(this, CX + 8, NAMES_Y, '', { size: UI.font.button, bold: true, color: cssHex(UI.colors.yellow), originX: 0 }),
    };
  }

  private show(look: RaceAppearance): void {
    const character = characterOf(look.characterId);
    const kart = kartOf(look.kartId);
    this.preview.racer.clear();
    drawRacer(this.preview.racer, 0, 0, G.kartW, 0, character, kart, null, 'front'); // posing for the camera: the face
    this.preview.character.setText(character.name.toUpperCase());
    this.preview.kart.setText(kart.name.toUpperCase());
  }

  private render(data: GameData): void {
    this.chips.forEach(c => c.destroy());
    const bridge = bridgeOf(this);
    this.chips = this.tab === 'character'
      ? characterRow(this, CARDS_Y, data.look, characterId => bridge.intent('lookChosen', { ...data.look, characterId }))
      : kartRow(this, CARDS_Y, data.look, kartId => bridge.intent('lookChosen', { ...data.look, kartId }));
    this.show(data.look);
    this.note.setVisible(!data.lookError);
    if (data.lookError) {
      this.chips.push(fit(wrapText(this, CX, NOTE_Y, data.lookError, UI.stage.w - 4 * UI.pad, { color: UI.colors.danger, size: UI.font.small }), [UI.font.small], 2));
    }
  }
}
