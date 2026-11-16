import Phaser from 'phaser';
import { C } from '../engine/constants';
import { Character } from './catalogue';

type Graphics = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

/** Ink for every outline; white for eye whites, teeth and gloves; the dark inside of a mouth or a pipe; the horns' bone. */
export const INK = 0x15121c;
export const WHITE = 0xffffff;
export const MOUTH = 0x2a262e;
const HORN = 0xf3e6c4; // bone, so the horns read as horns and not as more of the crest

/**
 * The behind view's head, from the back or the front: its centre above the bottom centre and its half width, in kart
 * widths, and how far it slides across per unit of lean. The streak badge puts itself where
 * the head is from these.
 */
export const HEAD_Y = 1.08;
export const HEAD_R = 0.3;
export const HEAD_SLIDE = 0.1;

/** `colour` with every channel scaled by `factor` and clamped, so a kart's shades come from its one body colour. */
export function shade(colour: number, factor: number): number {
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * factor)));
  return (c((colour >> 16) & 0xff) << 16) | (c((colour >> 8) & 0xff) << 8) | c(colour & 0xff);
}

type Kind = Character['headgear'];
type Dome = { hw: number; top: number; bottom: number; square: number };

/**
 * Each headgear's dome over the top of the head, in head half-widths about the head's centre:
 * half its width, its top, its lower edge (the brim), and how square its shoulders are (2 a
 * half ellipse, higher squarer).
 */
const DOMES: Record<Kind, Dome> = {
  racing: { hw: 1.3, top: -1.56, bottom: -0.3, square: 2.3 },
  buns: { hw: 1.2, top: -1.3, bottom: -0.5, square: 3 },
  cap: { hw: 1.17, top: -1.16, bottom: -0.38, square: 2.6 },
  crest: { hw: 1.24, top: -1.38, bottom: -0.32, square: 3 },
  swim: { hw: 1.22, top: -1.3, bottom: -0.3, square: 3.2 },
};

/** The dome of `character`'s headgear on the head centred at `cx`, `cy` of half width `r`: the upper half of a superellipse standing on its brim, one outline for the fill and the stroke. */
export function domeOutline(cx: number, cy: number, r: number, character: Character): Pt[] {
  const d = DOMES[character.headgear];
  const e = 2 / d.square;
  return Array.from({ length: 21 }, (_, i) => {
    const a = Math.PI * (1 + i / 20);
    const c = Math.cos(a);
    const sn = Math.sin(a);
    return { x: cx + Math.sign(c) * Math.abs(c) ** e * d.hw * r, y: cy + (d.bottom - Math.abs(sn) ** e * (d.bottom - d.top)) * r };
  });
}

/** How far above the head's centre each headgear reaches, in head half-widths, outline included: the antenna's ball, the buns, the crest's tallest bristle, the cap, Splash's hair. */
const REACH: Record<Kind, number> = { racing: 2.06, buns: 1.79, cap: 1.23, crest: 2.42, swim: 1.37 };

/** How far the head of `character` reaches above its centre, in head half-widths. */
export function headTop(character: Character): number {
  return REACH[character.headgear];
}

/** How far `drawRacer` reaches above its bottom centre for `character`, in kart widths: the top of the head and what sits on it. */
export function racerTop(character: Character): number {
  return HEAD_Y + HEAD_R * REACH[character.headgear];
}

/**
 * One lid: it rises `slope` per head half-width toward the outer corner (0.19 is 11 degrees,
 * 0.55 is 29), bows up `arch` in its middle, and sits `lift` higher than the plain lid.
 */
type Lid = { slope: number; arch: number; lift: number };
/**
 * The lids per mood, the left eye's then the right's, and the eyes under them: `glance` turns
 * both pupils to the side, `w` and `h` scale the eye white, `pupil` the pupil, and `tuck` 1
 * hides the pupil's top under the lid (the tough look), 0 centres it in what the lid leaves
 * open (a calm or cheeky one; tucked under a raised lid the eyes would roll up). The lid and
 * the brow are one stroke, so the lids carry the mood: confident shallow, calm a level arch,
 * cheeky one low and flat and one cocked, angry steep.
 */
type Mood = { lids: [Lid, Lid]; glance: number; w: number; h: number; pupil: number; tuck: number };
const MOODS: Record<Character['lid'], Mood> = {
  confident: { lids: [{ slope: 0.19, arch: 0, lift: 0 }, { slope: 0.19, arch: 0, lift: 0 }], glance: 0, w: 1, h: 1, pupil: 1, tuck: 1 },
  calm: { lids: [{ slope: 0, arch: 0.07, lift: 0.05 }, { slope: 0, arch: 0.07, lift: 0.05 }], glance: 0, w: 1, h: 1, pupil: 1, tuck: 0.3 },
  cheeky: { lids: [{ slope: 0.03, arch: 0.02, lift: -0.02 }, { slope: 0, arch: 0.1, lift: 0.06 }], glance: 0.07, w: 1.08, h: 1.2, pupil: 1.2, tuck: 0.3 },
  angry: { lids: [{ slope: 0.55, arch: 0, lift: 0 }, { slope: 0.55, arch: 0, lift: 0 }], glance: 0, w: 1, h: 1, pupil: 1, tuck: 1 },
};

/** `colour` mixed `t` of the way to white: the headgear's speckle highlights. */
function tint(colour: number, t: number): number {
  const c = (v: number) => Math.round(v + (255 - v) * t);
  return (c((colour >> 16) & 0xff) << 16) | (c((colour >> 8) & 0xff) << 8) | c(colour & 0xff);
}

