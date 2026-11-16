import { RaceAppearance } from '../../../shared/models';

/**
 * Phase 1 looks, all free. A character and a kart are data: parts and colours that
 * `draw.ts` turns into a racer on the road and a portrait. Ids are stable strings
 * that travel to the server in `raceAppearance`; never rename one.
 */
export interface Character {
  id: string;
  name: string;
  skin: number;
  helmet: number;
  visor: number;
  suit: number;
  /**
   * What sits on the head, in `helmet`'s colour, each its own silhouette: `racing` the open-face
   * helmet with a `visor` stripe, goggles and the antenna; `buns` hair with two buns, a
   * zigzag fringe and a `visor` band; `cap` a cap worn backwards, the hair poking through its
   * adjuster; `crest` a helmet with a `visor` crest, cheek guards and horns. `swim` is
   * Splash's plain hair with swim goggles (`splash.ts`), never a racer's.
   */
  headgear: 'racing' | 'buns' | 'cap' | 'crest' | 'swim';
  /** The hair where it shows apart from the headgear: Pip's tuft. */
  hair?: number;
  /** The lid's slope, the mood: shallow, flat, raised at the outer end, steep. */
  lid: 'confident' | 'calm' | 'cheeky' | 'angry';
  mouth: 'smirk' | 'smile' | 'grin' | 'frown';
  /** Lash ticks at the eyes' outer corners, freckles, or a scar through one lid. */
  mark: 'none' | 'lashes' | 'freckles' | 'scar';
}

export interface Kart {
  id: string;
  name: string;
  shape: 'classic' | 'rocket' | 'tank';
  body: number;
  stripe: number;
  wheel: number;
}

export const CHARACTERS: Character[] = [
  { id: 'chr_bolt', name: 'Bolt', skin: 0xf1c27d, helmet: 0xf5c518, visor: 0x2b6cb0, suit: 0x2b6cb0, headgear: 'racing', lid: 'confident', mouth: 'smirk', mark: 'none' },
  { id: 'chr_nova', name: 'Nova', skin: 0xc68642, helmet: 0x8e44ad, visor: 0xf8f8ff, suit: 0xf8f8ff, headgear: 'buns', lid: 'calm', mouth: 'smile', mark: 'lashes' },
  { id: 'chr_pip', name: 'Pip', skin: 0xffdbac, helmet: 0x2ecc71, visor: 0x1b1b1b, suit: 0xe67e22, headgear: 'cap', hair: 0x8a5a2b, lid: 'cheeky', mouth: 'grin', mark: 'freckles' },
  { id: 'chr_rex', name: 'Rex', skin: 0x8d5524, helmet: 0xc0392b, visor: 0xf5c518, suit: 0x1b1b1b, headgear: 'crest', lid: 'angry', mouth: 'frown', mark: 'scar' },
];

export const KARTS: Kart[] = [
  { id: 'krt_classic', name: 'Classic', shape: 'classic', body: 0xe0303a, stripe: 0xffffff, wheel: 0x222222 },
  { id: 'krt_rocket', name: 'Rocket', shape: 'rocket', body: 0x2f6fed, stripe: 0xf5c518, wheel: 0x222222 },
  { id: 'krt_tank', name: 'Tank', shape: 'tank', body: 0x3c8d40, stripe: 0x2a2a2a, wheel: 0x3a3a3a },
];

/** What a person races as before they choose: the first of each. */
export const DEFAULT_APPEARANCE: RaceAppearance = { characterId: CHARACTERS[0].id, kartId: KARTS[0].id };

/** The character for an id, the first one for an unknown or missing id. */
export function characterOf(id: string | undefined | null): Character {
  return CHARACTERS.find(c => c.id === id) ?? CHARACTERS[0];
}

export function kartOf(id: string | undefined | null): Kart {
  return KARTS.find(k => k.id === id) ?? KARTS[0];
}
