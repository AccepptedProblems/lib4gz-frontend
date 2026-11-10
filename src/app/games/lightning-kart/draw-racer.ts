import Phaser from 'phaser';
import { Character, Kart } from './catalogue';

type Graphics = Phaser.GameObjects.Graphics;

/**
 * Draws a racer seen from behind: the kart with its driver, from parts and colours. `x`, `y`
 * is the bottom centre, `s` the kart's width in stage units, `lean` -1..1 the steer, which
 * slides the driver across the seat. Draw order is back to front.
 */
export function drawRacer(g: Graphics, x: number, y: number, s: number, lean: number, character: Character, kart: Kart): void {
  const l = Math.max(-1, Math.min(1, lean)) * 0.08 * s;
  // rear wheels
  g.fillStyle(kart.wheel, 1);
  g.fillRect(x - 0.5 * s, y - 0.22 * s, 0.16 * s, 0.22 * s);
  g.fillRect(x + 0.34 * s, y - 0.22 * s, 0.16 * s, 0.22 * s);
  // spoiler
  g.fillStyle(kart.stripe, 1);
  g.fillRect(x - 0.32 * s, y - 0.52 * s, 0.64 * s, 0.05 * s);
  g.fillRect(x - 0.28 * s, y - 0.47 * s, 0.05 * s, 0.08 * s);
  g.fillRect(x + 0.23 * s, y - 0.47 * s, 0.05 * s, 0.08 * s);
  // driver, behind the body so the body hides the legs
  g.fillStyle(character.suit, 1);
  g.fillRoundedRect(x - 0.15 * s + l, y - 0.66 * s, 0.3 * s, 0.3 * s, 0.06 * s);
  g.fillStyle(character.skin, 1);
  g.fillCircle(x + l, y - 0.74 * s, 0.13 * s);
  g.fillStyle(character.helmet, 1);
  g.slice(x + l, y - 0.74 * s, 0.145 * s, Math.PI, 0, false);
  g.fillPath();
  g.fillStyle(character.visor, 1);
  g.fillRect(x - 0.11 * s + l, y - 0.77 * s, 0.22 * s, 0.05 * s);
  drawHat(g, x + l, y - 0.74 * s, s, character);
  // body
  g.fillStyle(kart.body, 1);
  if (kart.shape === 'classic') {
    g.fillRoundedRect(x - 0.4 * s, y - 0.4 * s, 0.8 * s, 0.32 * s, 0.06 * s);
  } else if (kart.shape === 'rocket') {
    g.fillPoints([
      { x: x - 0.36 * s, y: y - 0.1 * s },
      { x: x - 0.3 * s, y: y - 0.4 * s },
      { x: x, y: y - 0.47 * s },
      { x: x + 0.3 * s, y: y - 0.4 * s },
      { x: x + 0.36 * s, y: y - 0.1 * s },
    ], true);
  } else {
    g.fillRect(x - 0.48 * s, y - 0.42 * s, 0.96 * s, 0.34 * s);
  }
  g.fillStyle(kart.stripe, 1);
  g.fillRect(x - 0.05 * s, y - 0.4 * s, 0.1 * s, 0.3 * s);
  // front wheels, lower and wider apart
  g.fillStyle(kart.wheel, 1);
  g.fillRect(x - 0.56 * s, y - 0.18 * s, 0.18 * s, 0.18 * s);
  g.fillRect(x + 0.38 * s, y - 0.18 * s, 0.18 * s, 0.18 * s);
}

/**
 * The same racer seen from above, for the mode 7 ground: centred on the graphics origin,
 * nose along +x, `s` the kart's length. The caller rotates and squashes the graphics. The
 * flame, when given, trails behind the kart `lengths` kart lengths.
 */