/**
 * The chibi head from the front, after the owner's reference sprites: a rounded square wider
 * than tall with a cel shadow under the chin; the headgear over its top half, each its own
 * silhouette (`Character.headgear`), with a hard cel shadow along its lower edge and a light
 * speckle (an arc and two dots) on its upper left; eyes set close under one heavy ink lid
 * that cuts their top off and is the brow too, its slope the mood (`Character.lid`), the
 * pupil a small ink disc tucked under it; a dot nose and a small mouth with attitude. The
 * face is 2.2 `r` wide and 2 `r` tall, 1.05 `r` below `cy`; above `cy` it reaches `REACH`
 * for its headgear, and at most 1.67 `r` to each side (Rex's horns). `look` -1..1 turns
 * the pupils. With `smallEyes` (every portrait), or where an eye would be drawn under
 * `C.ui.kart.smallEyePx` screen px wide at the camera's zoom (the picker's kart chips, the
 * Garage preview),
 * it is a solid ink shape under its lid, so the mood survives at 20 px.
 * Shared by `drawRacer` facing front, the portrait and Splash (`splash.ts`) so they read as
 * one cast; the road shows the driver from behind (`drawHeadBack`). The head's
 * never drawn in a scaled container, so the zoom alone gives the screen size.
 */
export function drawHead(g: Graphics, cx: number, cy: number, r: number, character: Character, lw: number, look = 0, smallEyes = false): void {
  const c = character;
  const P = (fx: number, fy: number): Pt => ({ x: cx + fx * r, y: cy + fy * r });
  const d = DOMES[c.headgear];
  const dark = shade(c.helmet, 0.72);

  // behind the face
  if (c.headgear === 'racing') {
    // the shell's sides, down past the ears to the jaw; the face sits in its opening
    // (it starts under the dome's shoulders, so it never widens the dome's round outline)
    g.fillStyle(c.helmet, 1).fillRoundedRect(cx - 1.3 * r, cy - 0.7 * r, 2.6 * r, 1.28 * r, { tl: 0, tr: 0, bl: 0.45 * r, br: 0.45 * r });
    g.lineStyle(lw, INK, 1).strokeRoundedRect(cx - 1.3 * r, cy - 0.7 * r, 2.6 * r, 1.28 * r, { tl: 0, tr: 0, bl: 0.45 * r, br: 0.45 * r });
  } else if (c.headgear === 'buns') {
    // two buns up and out, past the head's outline, then the hair falling behind the face to the cheeks
    g.fillStyle(c.helmet, 1).fillCircle(cx - 1.0 * r, cy - 1.3 * r, 0.42 * r).fillCircle(cx + 1.0 * r, cy - 1.3 * r, 0.42 * r);
    g.lineStyle(lw, INK, 1).strokeCircle(cx - 1.0 * r, cy - 1.3 * r, 0.42 * r).strokeCircle(cx + 1.0 * r, cy - 1.3 * r, 0.42 * r);
    g.fillStyle(dark, 1).fillRoundedRect(cx - 1.26 * r, cy - 1.0 * r, 2.52 * r, 1.42 * r, 0.42 * r);
    g.strokeRoundedRect(cx - 1.26 * r, cy - 1.0 * r, 2.52 * r, 1.42 * r, 0.42 * r);
  } else if (c.headgear === 'cap') {
    // worn backwards: the brim points away, so only its ends show past the head
    g.fillStyle(dark, 1).fillRoundedRect(cx - 1.52 * r, cy - 0.5 * r, 3.04 * r, 0.24 * r, 0.12 * r);
    g.lineStyle(lw, INK, 1).strokeRoundedRect(cx - 1.52 * r, cy - 0.5 * r, 3.04 * r, 0.24 * r, 0.12 * r);
  } else if (c.headgear === 'crest') {
    crestAndHorns(g, cx, cy, r, c, lw);
  }

  // the ears, one bar behind the face; the racing shell and the cheek guards cover them
  if (c.headgear !== 'racing' && c.headgear !== 'crest') {
    g.fillStyle(c.skin, 1).fillRoundedRect(cx - 1.32 * r, cy + 0.02 * r, 2.64 * r, 0.44 * r, 0.22 * r);
    g.lineStyle(lw, INK, 1).strokeRoundedRect(cx - 1.32 * r, cy + 0.02 * r, 2.64 * r, 0.44 * r, 0.22 * r);
  }

  // the face in its shadow shade, the lit skin over all of it but the chin
  g.fillStyle(shade(c.skin, 0.78), 1).fillRoundedRect(cx - 1.1 * r, cy - 0.95 * r, 2.2 * r, 2 * r, 0.6 * r);
  g.fillStyle(c.skin, 1).fillRoundedRect(cx - 1.1 * r, cy - 0.95 * r, 2.2 * r, 1.79 * r, 0.6 * r);
  g.lineStyle(lw, INK, 1).strokeRoundedRect(cx - 1.1 * r, cy - 0.95 * r, 2.2 * r, 2 * r, 0.6 * r);

  const small = smallEyes || 2 * EYE.hw * r * (g.scene?.cameras?.main?.zoom ?? 1) < C.ui.kart.smallEyePx;
  const mood = MOODS[c.lid];
  for (const sx of [-1, 1]) eye(g, cx, cy, r, sx, mood, mood.lids[sx < 0 ? 0 : 1], small, lw, look, c.mark === 'lashes');
  if (c.mark === 'freckles') {
    g.fillStyle(shade(c.skin, 0.7), 1);
    for (const sx of [-1, 1]) {
      for (const [fx, fy] of [[0.6, 0.68], [0.78, 0.6], [0.8, 0.76]]) g.fillCircle(cx + sx * fx * r, cy + fy * r, 0.055 * r);
    }
  } else if (c.mark === 'scar') {
    // through the left lid, pale against the skin and drawn over the lid
    g.lineStyle(0.1 * r, tint(c.skin, 0.62), 1).lineBetween(cx - 0.68 * r, cy - 0.24 * r, cx - 0.4 * r, cy + 0.24 * r);
  }

  g.fillStyle(INK, 1).fillCircle(cx, cy + 0.64 * r, 0.05 * r);
  mouth(g, P, c.mouth, lw);

  // the dome over the top of the head, its brim band in shadow; the dome's sides stand upright at the brim, so the band stays inside
  const dome = domeOutline(cx, cy, r, c);
  g.fillStyle(c.helmet, 1).fillPoints(dome, true);
  g.fillStyle(dark, 1).fillRect(cx - d.hw * r, cy + (d.bottom - 0.16) * r, 2 * d.hw * r, 0.16 * r);
  g.lineStyle(lw, INK, 1).strokePoints(dome, true);

  speckle(g, cx, cy, r, c);

  switch (c.headgear) {
    case 'racing': {
      // the stripe front to back over the crown, the goggles on the brim, the antenna
      g.fillStyle(c.visor, 1).fillRect(cx - 0.17 * r, cy + d.top * r, 0.34 * r, (d.bottom - 0.16 - d.top) * r);
      g.lineStyle(0.7 * lw, INK, 1).strokeRect(cx - 0.17 * r, cy + d.top * r, 0.34 * r, (d.bottom - 0.16 - d.top) * r);
      goggles(g, cx, cy, r, c.visor, lw, -0.62);
      g.lineStyle(0.12 * r, INK, 1).lineBetween(cx, cy + d.top * r, cx, cy - 1.72 * r);
      g.fillStyle(c.visor, 1).fillCircle(cx, cy - 1.84 * r, 0.16 * r);
      g.lineStyle(0.8 * lw, INK, 1).strokeCircle(cx, cy - 1.84 * r, 0.16 * r);
      return;
    }
    case 'buns': {
      // the band across the hair, then the fringe swept to the left over the forehead, its lower edge zigzag
      g.fillStyle(c.visor, 1).fillRoundedRect(cx - 1.2 * r, cy - 0.9 * r, 2.4 * r, 0.2 * r, 0.06 * r);
      g.lineStyle(0.8 * lw, INK, 1).strokeRoundedRect(cx - 1.2 * r, cy - 0.9 * r, 2.4 * r, 0.2 * r, 0.06 * r);
      const fringe = [P(-1.2, -0.56), P(1.0, -0.56), P(0.8, -0.32), P(0.52, -0.44), P(0.28, -0.18), P(0.02, -0.36), P(-0.26, -0.08), P(-0.52, -0.3), P(-0.84, 0.02), P(-1.08, -0.2), P(-1.2, -0.02)];
      g.fillStyle(c.helmet, 1).fillPoints(fringe, true);
      g.lineStyle(lw, INK, 1).strokePoints(fringe.slice(1), false);
      return;
    }
    case 'cap': {
      // the adjuster's arch cut out of the cap's front, in the hair's shadow, and three pointed
      // locks fanning up out of it over the cap
      const hair = c.hair ?? c.helmet;
      const hole = arc(P(0, -0.38), 0.3 * r, Math.PI, 2 * Math.PI, 6);
      g.fillStyle(shade(hair, 0.7), 1).fillPoints(hole, true);
      g.lineStyle(0.8 * lw, INK, 1).strokePoints(hole, true);
      // swept to one side, each lock curving to its point, so they read as hair and not a star
      const locks = [P(-0.2, -0.42), P(-0.34, -0.62), P(-0.36, -0.8), P(-0.24, -0.94), P(-0.18, -0.76), P(-0.08, -0.66), P(-0.06, -0.86), P(0.12, -1.02), P(0.1, -0.82), P(0.16, -0.66), P(0.32, -0.74), P(0.54, -0.78), P(0.36, -0.6), P(0.2, -0.42)];
      g.fillStyle(hair, 1).fillPoints(locks, true);
      g.lineStyle(0.8 * lw, INK, 1).strokePoints(locks, true);
      return;
    }
    case 'crest': {
      // the cheek guards down beside the face, over the ears
      for (const sx of [-1, 1]) {
        const x0 = sx < 0 ? cx - 1.34 * r : cx + 0.98 * r;
        g.fillStyle(c.helmet, 1).fillRoundedRect(x0, cy + (d.bottom - 0.06) * r, 0.36 * r, 1.0 * r, { tl: 0, tr: 0, bl: 0.18 * r, br: 0.18 * r });
        g.lineStyle(lw, INK, 1).strokeRoundedRect(x0, cy + (d.bottom - 0.06) * r, 0.36 * r, 1.0 * r, { tl: 0, tr: 0, bl: 0.18 * r, br: 0.18 * r });
      }
      return;
    }
    case 'swim':
      goggles(g, cx, cy, r, c.visor, lw, -0.69);
      return;
  }
}

