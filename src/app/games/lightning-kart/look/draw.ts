import Phaser from 'phaser';
import { C } from '../engine/constants';
import { Character, Kart } from './catalogue';
import { drawHead, drawHeadBack, drawHeadTop, HEAD_R, HEAD_SLIDE, HEAD_Y, headTop, INK, MOUTH, shade, WHITE } from './head';

type Graphics = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };
type Flame = { lengths: number; colours: [number, number]; flicker: number } | null;
/** Which way the driver faces: away from the camera, as on the road, or round toward it, posing. */
export type Facing = 'back' | 'front';

/** Chrome for exhausts, rails and bolts; the tail lamps; the behind view's shadow alpha. Ink, white and the dark mouth of a pipe are the head's (`head.ts`). */
const CHROME = 0xd8dde6;
const LAMP = 0xff4a3d;
const SHADOW = 0.22;

/**
 * Draws a racer seen from behind: the kart with its driver, from parts and colours. `x`, `y`
 * is the bottom centre, `s` the kart's width in stage units, `lean` -1..1 the steer, which
 * slides the driver across the seat while the hands stay on the wheel. Draw order is back
 * to front. The drawing spans 1.32 `s` wide and reaches `racerTop(character)` `s` above `y`
 * (the top of the headgear: Pip's cap 1.45, Rex's crest 1.81) and 0.08 `s` below it (the
 * shadow blob).
 * `facing` 'back' (the Race scene) shows the driver from behind as the kart is: the back of
 * the head (`drawHeadBack`), the arms reaching forward with the elbows out and the gloves on
 * the rim's sides, the head turning into a hard lean. 'front' (the Garage's large preview and
 * the picker's kart chips) turns the driver round to pose: the face (`drawHead`).
 * The flame, when given, is two tongues out of the exhaust mouths toward the viewer, each
 * `lengths` times 0.35 `s` long and `lengths` times as wide as at 1, drawn last so they overlay the mouths. Drawn every frame on
 * the road: at most 86 fill and stroke calls from behind (Rex), flames included, and 92
 * facing front (Pip); the budget is 100.
 */