export function drawKartTop(g: Graphics, s: number, character: Character, kart: Kart, flame: { lengths: number; colours: [number, number]; flicker: number } | null = null): void {
  const w = 0.68 * s;
  if (flame && flame.lengths > 0) {
    const len = flame.lengths * s * (0.85 + 0.3 * flame.flicker);
    g.fillStyle(flame.colours[0], 0.9);
    g.fillTriangle(-0.5 * s, -0.22 * w, -0.5 * s, 0.22 * w, -0.5 * s - len, 0);
    g.fillStyle(flame.colours[1], 0.95);
    g.fillTriangle(-0.5 * s, -0.1 * w, -0.5 * s, 0.1 * w, -0.5 * s - len * 0.55, 0);
  }
  // wheels
  g.fillStyle(kart.wheel, 1);
  for (const sx of [-0.32, 0.3]) {
    for (const sy of [-1, 1]) g.fillRect(sx * s - 0.09 * s, sy * 0.5 * w - 0.07 * w, 0.18 * s, 0.14 * w);
  }
  // body
  g.fillStyle(kart.body, 1);
  if (kart.shape === 'classic') {
    g.fillRoundedRect(-0.45 * s, -0.36 * w, 0.9 * s, 0.72 * w, 0.1 * s);
  } else if (kart.shape === 'rocket') {
    g.fillPoints([
      { x: -0.45 * s, y: -0.36 * w }, { x: 0.2 * s, y: -0.36 * w }, { x: 0.5 * s, y: 0 },
      { x: 0.2 * s, y: 0.36 * w }, { x: -0.45 * s, y: 0.36 * w },
    ], true);
  } else {
    g.fillRect(-0.48 * s, -0.42 * w, 0.96 * s, 0.84 * w);
  }
  // stripe down the middle, spoiler at the back
  g.fillStyle(kart.stripe, 1);
  g.fillRect(-0.45 * s, -0.06 * w, 0.9 * s, 0.12 * w);
  g.fillRect(-0.5 * s, -0.5 * w, 0.08 * s, w);
  // driver: shoulders, then the helmet with its visor toward the nose and the hat on top
  g.fillStyle(character.suit, 1);
  g.fillRoundedRect(-0.2 * s, -0.3 * w, 0.26 * s, 0.6 * w, 0.05 * s);
  g.fillStyle(character.helmet, 1);
  g.fillCircle(-0.06 * s, 0, 0.26 * w);
  g.fillStyle(character.visor, 1);
  g.fillRect(0.06 * s, -0.16 * w, 0.08 * s, 0.32 * w);
  drawHatTop(g, -0.06 * s, 0, s, character);
}

/** A round portrait of `size` stage units centred on the graphics origin: the kart's colour behind the driver's helmet. */
export function drawPortrait(g: Graphics, size: number, character: Character, kart: Kart): void {
  const r = size / 2;
  g.fillStyle(kart.body, 1);
  g.fillCircle(0, 0, r);
  g.fillStyle(character.suit, 1);
  g.fillRoundedRect(-0.34 * size, 0.18 * size, 0.68 * size, 0.4 * size, 0.1 * size);
  g.fillStyle(character.skin, 1);
  g.fillCircle(0, 0, 0.3 * size);
  g.fillStyle(character.helmet, 1);
  g.slice(0, 0, 0.32 * size, Math.PI, 0, false);
  g.fillPath();
  g.fillStyle(character.visor, 1);
  g.fillRect(-0.24 * size, -0.07 * size, 0.48 * size, 0.1 * size);
  drawHat(g, 0, 0, size * 2.2, character);
}

function drawHatTop(g: Graphics, cx: number, cy: number, s: number, character: Character): void {
  switch (character.hat) {
    case 'antenna':
      g.fillStyle(character.visor, 1);
      g.fillCircle(cx - 0.14 * s, cy, 0.035 * s);
      return;
    case 'cap':
      g.fillStyle(character.suit, 1);
      g.fillRect(cx + 0.1 * s, cy - 0.12 * s, 0.1 * s, 0.24 * s);
      return;
    case 'horns':
      g.fillStyle(character.visor, 1);
      g.fillTriangle(cx - 0.1 * s, cy - 0.14 * s, cx - 0.26 * s, cy - 0.26 * s, cx - 0.02 * s, cy - 0.2 * s);
      g.fillTriangle(cx - 0.1 * s, cy + 0.14 * s, cx - 0.26 * s, cy + 0.26 * s, cx - 0.02 * s, cy + 0.2 * s);
      return;
    default:
      return;
  }
}

function drawHat(g: Graphics, cx: number, cy: number, s: number, character: Character): void {
  const r = 0.145 * s;
  switch (character.hat) {
    case 'antenna':
      g.fillStyle(character.visor, 1);
      g.fillRect(cx - 0.012 * s, cy - r - 0.12 * s, 0.024 * s, 0.12 * s);
      g.fillCircle(cx, cy - r - 0.13 * s, 0.03 * s);
      return;
    case 'cap':
      g.fillStyle(character.suit, 1);
      g.fillRect(cx - r - 0.03 * s, cy - 0.02 * s, 2 * r + 0.06 * s, 0.035 * s);
      return;
    case 'horns':
      g.fillStyle(character.visor, 1);
      g.fillTriangle(cx - r, cy - 0.04 * s, cx - r - 0.06 * s, cy - r - 0.04 * s, cx - r + 0.08 * s, cy - 0.09 * s);
      g.fillTriangle(cx + r, cy - 0.04 * s, cx + r + 0.06 * s, cy - r - 0.04 * s, cx + r - 0.08 * s, cy - 0.09 * s);
      return;
    default:
      return;
  }
}