/**
 * What covers the back of `character`'s head on the head centred at `cx`, `cy` of half width
 * `r`, as an outline: Bolt's shell, Nova's hair to its hem, Pip's cap, Rex's shell and neck
 * guard. `drawHeadBack` draws it.
 */
function backCover(cx: number, cy: number, r: number, character: Character): Pt[] {
  const P = (fx: number, fy: number): Pt => ({ x: cx + fx * r, y: cy + fy * r });
  const dome = domeOutline(cx, cy, r, character);
  switch (character.headgear) {
    case 'racing':
      return [...dome, P(1.3, 0.4), P(1.1, 0.58), P(-1.1, 0.58), P(-1.3, 0.4)];
    case 'buns':
      return [...dome, ...NOVA_HEM.map(([fx, fy]) => P(fx, fy))];
    case 'crest':
      return [...dome, P(1.24, 0.06), P(1.44, 0.44), P(-1.44, 0.44), P(-1.24, 0.06)];
    case 'cap':
      return [...dome, P(1.16, 0.02), P(-1.16, 0.02)];
    default:
      return dome;
  }
}

/** Nova's zigzag hem at the nape, right to left, in head half-widths. */
const NOVA_HEM = [1.2, 0.9, 0.6, 0.3, 0, -0.3, -0.6, -0.9, -1.2].map((fx, i) => [fx, i % 2 ? 0.44 : 0.62]);