export function drawRacer(g: Graphics, x: number, y: number, s: number, lean: number, character: Character, kart: Kart, flame: Flame = null, facing: Facing = 'back'): void {
  const k = Math.max(-1, Math.min(1, lean));
  const lw = 0.04 * s;
  const dark = shade(kart.body, 0.7);
  const P = (fx: number, fy: number): Pt => ({ x: x + fx * s, y: y + fy * s });

  // the shadow blob under the tyres
  g.fillStyle(0x000000, SHADOW).fillEllipse(x, y, 1.3 * s, 0.16 * s);

  // front tyres: farther, so smaller, and they peek out above and outside the rear pair
  tyreBehind(g, x - 0.55 * s, y - 0.24 * s, 0.18 * s, 0.2 * s, kart.wheel, lw);
  tyreBehind(g, x + 0.55 * s, y - 0.24 * s, 0.18 * s, 0.2 * s, kart.wheel, lw);

  // the cowl: the front of the body seen past the driver, with the one highlight on top
  g.fillStyle(kart.body, 1).lineStyle(lw, INK, 1);
  if (kart.shape === 'classic') {
    g.fillRoundedRect(x - 0.32 * s, y - 0.58 * s, 0.64 * s, 0.2 * s, 0.08 * s);
    g.strokeRoundedRect(x - 0.32 * s, y - 0.58 * s, 0.64 * s, 0.2 * s, 0.08 * s);
  } else if (kart.shape === 'rocket') {
    g.fillRoundedRect(x - 0.26 * s, y - 0.62 * s, 0.52 * s, 0.24 * s, 0.12 * s);
    g.strokeRoundedRect(x - 0.26 * s, y - 0.62 * s, 0.52 * s, 0.24 * s, 0.12 * s);
  } else {
    g.fillRoundedRect(x - 0.36 * s, y - 0.62 * s, 0.72 * s, 0.24 * s, 0.03 * s);
    g.strokeRoundedRect(x - 0.36 * s, y - 0.62 * s, 0.72 * s, 0.24 * s, 0.03 * s);
  }
  g.fillStyle(0xffffff, 0.3).fillRoundedRect(x - 0.24 * s, y - 0.55 * s, 0.48 * s, 0.05 * s, 0.025 * s);

  // the steering wheel: wider than the torso, so its rim shows beside the arms; the head
  // hides the top of the rim, the rear block its bottom
  g.lineStyle(0.05 * s, INK, 1).strokeCircle(x, y - 0.62 * s, 0.33 * s);

  // the driver: a tiny torso, its lower part in shadow, and the head slide with the lean
  const tx = x + 0.06 * s * k;
  const hx = x + HEAD_SLIDE * s * k;
  const torso = (): void => {
    g.fillStyle(suitBand(character.suit), 1).fillRoundedRect(tx - 0.2 * s, y - 0.84 * s, 0.4 * s, 0.38 * s, 0.1 * s);
    g.fillStyle(character.suit, 1).fillRoundedRect(tx - 0.2 * s, y - 0.84 * s, 0.4 * s, 0.24 * s, 0.1 * s);
    g.lineStyle(lw, INK, 1).strokeRoundedRect(tx - 0.2 * s, y - 0.84 * s, 0.4 * s, 0.38 * s, 0.1 * s);
  };
  const gloves = (gy: number): void => {
    g.fillStyle(WHITE, 1).fillCircle(x - 0.33 * s, gy, 0.075 * s).fillCircle(x + 0.33 * s, gy, 0.075 * s);
    g.lineStyle(lw, INK, 1).strokeCircle(x - 0.33 * s, gy, 0.075 * s).strokeCircle(x + 0.33 * s, gy, 0.075 * s);
  };
  if (facing === 'front') {
    // stubby arms run from the shoulder corners, under the torso's outline, down and out to the
    // white gloves, which stay on the rim
    for (const sx of [-1, 1]) {
      const arm = [{ x: tx + sx * 0.18 * s, y: y - 0.78 * s }, { x: x + sx * 0.33 * s, y: y - 0.58 * s }];
      g.lineStyle(0.1 * s + 2 * lw, INK, 1).strokePoints(arm, false);
      g.lineStyle(0.1 * s, character.suit, 1).strokePoints(arm, false);
    }
    torso();
    gloves(y - 0.58 * s);
    drawHead(g, hx, y - HEAD_Y * s, HEAD_R * s, character, lw, k);
  } else {
    // the gloves on the rim's sides, beyond the elbows; each arm runs out from under the torso
    // to its elbow, then forward and up to its glove, hiding the glove's lower half
    gloves(y - 0.66 * s);
    for (const sx of [-1, 1]) {
      const elbow = { x: tx + sx * 0.31 * s, y: y - 0.58 * s };
      const arm = [{ x: tx + sx * 0.14 * s, y: y - 0.76 * s }, elbow, { x: x + sx * 0.33 * s, y: y - 0.64 * s }];
      g.lineStyle(0.1 * s + 2 * lw, INK, 1).strokePoints(arm, false);
      g.fillStyle(INK, 1).fillCircle(elbow.x, elbow.y, 0.05 * s + lw);
      g.lineStyle(0.1 * s, character.suit, 1).strokePoints(arm, false);
      g.fillStyle(character.suit, 1).fillCircle(elbow.x, elbow.y, 0.05 * s);
    }
    torso();
    drawHeadBack(g, hx, y - HEAD_Y * s, HEAD_R * s, character, lw, k);
  }

  // the rear block: dark shade first, the body colour over it leaves the underside band
  const top = kart.shape === 'tank' ? 0.52 : 0.44;
  const hw = kart.shape === 'tank' ? 0.44 : 0.4;
  const rad = kart.shape === 'classic' ? 0.1 : kart.shape === 'rocket' ? 0.07 : 0.03;
  if (kart.shape === 'rocket') {
    g.fillStyle(dark, 1).lineStyle(lw, INK, 1);
    for (const sign of [-1, 1]) {
      // outboard of the gloves and taller than the wheel's sides, so the Rocket reads from behind
      const fin = [P(sign * 0.4, -0.42), P(sign * 0.62, -0.84), P(sign * 0.64, -0.42)];
      g.fillPoints(fin, true);
      g.strokePoints(fin, true);
    }
  }
  g.fillStyle(dark, 1).fillRoundedRect(x - hw * s, y - top * s, 2 * hw * s, (top - 0.06) * s, rad * s);
  g.fillStyle(kart.body, 1).fillRoundedRect(x - hw * s, y - top * s, 2 * hw * s, (top - 0.16) * s, rad * s);
  g.fillStyle(0xffffff, 0.3).fillRoundedRect(x - (hw - 0.06) * s, y - (top - 0.03) * s, 2 * (hw - 0.06) * s, 0.05 * s, 0.025 * s);
  g.lineStyle(lw, INK, 1).strokeRoundedRect(x - hw * s, y - top * s, 2 * hw * s, (top - 0.06) * s, rad * s);

  // the engine box in the accent colour with a chrome rail across its top
  const box = kart.shape === 'classic' ? { hw: 0.2, top: 0.47, h: 0.26, r: 0.06 }
    : kart.shape === 'rocket' ? { hw: 0.18, top: 0.49, h: 0.26, r: 0.05 }
    : { hw: 0.26, top: 0.53, h: 0.28, r: 0.02 };
  g.fillStyle(kart.stripe, 1).fillRoundedRect(x - box.hw * s, y - box.top * s, 2 * box.hw * s, box.h * s, box.r * s);
  g.strokeRoundedRect(x - box.hw * s, y - box.top * s, 2 * box.hw * s, box.h * s, box.r * s);
  g.fillStyle(CHROME, 1).lineStyle(0.6 * lw, INK, 1);
  g.fillRoundedRect(x - 0.13 * s, y - (box.top - 0.05) * s, 0.26 * s, 0.05 * s, 0.025 * s);
  g.strokeRoundedRect(x - 0.13 * s, y - (box.top - 0.05) * s, 0.26 * s, 0.05 * s, 0.025 * s);

  // rear tyres, bigger, over the block's edges
  tyreBehind(g, x - 0.48 * s, y, 0.26 * s, 0.32 * s, kart.wheel, lw);
  tyreBehind(g, x + 0.48 * s, y, 0.26 * s, 0.32 * s, kart.wheel, lw);

  // twin exhausts at the rear corners: fat chrome mouths pointing at the camera, the pipe just showing
  exhaust(g, x - 0.27 * s, y - 0.24 * s, x - 0.33 * s, y - 0.2 * s, 0.1 * s, 0.12 * s);
  exhaust(g, x + 0.27 * s, y - 0.24 * s, x + 0.33 * s, y - 0.2 * s, 0.1 * s, 0.12 * s);
  lamp(g, x - 0.13 * s, y - 0.12 * s, 0.045 * s);
  lamp(g, x + 0.13 * s, y - 0.12 * s, 0.045 * s);

  // the exhaust flame: a tongue out of each mouth toward the viewer and a little outward
  if (flame && flame.lengths > 0) {
    const len = flame.lengths * 0.35 * s * (0.85 + 0.3 * flame.flicker);
    flameBehind(g, x - 0.33 * s, y - 0.2 * s, -1, len, flame.lengths * s, flame.colours);
    flameBehind(g, x + 0.33 * s, y - 0.2 * s, 1, len, flame.lengths * s, flame.colours);
  }
}

