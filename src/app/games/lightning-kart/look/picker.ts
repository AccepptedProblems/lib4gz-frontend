import Phaser from 'phaser';
import { RaceAppearance } from '../../../shared/models';
import { C } from '../engine/constants';
import { button } from '../scenes/widgets';
import { CHARACTERS, characterOf, KARTS, kartOf } from './catalogue';
import { drawPortrait, drawRacer } from './draw';
import { racerTop } from './head';

const UI = C.ui;
const GAP = 12;
/** A character chip's portrait: as large as the chip's height allows, 2 px clear above and below. */
export const CHIP_PORTRAIT = UI.chip.h - 4;

type Icon = (id: string, g: Phaser.GameObjects.Graphics) => void;

function row(scene: Phaser.Scene, y: number, entries: { id: string; name: string }[], chosen: string, icon: Icon, onPick: (id: string) => void): Phaser.GameObjects.GameObject[] {
  const left = (UI.stage.w - entries.length * (UI.chip.w + GAP) + GAP) / 2;
  return entries.map((entry, i) => {
    const x = left + UI.chip.w / 2 + i * (UI.chip.w + GAP);
    return button(scene, x, y, entry.name, () => onPick(entry.id), {
      w: UI.chip.w, h: UI.chip.h, size: UI.font.body, selected: entry.id === chosen, icon: g => icon(entry.id, g),
    });
  });
}

/**
 * One chip per character in a row centred on the stage at `y`, the chosen one outlined, each with its
 * portrait in the chosen kart's colour. Returns the chips so the caller can destroy them on
 * the next data change.
 */
export function characterRow(scene: Phaser.Scene, y: number, look: RaceAppearance, onPick: (characterId: string) => void): Phaser.GameObjects.GameObject[] {
  const kart = kartOf(look.kartId);
  return row(scene, y, CHARACTERS, look.characterId, (id, g) => drawPortrait(g, CHIP_PORTRAIT, characterOf(id), kart), onPick);
}

/**
 * One chip per kart in a row centred on the stage at `y`, the chosen one outlined, each seen from behind with the chosen
 * character aboard turned round to show the face, sized so the whole drawing, headgear to shadow, fits the chip's icon
 * square with 2 px to spare at the top and the bottom.
 */
export function kartRow(scene: Phaser.Scene, y: number, look: RaceAppearance, onPick: (kartId: string) => void): Phaser.GameObjects.GameObject[] {
  const character = characterOf(look.characterId);
  const s = (UI.chip.h - 4) / (racerTop(character) + 0.08);
  return row(scene, y, KARTS, look.kartId, (id, g) => drawRacer(g, 0, UI.chip.h / 2 - 2 - 0.08 * s, s, 0, character, kartOf(id), null, 'front'), onPick);
}