/** A buckle's chrome, on Bolt's goggle strap. */
const BUCKLE = 0xd8dde6;

/**
 * The chibi head from behind, for the road, where the kart and its driver face away from the
 * camera: the back of the skull in skin with a cel shadow at the nape, a short neck down into
 * the collar, the ears peeking out on both sides, and the headgear's back, each recognisable by
 * silhouette and colour alone: Bolt's helmet with the stripe down its middle, the goggle strap
 * round it at the brim with its buckle, the antenna; Nova's hair to a zigzag hem at the nape,
 * both buns, the band tied at the back with two long tails; Pip's backwards cap with its
 * crown button and panel seams, a short bill sticking out of the middle of its lower edge,
 * and a strip of light hair to a straight nape line under it; Rex's helmet with a flared
 * neck guard, the cheek guards' rear edges, the crest and the horns. No eyes, brows, nose,
 * mouth or face marks. The same width as `drawHead` and the same `REACH` above `cy`, down to
 * 1.05 `r` below it, so the badge and the box hold for both. `turn` -1..1 is the
 * lean: the head turns into the corner with it, so what runs down the back's middle slides
 * the other way and the ear on the turn's side slips round behind the skull, with no step.
 */
export function drawHeadBack(g: Graphics, cx: number, cy: number, r: number, character: Character, lw: number, turn = 0): void {
  const c = character;
  const P = (fx: number, fy: number): Pt => ({ x: cx + fx * r, y: cy + fy * r });
  const d = DOMES[c.headgear];
  const dark = shade(c.helmet, 0.72);
  const lean = Math.max(-1, Math.min(1, turn));
  const mid = -0.16 * lean; // the back's centre line swings against the turn
  // The ear on the turn's side slips behind the skull as the head turns, from a lean of 0.3
  // to gone at 0.9: a switch at one lean made the ear blink in a bend held near it.
  const tuck = Math.max(0, Math.min(1, (Math.abs(lean) - 0.3) / 0.6));
  const earY: Record<Kind, number> = { racing: 0.56, buns: 0.3, cap: 0.3, crest: 0.56, swim: 0.3 };

  // behind the skull: Rex's crest and horns, Nova's buns, Rex's cheek guards' rear edges
  if (c.headgear === 'crest') {
    crestAndHorns(g, cx, cy, r, c, lw);
    for (const sx of [-1, 1]) {
      const x0 = sx < 0 ? cx - 1.36 * r : cx + 1.16 * r;
      g.fillStyle(dark, 1).fillRect(x0, cy - 0.36 * r, 0.2 * r, 0.6 * r);
      g.lineStyle(lw, INK, 1).strokeRect(x0, cy - 0.36 * r, 0.2 * r, 0.6 * r);
    }
  } else if (c.headgear === 'buns') {
    g.fillStyle(c.helmet, 1).fillCircle(cx - 1.0 * r, cy - 1.3 * r, 0.42 * r).fillCircle(cx + 1.0 * r, cy - 1.3 * r, 0.42 * r);
    g.lineStyle(lw, INK, 1).strokeCircle(cx - 1.0 * r, cy - 1.3 * r, 0.42 * r).strokeCircle(cx + 1.0 * r, cy - 1.3 * r, 0.42 * r);
  }

  // the neck, its top in the skull's shadow, down into the collar
  g.fillStyle(c.skin, 1).fillRect(cx - 0.44 * r, cy + 0.6 * r, 0.88 * r, 0.45 * r);
  g.fillStyle(shade(c.skin, 0.78), 1).fillRect(cx - 0.44 * r, cy + 0.6 * r, 0.88 * r, 0.3 * r);
  g.lineStyle(lw, INK, 1).strokeRect(cx - 0.44 * r, cy + 0.6 * r, 0.88 * r, 0.45 * r);
  // the ears, out past the skull and whatever covers it
  for (const sx of [-1, 1]) {
    const ex = cx + sx * (1.18 - (sx === Math.sign(lean) ? 0.34 * tuck : 0)) * r;
    g.fillStyle(c.skin, 1).fillEllipse(ex, cy + earY[c.headgear] * r, 0.42 * r, 0.5 * r);
    g.lineStyle(lw, INK, 1).strokeEllipse(ex, cy + earY[c.headgear] * r, 0.42 * r, 0.5 * r);
  }
  // the back of the skull, its nape in shadow
  g.fillStyle(shade(c.skin, 0.78), 1).fillRoundedRect(cx - 1.1 * r, cy - 0.95 * r, 2.2 * r, 1.73 * r, 0.6 * r);
  g.fillStyle(c.skin, 1).fillRoundedRect(cx - 1.1 * r, cy - 0.95 * r, 2.2 * r, 1.53 * r, 0.6 * r);
  g.lineStyle(lw, INK, 1).strokeRoundedRect(cx - 1.1 * r, cy - 0.95 * r, 2.2 * r, 1.73 * r, 0.6 * r);

  const dome = domeOutline(cx, cy, r, c);
  const cover = backCover(cx, cy, r, c);
  switch (c.headgear) {
    case 'racing': {
      // the shell down past the ears' tops, its lower edge in shadow, then the stripe down the
      // middle, the goggle strap round the back at the brim with its buckle, and the antenna
      const shell = cover;
      g.fillStyle(c.helmet, 1).fillPoints(shell, true);
      g.fillStyle(dark, 1).fillPoints([P(-1.3, 0.26), P(1.3, 0.26), P(1.3, 0.4), P(1.1, 0.58), P(-1.1, 0.58), P(-1.3, 0.4)], true);
      speckle(g, cx, cy, r, c);
      g.fillStyle(c.visor, 1).fillRect(cx + (mid - 0.17) * r, cy + d.top * r, 0.34 * r, (0.26 - d.top) * r);
      g.lineStyle(0.7 * lw, INK, 1).strokeRect(cx + (mid - 0.17) * r, cy + d.top * r, 0.34 * r, (0.26 - d.top) * r);
      g.lineStyle(lw, INK, 1).strokePoints(shell, true);
      g.fillStyle(shade(c.visor, 0.7), 1).fillRect(cx - 1.3 * r, cy - 0.46 * r, 2.6 * r, 0.2 * r);
      g.lineStyle(0.8 * lw, INK, 1).strokeRect(cx - 1.3 * r, cy - 0.46 * r, 2.6 * r, 0.2 * r);
      g.fillStyle(BUCKLE, 1).fillRoundedRect(cx + (mid - 0.2) * r, cy - 0.52 * r, 0.4 * r, 0.32 * r, 0.06 * r);
      g.lineStyle(0.8 * lw, INK, 1).strokeRoundedRect(cx + (mid - 0.2) * r, cy - 0.52 * r, 0.4 * r, 0.32 * r, 0.06 * r);
      g.lineStyle(0.12 * r, INK, 1).lineBetween(cx, cy + d.top * r, cx, cy - 1.72 * r);
      g.fillStyle(c.visor, 1).fillCircle(cx, cy - 1.84 * r, 0.16 * r);
      g.lineStyle(0.8 * lw, INK, 1).strokeCircle(cx, cy - 1.84 * r, 0.16 * r);
      return;
    }
    case 'buns': {
      // the hair over the whole skull to a zigzag hem at the nape, the hem's band in shadow
      const hem = NOVA_HEM.map(([fx, fy]) => P(fx, fy));
      const hair = cover;
      g.fillStyle(c.helmet, 1).fillPoints(hair, true);
      g.fillStyle(dark, 1).fillPoints([...hem, ...hem.slice().reverse().map(p => ({ x: p.x, y: p.y - 0.18 * r }))], true);
      speckle(g, cx, cy, r, c);
      g.lineStyle(lw, INK, 1).strokePoints(hair, true);
      // the band round the head, tied at the back: two short tails hanging from a knot
      g.fillStyle(c.visor, 1).fillRoundedRect(cx - 1.2 * r, cy - 0.9 * r, 2.4 * r, 0.2 * r, 0.06 * r);
      g.lineStyle(0.8 * lw, INK, 1).strokeRoundedRect(cx - 1.2 * r, cy - 0.9 * r, 2.4 * r, 0.2 * r, 0.06 * r);
      for (const sx of [-1, 1]) {
        const tail = [P(mid + sx * 0.04, -0.78), P(mid + sx * 0.2, -0.76), P(mid + sx * 0.44, 0.18), P(mid + sx * 0.32, 0.1), P(mid + sx * 0.2, 0.2)];
        g.fillStyle(c.visor, 1).fillPoints(tail, true);
        g.lineStyle(0.8 * lw, INK, 1).strokePoints(tail, true);
      }
      g.fillStyle(c.visor, 1).fillEllipse(cx + mid * r, cy - 0.8 * r, 0.36 * r, 0.3 * r);
      g.lineStyle(0.8 * lw, INK, 1).strokeEllipse(cx + mid * r, cy - 0.8 * r, 0.36 * r, 0.3 * r);
      return;
    }
    case 'cap': {
      // the hair, a light warm brown so it never reads as dark sockets: one strip from under the
      // cap to a straight nape line, behind the bill
      g.fillStyle(shade(c.hair ?? c.helmet, 1.35), 1).fillRect(cx - 1.1 * r, cy - 0.1 * r, 2.2 * r, 0.66 * r);
      g.lineStyle(lw, INK, 1).strokeRect(cx - 1.1 * r, cy - 0.1 * r, 2.2 * r, 0.66 * r);
      // the cap's back, its lower edge in shadow; a button at the crown and panel seams running
      // down from it say "a cap from behind" at once
      g.fillStyle(c.helmet, 1).fillPoints(cover, true);
      g.fillStyle(dark, 1).fillRect(cx - 1.16 * r, cy - 0.14 * r, 2.32 * r, 0.16 * r);
      speckle(g, cx, cy, r, c);
      g.lineStyle(0.07 * r, dark, 1);
      for (const fx of [-0.62, 0, 0.62]) g.lineBetween(cx, cy - 1.0 * r, cx + fx * r, cy - 0.14 * r);
      g.lineStyle(lw, INK, 1).strokePoints(cover, true);
      g.fillStyle(dark, 1).fillCircle(cx, cy - 1.0 * r, 0.12 * r);
      g.lineStyle(0.8 * lw, INK, 1).strokeCircle(cx, cy - 1.0 * r, 0.12 * r);
      // worn backwards, the bill sticks out of the middle of the cap's lower edge toward the
      // camera: a short flat tongue, half the head's width, its underside a dark strip
      const bill = (lift: number): Pt[] => [P(-0.5, 0), P(0.5, 0), P(0.56, 0.3 - lift), P(0.3, 0.36 - lift), P(-0.3, 0.36 - lift), P(-0.56, 0.3 - lift)];
      g.fillStyle(shade(c.helmet, 0.5), 1).fillPoints(bill(0), true);
      g.fillStyle(c.helmet, 1).fillPoints(bill(0.1), true);
      g.lineStyle(lw, INK, 1).strokePoints(bill(0), true);
      return;
    }
    case 'crest': {
      // the shell flaring into a neck guard over the nape, its lower edge in shadow
      const shell = cover;
      g.fillStyle(c.helmet, 1).fillPoints(shell, true);
      g.fillStyle(dark, 1).fillPoints([P(-1.33, 0.26), P(1.33, 0.26), P(1.44, 0.44), P(-1.44, 0.44)], true);
      speckle(g, cx, cy, r, c);
      g.lineStyle(lw, INK, 1).strokePoints(shell, true);
      return;
    }
    case 'swim':
      return;
  }
}