/** A tapered tongue from the mouth at `mx`, `my`, down the screen and out to `sign`'s side, `len` long and 0.2 `w` wide at the mouth: the outer colour, then a narrower core. */
function flameBehind(g: Graphics, mx: number, my: number, sign: number, len: number, w: number, colours: [number, number]): void {
  const n = Math.hypot(0.4, 1);
  const ux = (sign * 0.4) / n;
  const uy = 1 / n;
  const tongue = (hw: number, l: number): void => {
    g.fillTriangle(mx - uy * hw, my + ux * hw, mx + uy * hw, my - ux * hw, mx + ux * l, my + uy * l);
  };
  g.fillStyle(colours[0], 0.9);
  tongue(0.1 * w, len);
  g.fillStyle(colours[1], 0.95);
  tongue(0.05 * w, 0.55 * len);
}

/**
 * The same racer seen from above, for the mode 7 ground: centred on the graphics origin,
 * nose along +x, `s` the kart's length. The caller rotates and squashes the graphics and
 * draws the shadow under it, so none is drawn here. The flame, when given, is two tongues
 * out of the exhaust mouths, each `lengths` kart lengths long and `lengths` times as wide as at 1. Drawn every frame: at most 45
 * fill and stroke calls per kart (Bolt), flames included; the budget is 56.
 */