/**
 * Rex's crest of bristles front to back, seen end on, and his horns, the same from the front
 * and from behind; the dome drawn after covers their roots. The crest is a tall fan about 60%
 * of the helmet's width, its top edge notched, its base in shadow and a few bristle lines
 * fanning up it; the horns curve out of the helmet's sides and up.
 */
function crestAndHorns(g: Graphics, cx: number, cy: number, r: number, c: Character, lw: number): void {
  const P = (fx: number, fy: number): Pt => ({ x: cx + fx * r, y: cy + fy * r });
  const top = Array.from({ length: 13 }, (_, i) => {
    const t = -Math.PI / 2 + (i * Math.PI) / 12;
    const notch = i % 2 ? 0.13 : 0;
    return P(0.75 * Math.sin(t) * (1 - notch * 0.4), -1.95 - 0.4 * Math.cos(t) + notch);
  });
  const crest = [P(-0.45, -1.2), ...top, P(0.45, -1.2)];
  g.fillStyle(c.visor, 1).fillPoints(crest, true);
  g.fillStyle(shade(c.visor, 0.75), 1).fillPoints([P(-0.45, -1.2), P(-0.61, -1.62), P(0.61, -1.62), P(0.45, -1.2)], true);
  g.lineStyle(0.5 * lw, shade(c.visor, 0.6), 1);
  for (const fx of [-0.36, 0, 0.36]) g.lineBetween(cx + fx * 0.5 * r, cy - 1.45 * r, cx + fx * r, cy - (2.12 - Math.abs(fx) * 0.35) * r);
  g.lineStyle(lw, INK, 1).strokePoints(crest, true);
  g.fillStyle(HORN, 1).lineStyle(lw, INK, 1);
  for (const sx of [-1, 1]) {
    const horn = [P(sx * 1.0, -0.6), P(sx * 1.4, -0.82), P(sx * 1.6, -1.2), P(sx * 1.56, -1.7), P(sx * 1.36, -1.26), P(sx * 1.08, -1.08)];
    g.fillPoints(horn, true);
    g.strokePoints(horn, true);
  }
}

/** The headgear's speckle on its dome's upper left: a short arc following its curve inside the outline, and two dots. */
function speckle(g: Graphics, cx: number, cy: number, r: number, c: Character): void {
  const d = DOMES[c.headgear];
  const light = tint(c.helmet, 0.55);
  const inDome = (deg: number, k: number): Pt => {
    const a = (deg * Math.PI) / 180;
    const e = 2 / d.square;
    return { x: cx + Math.sign(Math.cos(a)) * Math.abs(Math.cos(a)) ** e * d.hw * k * r, y: cy + (d.bottom - Math.abs(Math.sin(a)) ** e * (d.bottom - d.top) * k) * r };
  };
  g.lineStyle(0.09 * r, light, 1).strokePoints([inDome(200, 0.8), inDome(216, 0.8), inDome(234, 0.8)], false);
  const [d1, d2] = [inDome(250, 0.84), inDome(232, 0.6)];
  g.fillStyle(light, 1).fillCircle(d1.x, d1.y, 0.065 * r).fillCircle(d2.x, d2.y, 0.045 * r);
}

/** The eye white's centre offset from the nose line and below the head's centre, and its half width and half height, in head half-widths. */
const EYE = { x: 0.4, y: 0.3, hw: 0.3, hh: 0.24 };

/**
 * One eye, `sx` -1 the left: its white cut by its lid, its outline, the pupil tucked up under
 * the lid (or, under a lid cocked above the eye, high in the open eye), then the lid itself,
 * one thick ink stroke from above the outer corner toward the nose. `small`: the eye is solid
 * ink under its lid, both a little shorter toward the nose, so two eyes never merge into one
 * bar. `lashes` adds two short curved ticks sweeping up and out of the outer corner.
 */
function eye(g: Graphics, cx: number, cy: number, r: number, sx: number, mood: Mood, lid: Lid, small: boolean, lw: number, look: number, lashes: boolean): void {
  // `u` is the distance out from the eye's centre, away from the nose; the lid line's height there
  const lidAt = (u: number): number => EYE.y - 0.07 - lid.lift - lid.slope * u - lid.arch * Math.max(0, 1 - ((u - 0.03) / 0.39) ** 2);
  const W = (u: number, v: number): Pt => ({ x: cx + sx * (EYE.x + u) * r, y: cy + v * r });
  // small, every eye is the same modest ink shape: a mood's larger, rounder eye would read as a socket
  const hw = small ? 0.85 * EYE.hw : EYE.hw * mood.w;
  const hh = small ? 0.85 * EYE.hh : EYE.hh * mood.h;
  const ring = Array.from({ length: 16 }, (_, i) => {
    const a = (i / 16) * 2 * Math.PI;
    return { u: hw * Math.cos(a), v: EYE.y + hh * Math.sin(a) };
  });
  // the lid as a polyline; the white is cut a little under its centre line, so it never peeks past the stroke
  const inner = small ? -0.22 : -0.36;
  const along = [0, 1, 2, 3, 4].map(i => inner + ((0.42 - inner) * i) / 4);
  const cut = belowLine(ring, u => lidAt(u) + 0.03, along.slice(1, -1));
  const open = cut.length === ring.length; // the lid is above the whole eye
  const white = cut.map(p => W(p.u, p.v));
  if (small) {
    g.fillStyle(INK, 1);
    if (open) g.fillEllipse(cx + sx * EYE.x * r, cy + EYE.y * r, 2 * hw * r, 2 * hh * r);
    else g.fillPoints(white, true);
  } else {
    g.fillStyle(WHITE, 1);
    // a whole ellipse strokes without a seam, which a closed point list would leave
    if (open) g.fillEllipse(cx + sx * EYE.x * r, cy + EYE.y * r, 2 * hw * r, 2 * hh * r).lineStyle(0.8 * lw, INK, 1).strokeEllipse(cx + sx * EYE.x * r, cy + EYE.y * r, 2 * hw * r, 2 * hh * r);
    else g.fillPoints(white, true).lineStyle(0.8 * lw, INK, 1).strokePoints(white, true);
    const pr = 0.105 * mood.pupil;
    const pu = -0.05 + sx * (look * 0.08 + mood.glance);
    const tucked = lidAt(pu) + 0.06 * mood.pupil;
    const centred = (Math.max(lidAt(pu), EYE.y - hh) + EYE.y + hh) / 2;
    const pupil = W(pu, Math.max(tucked + (1 - mood.tuck) * (centred - tucked), EYE.y - hh + pr + 0.02));
    g.fillStyle(INK, 1).fillCircle(pupil.x, pupil.y, pr * r);
    g.fillStyle(WHITE, 1).fillCircle(pupil.x - 0.035 * r, pupil.y + 0.02 * r, 0.03 * r);
  }
  // the lid: thicker at the outer end, where it is the brow too
  const half = (u: number): number => (small ? 0.1 : 0.075) * (1 + 0.25 * (u > 0 ? u / 0.42 : 0));
  g.fillStyle(INK, 1).fillPoints([...along.map(u => W(u, lidAt(u) - half(u))), ...along.slice().reverse().map(u => W(u, lidAt(u) + half(u)))], true);
  if (lashes && !small) {
    g.lineStyle(0.06 * r, INK, 1);
    for (const [v, up] of [[-0.02, 0.2], [0.05, 0.1]]) {
      const o = W(0.36, lidAt(0.36) + v);
      g.strokePoints([o, W(0.46, lidAt(0.36) + v - 0.3 * up), W(0.52, lidAt(0.36) + v - up)], false);
    }
  }
}