export function drawKartTop(g: Graphics, s: number, character: Character, kart: Kart, flame: Flame = null): void {
  const lw = 0.035 * s;
  const dark = shade(kart.body, 0.7);
  const P = (fx: number, fy: number): Pt => ({ x: fx * s, y: fy * s });

  if (flame && flame.lengths > 0) {
    const len = flame.lengths * s * (0.85 + 0.3 * flame.flicker);
    const w = flame.lengths * s;
    for (const sign of [-1, 1]) {
      const mx = -0.5 * s;
      const my = sign * 0.24 * s;
      g.fillStyle(flame.colours[0], 0.9).fillTriangle(mx, my - 0.08 * w, mx, my + 0.08 * w, mx - len, my);
      g.fillStyle(flame.colours[1], 0.95).fillTriangle(mx, my - 0.04 * w, mx, my + 0.04 * w, mx - 0.55 * len, my);
    }
  }

  // tyres outside the body, the rear pair bigger; the pipes come out from under the rear corners
  for (const sign of [-1, 1]) {
    tyreTop(g, -0.28 * s, sign * 0.33 * s, 0.3 * s, 0.15 * s, kart.wheel);
    tyreTop(g, 0.27 * s, sign * 0.3 * s, 0.24 * s, 0.12 * s, kart.wheel);
    exhaust(g, -0.36 * s, sign * 0.12 * s, -0.5 * s, sign * 0.24 * s, 0.05 * s, 0.07 * s);
  }

  // the body
  g.fillStyle(kart.body, 1).lineStyle(lw, INK, 1);
  if (kart.shape === 'classic') {
    g.fillRoundedRect(-0.42 * s, -0.25 * s, 0.84 * s, 0.5 * s, 0.12 * s);
    g.strokeRoundedRect(-0.42 * s, -0.25 * s, 0.84 * s, 0.5 * s, 0.12 * s);
  } else if (kart.shape === 'rocket') {
    g.fillStyle(dark, 1);
    g.fillTriangle(-0.3 * s, -0.24 * s, -0.46 * s, -0.36 * s, -0.42 * s, -0.24 * s);
    g.fillTriangle(-0.3 * s, 0.24 * s, -0.46 * s, 0.36 * s, -0.42 * s, 0.24 * s);
    const body = [P(-0.42, -0.24), P(0.14, -0.24), P(0.48, 0), P(0.14, 0.24), P(-0.42, 0.24)];
    g.fillStyle(kart.body, 1).fillPoints(body, true);
    g.strokePoints(body, true);
  } else {
    g.fillRoundedRect(-0.44 * s, -0.27 * s, 0.88 * s, 0.54 * s, 0.04 * s);
    g.strokeRoundedRect(-0.44 * s, -0.27 * s, 0.88 * s, 0.54 * s, 0.04 * s);
  }
  // the engine deck sits lower than the cowl: the rear in the dark shade
  g.fillStyle(dark, 1).fillRoundedRect(-0.38 * s, -0.2 * s, 0.22 * s, 0.4 * s, 0.04 * s);

  // the accent block: the engine box at the rear, the bumper insert at the nose; a chrome bolt
  g.fillStyle(kart.stripe, 1).fillRoundedRect(-0.4 * s, -0.16 * s, 0.22 * s, 0.32 * s, 0.04 * s);
  g.strokeRoundedRect(-0.4 * s, -0.16 * s, 0.22 * s, 0.32 * s, 0.04 * s);
  if (kart.shape === 'classic') g.fillRoundedRect(0.28 * s, -0.13 * s, 0.12 * s, 0.26 * s, 0.05 * s);
  else if (kart.shape === 'rocket') g.fillTriangle(0.26 * s, -0.1 * s, 0.26 * s, 0.1 * s, 0.42 * s, 0);
  else g.fillRect(0.3 * s, -0.19 * s, 0.12 * s, 0.38 * s);
  g.fillStyle(CHROME, 1).fillCircle(-0.29 * s, 0, 0.035 * s);
  lamp(g, -0.39 * s, -0.21 * s, 0.035 * s);
  lamp(g, -0.39 * s, 0.21 * s, 0.035 * s);

  // the cowl in front of the driver carries the one highlight
  g.fillStyle(0xffffff, 0.28).fillRoundedRect(0.04 * s, -0.15 * s, 0.2 * s, 0.3 * s, 0.06 * s);

  // the driver from above: wide shoulders, then the head and its headgear
  g.fillStyle(character.suit, 1).fillRoundedRect(-0.26 * s, -0.25 * s, 0.2 * s, 0.5 * s, 0.08 * s);
  g.lineStyle(lw, INK, 1).strokeRoundedRect(-0.26 * s, -0.25 * s, 0.2 * s, 0.5 * s, 0.08 * s);
  drawHeadTop(g, -0.08 * s, 0, s, lw, character);
}