/**
 * The part of the closed outline `ring` below the line `lineAt(u)` (larger `v`), with the
 * crossing points. The edge between the crossings runs along the line through its `kinks`,
 * so the cut follows a bent lid instead of a chord across it.
 */
function belowLine(ring: { u: number; v: number }[], lineAt: (u: number) => number, kinks: number[]): { u: number; v: number }[] {
  const out: { u: number; v: number }[] = [];
  let exit = -1;
  ring.forEach((a, i) => {
    const b = ring[(i + 1) % ring.length];
    const fa = a.v - lineAt(a.u);
    const fb = b.v - lineAt(b.u);
    if (fa >= 0) out.push(a);
    if (fa >= 0 !== fb >= 0) {
      const t = fa / (fa - fb);
      const u = a.u + t * (b.u - a.u);
      out.push({ u, v: lineAt(u) });
      if (fa >= 0) exit = out.length - 1;
    }
  });
  if (exit < 0) return out;
  const from = out[exit].u;
  const to = out[(exit + 1) % out.length].u;
  const along = kinks.filter(u => (u - from) * (u - to) < 0).sort((p, q) => (p - q) * Math.sign(to - from)).map(u => ({ u, v: lineAt(u) }));
  out.splice(exit + 1, 0, ...along);
  // start at the crossing where the outline comes out from under the line: a closed stroke's
  // first point is an unjoined seam, and there the lid covers it
  const start = (exit + 1 + along.length) % out.length;
  return [...out.slice(start), ...out.slice(0, start)];
}

/** The mouth under the nose: a smirk pulled to the right, a small closed smile, a wide grin with teeth and a gap, or a frown. */
function mouth(g: Graphics, P: (fx: number, fy: number) => Pt, kind: Character['mouth'], lw: number): void {
  if (kind === 'grin') {
    // a D on its flat side, starting mid-top so the closed stroke's seam lies on a straight edge;
    // one band of teeth with a flat lower edge, one tooth missing
    const open = [P(0, 0.72), P(0.36, 0.72), ...[1, 2, 3, 4, 5, 6, 7].map(i => P(0.36 * Math.cos((i * Math.PI) / 8), 0.72 + 0.26 * Math.sin((i * Math.PI) / 8))), P(-0.36, 0.72)];
    g.fillStyle(MOUTH, 1).fillPoints(open, true);
    g.fillStyle(WHITE, 1).fillPoints([P(-0.34, 0.73), P(0.34, 0.73), P(0.32, 0.83), P(-0.32, 0.83)], true);
    g.fillStyle(MOUTH, 1).fillRect(P(0.05, 0).x, P(0, 0.73).y, P(0.11, 0).x - P(0.05, 0).x, P(0, 0.83).y - P(0, 0.73).y);
    g.lineStyle(0.9 * lw, INK, 1).strokePoints(open, true);
    return;
  }
  const line = kind === 'smirk' ? [P(-0.16, 0.81), P(0.06, 0.83), P(0.26, 0.72)]
    : kind === 'smile' ? [P(-0.25, 0.78), P(-0.1, 0.85), P(0.1, 0.85), P(0.25, 0.78)]
    : [P(-0.2, 0.88), P(-0.06, 0.8), P(0.06, 0.8), P(0.2, 0.88)];
  g.lineStyle(0.9 * lw, INK, 1).strokePoints(line, false);
}

/** Goggles pushed up on the brim, centred `fy` head half-widths below the head's centre: a strap and two lenses with a glint. */
function goggles(g: Graphics, cx: number, cy: number, r: number, colour: number, lw: number, fy: number): void {
  g.fillStyle(colour, 1).fillRoundedRect(cx - 1.22 * r, cy + (fy - 0.09) * r, 2.44 * r, 0.18 * r, 0.08 * r);
  g.lineStyle(0.8 * lw, INK, 1).strokeRoundedRect(cx - 1.22 * r, cy + (fy - 0.09) * r, 2.44 * r, 0.18 * r, 0.08 * r);
  g.fillStyle(colour, 1).fillCircle(cx - 0.5 * r, cy + fy * r, 0.25 * r).fillCircle(cx + 0.5 * r, cy + fy * r, 0.25 * r);
  g.lineStyle(lw, INK, 1).strokeCircle(cx - 0.5 * r, cy + fy * r, 0.25 * r).strokeCircle(cx + 0.5 * r, cy + fy * r, 0.25 * r);
  g.fillStyle(WHITE, 0.75).fillCircle(cx - 0.58 * r, cy + (fy - 0.08) * r, 0.07 * r).fillCircle(cx + 0.42 * r, cy + (fy - 0.08) * r, 0.07 * r);
}

/** Points on the circle about `c` of radius `rad` from angle `a0` to `a1`, both ends included. */
function arc(c: Pt, rad: number, a0: number, a1: number, n: number): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = a0 + ((a1 - a0) * i) / n;
    return { x: c.x + rad * Math.cos(a), y: c.y + rad * Math.sin(a) };
  });
}

/**
 * The driver's head from above on a body centred at `cx`, `cy`, nose along +x, `s` the kart's
 * length: each headgear its own shape, as from the front. The helmet's dome in shadow toward
 * the nose. Bolt's carries the stripe front to back, the goggles at the front and the antenna's
 * ball; Nova's hair the two buns either side and the band; Pip's cap the brim pointing back
 * and the tuft at the front; Rex's helmet the crest along it and the horns.
 */
export function drawHeadTop(g: Graphics, cx: number, cy: number, s: number, lw: number, c: Character): void {
  const R = (x: number, y: number, w: number, h: number, rad: number, fill: number): void => {
    g.fillStyle(fill, 1).fillRoundedRect(cx + x * s, cy + y * s, w * s, h * s, rad * s);
    g.lineStyle(lw, INK, 1).strokeRoundedRect(cx + x * s, cy + y * s, w * s, h * s, rad * s);
  };
  if (c.headgear === 'cap') R(-0.36, -0.13, 0.24, 0.26, 0.1, shade(c.helmet, 0.72)); // the brim, back toward the engine
  if (c.headgear === 'buns') {
    g.fillStyle(c.helmet, 1).fillCircle(cx - 0.02 * s, cy - 0.21 * s, 0.085 * s).fillCircle(cx - 0.02 * s, cy + 0.21 * s, 0.085 * s);
    g.lineStyle(lw, INK, 1).strokeCircle(cx - 0.02 * s, cy - 0.21 * s, 0.085 * s).strokeCircle(cx - 0.02 * s, cy + 0.21 * s, 0.085 * s);
  }
  if (c.headgear === 'crest') {
    // the horns out to either side and curving forward
    g.fillStyle(HORN, 1).lineStyle(0.8 * lw, INK, 1);
    for (const sign of [-1, 1]) {
      const horn = [{ x: cx - 0.07 * s, y: cy + sign * 0.12 * s }, { x: cx + 0.06 * s, y: cy + sign * 0.12 * s }, { x: cx + 0.06 * s, y: cy + sign * 0.27 * s }, { x: cx + 0.14 * s, y: cy + sign * 0.34 * s }, { x: cx - 0.02 * s, y: cy + sign * 0.3 * s }];
      g.fillPoints(horn, true);
      g.strokePoints(horn, true);
    }
  }
  // the dome, lit toward the rear and in shadow toward the nose
  const [x0, half] = c.headgear === 'cap' ? [-0.2, 0.16] : [-0.21, 0.18];
  g.fillStyle(shade(c.helmet, 0.72), 1).fillRoundedRect(cx + x0 * s, cy - half * s, 2 * half * s, 2 * half * s, 0.13 * s);
  g.fillStyle(c.helmet, 1).fillRoundedRect(cx + x0 * s, cy - half * s, 1.6 * half * s, 2 * half * s, 0.13 * s);
  g.lineStyle(lw, INK, 1).strokeRoundedRect(cx + x0 * s, cy - half * s, 2 * half * s, 2 * half * s, 0.13 * s);
  switch (c.headgear) {
    case 'racing':
      R(-0.21, -0.035, 0.36, 0.07, 0.02, c.visor);
      g.fillStyle(c.visor, 1).fillCircle(cx + 0.12 * s, cy - 0.09 * s, 0.05 * s).fillCircle(cx + 0.12 * s, cy + 0.09 * s, 0.05 * s);
      g.lineStyle(0.8 * lw, INK, 1).strokeCircle(cx + 0.12 * s, cy - 0.09 * s, 0.05 * s).strokeCircle(cx + 0.12 * s, cy + 0.09 * s, 0.05 * s);
      g.fillStyle(c.visor, 1).fillCircle(cx - 0.03 * s, cy, 0.05 * s);
      g.lineStyle(0.8 * lw, INK, 1).strokeCircle(cx - 0.03 * s, cy, 0.05 * s);
      return;
    case 'buns':
      R(0.07, -0.17, 0.05, 0.34, 0.02, c.visor);
      return;
    case 'cap':
      g.fillStyle(c.hair ?? c.helmet, 1).fillCircle(cx + 0.1 * s, cy, 0.05 * s);
      g.lineStyle(0.8 * lw, INK, 1).strokeCircle(cx + 0.1 * s, cy, 0.05 * s);
      return;
    case 'crest': {
      // the bristles along the crown, a strip with a toothed edge either side
      const side = [-0.18, -0.1, -0.02, 0.06, 0.14].map((fx, i) => ({ x: cx + fx * s, y: cy - (i % 2 ? 0.025 : 0.05) * s }));
      const crest = [{ x: cx - 0.24 * s, y: cy }, ...side, { x: cx + 0.18 * s, y: cy }, ...side.map(p => ({ x: p.x, y: 2 * cy - p.y })).reverse()];
      g.fillStyle(c.visor, 1).fillPoints(crest, true);
      g.lineStyle(0.8 * lw, INK, 1).strokePoints(crest, true);
      return;
    }
    default:
      return;
  }
}