/**
 * A round portrait of `size` stage units centred on the graphics origin: the driver's head
 * filling a disc of the kart's colour, every part inside the ring. A tall headgear shrinks the
 * head to fit, and the head's height is centred on the disc.
 */
export function drawPortrait(g: Graphics, size: number, character: Character, kart: Kart): void {
  const r = size / 2;
  const lw = 0.04 * size;
  g.fillStyle(kart.body, 1).fillCircle(0, 0, r);
  g.lineStyle(lw, shade(kart.body, 0.6), 1).strokeCircle(0, 0, r - lw / 2);
  // always the small eye: at a portrait's size an open eye reads as glasses, whatever the pixel ratio
  const reach = headTop(character);
  const hr = size * Math.min(PORTRAIT.r, PORTRAIT.tall / (reach + 1.1));
  drawHead(g, 0, ((reach - 1.1) / 2) * hr, hr, character, 0.03 * size, 0, true);
}

/** The portrait head's half width as a share of the disc, at most `r`, and the share of the disc its height fills. */
const PORTRAIT = { r: 0.25, tall: 0.77 };

/** The torso's cel band: a shadow, or on a near-black suit, where a shadow would vanish, a highlight. */
function suitBand(suit: number): number {
  const luma = 0.299 * ((suit >> 16) & 0xff) + 0.587 * ((suit >> 8) & 0xff) + 0.114 * (suit & 0xff);
  return luma < C.ui.kart.darkSuitLuma ? shade(suit, 2.6) : shade(suit, 0.72);
}

/** A fat tyre seen from behind, `cx` its centre and `bottom` its contact line: the tread face lighter than the sidewalls, outlined. */
function tyreBehind(g: Graphics, cx: number, bottom: number, w: number, h: number, colour: number, lw: number): void {
  g.fillStyle(colour, 1).fillRoundedRect(cx - w / 2, bottom - h, w, h, 0.25 * w);
  g.fillStyle(0xffffff, 0.14).fillRoundedRect(cx - 0.3 * w, bottom - 0.88 * h, 0.6 * w, 0.76 * h, 0.15 * w);
  g.lineStyle(lw, INK, 1).strokeRoundedRect(cx - w / 2, bottom - h, w, h, 0.25 * w);
}

/** A tyre seen from above, `len` along the travel: the tread band lighter down its middle. */
function tyreTop(g: Graphics, cx: number, cy: number, len: number, wid: number, colour: number): void {
  g.fillStyle(colour, 1).fillRoundedRect(cx - len / 2, cy - wid / 2, len, wid, 0.3 * wid);
  g.fillStyle(0xffffff, 0.14).fillRoundedRect(cx - 0.4 * len, cy - 0.25 * wid, 0.8 * len, 0.5 * wid, 0.2 * wid);
}

/** A chrome pipe from `x1`, `y1` to its mouth at `x2`, `y2`, the mouth a disc of radius `r` with a dark centre. */
function exhaust(g: Graphics, x1: number, y1: number, x2: number, y2: number, r: number, pipeW: number): void {
  g.lineStyle(pipeW, CHROME, 1).strokePoints([{ x: x1, y: y1 }, { x: x2, y: y2 }], false);
  g.fillStyle(CHROME, 1).fillCircle(x2, y2, r);
  g.fillStyle(MOUTH, 1).fillCircle(x2, y2, 0.6 * r);
}

/** A round tail lamp in a chrome bezel. */
function lamp(g: Graphics, cx: number, cy: number, r: number): void {
  g.fillStyle(CHROME, 1).fillCircle(cx, cy, r);
  g.fillStyle(LAMP, 1).fillCircle(cx, cy, 0.65 * r);
}
