import Phaser from 'phaser';
import { C } from '../engine/constants';
import { Character } from './catalogue';
import { boltPoints } from './bolt';
import { drawHead, HEAD_SLIDE, HEAD_Y, INK, racerTop, shade } from './head';

type Graphics = Phaser.GameObjects.Graphics;
type Pt = { x: number; y: number };

const COLORS = C.ui.colors;
const WHITE = 0xffffff;
const SKIN = 0xffdbac;

/** Splash as the drivers' head sees her: magenta hair in the helmet's place, cyan swim goggles, a cyan top, the cheeky lid and a smirk. Her own character, never a racer: the id goes nowhere. */
const SPLASH: Character = {
  id: 'splash', name: 'Splash', skin: SKIN, helmet: COLORS.magenta, visor: COLORS.cyan, suit: COLORS.cyan, headgear: 'swim', lid: 'cheeky', mouth: 'smirk', mark: 'none',
};

/** Her height in head half-widths, feet to the top of her hair; the head is 2.35 of them, about two thirds. */
const TALL = 3.47;
/** Her gun hand from her feet, in head half-widths: the gun turns about it. */
const HAND = { x: -0.7, y: -0.74 };
/** The muzzle in the gun's frame (forward is -x), from the hand, in head half-widths. */
const MUZZLE = { x: -1.42, y: -0.21 };

/** The bottle in her hand: its height in head half-widths, and its centre in the hand's frame, held out by her chin. */
const BOTTLE = 0.8;
const BOTTLE_AT = { x: -0.35, y: -0.3 };

/** The gun's tilt below level, in radians, while she has not yet aimed. */
export const GUN_DOWN = 0.6;
/** The bottle's tilt at the end of her wind-up: its top tipped toward the kart, clear of her face. */
export const BOTTLE_TIP = 0.5;

/** What her throwing hand holds: the gun, the bottle, or nothing once the bottle is thrown. */
export type Held = 'gun' | 'bottle' | 'none';

/**
 * Splash from the front, `x`, `y` the bottom centre of her feet, `h` her height to the top of
 * her hair. A chibi after the drivers' reference with the drivers' head: her hair is the cap
 * with a shadowed fringe, the swim goggles pushed up on it, the pupils turned to `look`
 * (-1 left); a ponytail swept out to the right, a cyan top, yellow shorts, stubby limbs, a fist
 * on her hip and in the other hand what she `holds`: a water gun pointing left `aim` radians
 * below level, the bottle held out by her chin and tipped `aim` toward the kart, or nothing. With the gun
 * level she reaches 0.63 `h` left of `x` (the muzzle) and 0.6 `h` right (the ponytail).
 */
export function drawSplash(g: Graphics, x: number, y: number, h: number, aim: number, holds: Held = 'gun', look = -1): void {
  const r = h / TALL;
  const lw = 0.11 * r;
  const F = (fx: number, fy: number): Pt => ({ x: x + fx * r, y: y + fy * r });
  const hy = y - 2.17 * r; // the head's centre: the chin rests on the shoulders
  const head = (fx: number, fy: number): Pt => ({ x: x + fx * r, y: hy + fy * r });
  const hairDark = shade(SPLASH.helmet, 0.72);

  // the ponytail, behind the head and swept out to the right, its inner edge in shadow
  const inner = curve(head(1.95, 0.4), head(1.5, -0.5), head(1.0, -0.55));
  const tail = [...curve(head(0.55, -1.2), head(2.3, -1.5), head(1.95, 0.4)), ...inner.slice(1)];
  g.fillStyle(SPLASH.helmet, 1).fillPoints(tail, true);
  g.fillStyle(hairDark, 1).fillPoints([...curve(head(1.0, -0.55), head(1.95, -0.8), head(1.95, 0.4)), ...inner.slice(1, -1)], true);
  g.lineStyle(lw, INK, 1).strokePoints(tail, true);

  // stubby legs in white shoes
  for (const sx of [-1, 1]) {
    g.fillStyle(SKIN, 1).fillRoundedRect(x + (sx * 0.2 - 0.1) * r, y - 0.52 * r, 0.2 * r, 0.4 * r, 0.08 * r);
    g.strokeRoundedRect(x + (sx * 0.2 - 0.1) * r, y - 0.52 * r, 0.2 * r, 0.4 * r, 0.08 * r);
    g.fillStyle(WHITE, 1).fillRoundedRect(x + (sx * 0.24 - 0.18) * r, y - 0.2 * r, 0.36 * r, 0.2 * r, 0.09 * r);
    g.strokeRoundedRect(x + (sx * 0.24 - 0.18) * r, y - 0.2 * r, 0.36 * r, 0.2 * r, 0.09 * r);
  }

  // the arms run from under the top's outline: one bent to the hip, one out to the gun
  const hip = [F(0.34, -1.1), F(0.72, -0.88), F(0.46, -0.66)];
  const reach = [F(-0.34, -1.1), F(HAND.x, HAND.y)];
  g.lineStyle(0.2 * r + 2 * lw, INK, 1).strokePoints(hip, false).strokePoints(reach, false);
  g.lineStyle(0.2 * r, SKIN, 1).strokePoints(hip, false).strokePoints(reach, false);

  // yellow shorts, then the cyan top over their waist, each with its lower part in shadow
  g.fillStyle(shade(COLORS.yellow, 0.78), 1).fillRoundedRect(x - 0.4 * r, y - 0.74 * r, 0.8 * r, 0.3 * r, 0.1 * r);
  g.fillStyle(COLORS.yellow, 1).fillRoundedRect(x - 0.4 * r, y - 0.74 * r, 0.8 * r, 0.17 * r, 0.08 * r);
  g.lineStyle(lw, INK, 1).strokeRoundedRect(x - 0.4 * r, y - 0.74 * r, 0.8 * r, 0.3 * r, 0.1 * r);
  g.fillStyle(shade(SPLASH.suit, 0.72), 1).fillRoundedRect(x - 0.42 * r, y - 1.22 * r, 0.84 * r, 0.54 * r, 0.16 * r);
  g.fillStyle(SPLASH.suit, 1).fillRoundedRect(x - 0.42 * r, y - 1.22 * r, 0.84 * r, 0.32 * r, 0.14 * r);
  g.strokeRoundedRect(x - 0.42 * r, y - 1.22 * r, 0.84 * r, 0.54 * r, 0.16 * r);
  const fist = F(0.46, -0.66);
  g.fillStyle(SKIN, 1).fillCircle(fist.x, fist.y, 0.13 * r);
  g.strokeCircle(fist.x, fist.y, 0.13 * r);

  // what she holds, in its own frame turned about the hand. The water gun: orange body over a
  // cyan tank, a yellow barrel with a white nozzle, the grip in the hand. The bottle comes after
  // the head, which would hide it.
  const hand = F(HAND.x, HAND.y);
  const holding = (): void => {
    g.save().translateCanvas(hand.x, hand.y).rotateCanvas(-aim);
    if (holds === 'bottle') drawBottle(g, BOTTLE_AT.x * r, BOTTLE_AT.y * r, BOTTLE * r);
    if (holds === 'gun') {
      const dark = shade(COLORS.orange, 0.72);
      g.fillStyle(dark, 1).fillRoundedRect(-0.12 * r, -0.1 * r, 0.24 * r, 0.36 * r, 0.07 * r);
      g.strokeRoundedRect(-0.12 * r, -0.1 * r, 0.24 * r, 0.36 * r, 0.07 * r);
      g.fillStyle(COLORS.cyan, 1).fillRoundedRect(-0.92 * r, -0.8 * r, 0.56 * r, 0.44 * r, 0.2 * r);
      g.strokeRoundedRect(-0.92 * r, -0.8 * r, 0.56 * r, 0.44 * r, 0.2 * r);
      g.fillStyle(WHITE, 0.8).fillRoundedRect(-0.82 * r, -0.71 * r, 0.2 * r, 0.09 * r, 0.045 * r);
      g.fillStyle(COLORS.yellow, 1).fillRoundedRect(-1.32 * r, -0.32 * r, 0.38 * r, 0.22 * r, 0.07 * r);
      g.strokeRoundedRect(-1.32 * r, -0.32 * r, 0.38 * r, 0.22 * r, 0.07 * r);
      g.fillStyle(WHITE, 1).fillRoundedRect(-1.42 * r, -0.29 * r, 0.12 * r, 0.16 * r, 0.04 * r);
      g.strokeRoundedRect(-1.42 * r, -0.29 * r, 0.12 * r, 0.16 * r, 0.04 * r);
      g.fillStyle(dark, 1).fillRoundedRect(-1.0 * r, -0.42 * r, 1.3 * r, 0.42 * r, 0.16 * r);
      g.fillStyle(COLORS.orange, 1).fillRoundedRect(-1.0 * r, -0.42 * r, 1.3 * r, 0.25 * r, 0.12 * r);
      g.strokeRoundedRect(-1.0 * r, -0.42 * r, 1.3 * r, 0.42 * r, 0.16 * r);
    }
    g.fillStyle(SKIN, 1).fillCircle(0, 0, 0.14 * r);
    g.lineStyle(lw, INK, 1).strokeCircle(0, 0, 0.14 * r);
    g.restore();
  };
  if (holds !== 'bottle') holding();

  drawHead(g, x, hy, r, SPLASH, lw, look);

  // the fringe: the hair's shadowed underside in three points over the forehead, clear of the
  // brows; its fill covers the cap's lower edge and its own stroke replaces it
  const fringe = [[-1.14, -0.36], [-0.92, -0.1], [-0.5, -0.32], [-0.2, -0.22], [0, -0.08], [0.2, -0.22], [0.5, -0.32], [0.92, -0.1], [1.14, -0.36]].map(([fx, fy]) => head(fx, fy));
  g.fillStyle(hairDark, 1).fillPoints(fringe, true);
  g.lineStyle(lw, INK, 1).strokePoints(fringe, false);
  // the hair tie where the ponytail leaves the head
  const tie = head(1.27, -0.88);
  g.fillStyle(COLORS.yellow, 1).fillRoundedRect(tie.x - 0.11 * r, tie.y - 0.22 * r, 0.22 * r, 0.44 * r, 0.08 * r);
  g.strokeRoundedRect(tie.x - 0.11 * r, tie.y - 0.22 * r, 0.22 * r, 0.44 * r, 0.08 * r);
  if (holds === 'bottle') holding();
}

/** The tilt below level that points the gun of `drawSplash` at `x`, `y`, `h` from her hand at `target`, held between a little above level and twice `GUN_DOWN`. */
export function splashAim(x: number, y: number, h: number, target: Pt): number {
  const r = h / TALL;
  const angle = Math.atan2(target.y - (y + HAND.y * r), x + HAND.x * r - target.x);
  return Math.max(-0.3, Math.min(2 * GUN_DOWN, angle));
}

/** Where a throw leaves `drawSplash` at `x`, `y`, `h` with `aim`, in the same space: the gun's muzzle, or the bottle's centre. */
export function splashRelease(x: number, y: number, h: number, aim: number, holds: 'gun' | 'bottle'): Pt {
  const r = h / TALL;
  const at = holds === 'gun' ? MUZZLE : BOTTLE_AT;
  const cos = Math.cos(aim);
  const sin = Math.sin(aim);
  return {
    x: x + (HAND.x + at.x * cos + at.y * sin) * r,
    y: y + (HAND.y - at.x * sin + at.y * cos) * r,
  };
}

/** The height of the bottle in the hand of `drawSplash` `h` tall, so the thrown one matches it. */
export function splashBottleH(h: number): number {
  return (BOTTLE * h) / TALL;
}

/** The bubble centred at `cx`, `cy`, radius `r`: a cyan film with an inner rim and an ink edge, a white highlight arc and a glint. */
export function drawBubble(g: Graphics, cx: number, cy: number, r: number): void {
  g.fillStyle(COLORS.cyan, 0.35).fillCircle(cx, cy, r);
  g.lineStyle(0.12 * r, COLORS.cyan, 1).strokeCircle(cx, cy, 0.86 * r);
  g.lineStyle(0.1 * r, INK, 1).strokeCircle(cx, cy, r);
  g.lineStyle(0.14 * r, WHITE, 0.9).beginPath().arc(cx, cy, 0.6 * r, 1.08 * Math.PI, 1.5 * Math.PI).strokePath();
  g.fillStyle(WHITE, 0.9).fillCircle(cx + 0.38 * r, cy + 0.36 * r, 0.1 * r);
}

/**
 * Where Splash's shot hits a racer drawn by `drawRacer` at `x`, `y` (its bottom centre), `s`
 * wide, at `lean` -1..1, its Graphics turned `tilt` radians about `x`, `y`: the middle of the
 * head and its headgear, halfway between the head's centre and the headgear's top, so a taller
 * headgear is hit higher. The stun's ring turns round the same point.
 */
export function racerHead(x: number, y: number, s: number, lean: number, tilt: number, character: Character): Pt {
  const hx = HEAD_SLIDE * s * Math.max(-1, Math.min(1, lean));
  const hy = -((HEAD_Y + racerTop(character)) / 2) * s;
  return { x: x + hx * Math.cos(tilt) - hy * Math.sin(tilt), y: y + hx * Math.sin(tilt) + hy * Math.cos(tilt) };
}

/** How far the stun's ring reaches above a racer's bottom centre for `character`, in kart widths, its stars `size` times their size: its top star's tip. */
export function stunTop(character: Character, size = 1): number {
  const ST = C.ui.splash.stun;
  return (HEAD_Y + racerTop(character)) / 2 + ST.lift + ST.ring[1] + ST.starR * size * (1 - ST.depth); // the far side is the top, its stars smallest
}

/**
 * The stunned racer's dizzy ring round its head at `hx`, `hy` (`racerHead`), raised `lift`, for a racer `s`
 * wide: `C.ui.splash.stun`'s stars and drops alternating round a flat ellipse, turned `phase`
 * radians, at `alpha`, the stars and drops `size` times their size (1 in the race). Those on
 * the ring's far side are smaller and drawn by `part` 'back', before the racer, so the helmet
 * hides them; 'front' draws the near side, after it.
 */
export function drawStun(g: Graphics, hx: number, hy: number, s: number, phase: number, alpha: number, part: 'back' | 'front', size = 1): void {
  const ST = C.ui.splash.stun;
  const n = ST.stars + ST.drops;
  const lw = ST.outline * s;
  for (let k = 0; k < n; k++) {
    const a = phase + (2 * Math.PI * k) / n;
    const near = Math.sin(a); // y is down: the near side of the ring is lower on the screen
    if ((near < 0) !== (part === 'back')) continue;
    const scale = size * (1 + ST.depth * near);
    const x = hx + Math.cos(a) * ST.ring[0] * s;
    const y = hy - ST.lift * s + near * ST.ring[1] * s;
    const star = k % 2 === 0 ? k / 2 < ST.stars : (k - 1) / 2 >= ST.drops;
    if (star) {
      const r = ST.starR * s * scale;
      const pts = Array.from({ length: 10 }, (_, i) => {
        const t = -Math.PI / 2 + (i * Math.PI) / 5 + phase;
        const d = i % 2 === 0 ? r : 0.45 * r;
        return { x: x + Math.cos(t) * d, y: y + Math.sin(t) * d };
      });
      g.fillStyle(ST.star, alpha).fillPoints(pts, true).lineStyle(lw * size, INK, alpha).strokePoints(pts, true);
      g.fillStyle(WHITE, alpha).fillCircle(x - ST.twinkle[0] * r, y - ST.twinkle[0] * r, ST.twinkle[1] * r); // the twinkle
    } else {
      drop(g, x, y, ST.dropR * s * scale, lw * size, alpha);
    }
  }
}

/** A drop of water `d` in radius, its point up, centred near `x`, `y`, with an ink edge `lw` and a glint. */
function drop(g: Graphics, x: number, y: number, d: number, lw: number, alpha: number): void {
  const pts: Pt[] = [{ x, y: y - 1.6 * d }];
  for (let i = 0; i <= 6; i++) {
    const a = -0.35 + (i / 6) * (Math.PI + 0.7);
    pts.push({ x: x + d * Math.cos(a), y: y + d * Math.sin(a) });
  }
  g.fillStyle(C.ui.splash.stun.drop, alpha).fillPoints(pts, true).lineStyle(lw, INK, alpha).strokePoints(pts, true);
  g.fillStyle(WHITE, alpha).fillCircle(x - 0.3 * d, y - 0.15 * d, 0.28 * d);
}

/**
 * Splash's bubble breaking on a racer's head at `cx`, `cy`, `t` 0..1 through it, `r` across
 * (`C.ui.splash.burst`): a ball of water that swells and thins out, `drops` droplets flung
 * outward over the white rim, and a few short white impact lines spraying up.
 */
export function drawBurst(g: Graphics, cx: number, cy: number, r: number, t: number): void {
  const B = C.ui.splash.burst;
  const k = 1 - t;
  g.fillStyle(COLORS.cyan, 0.55 * k).fillCircle(cx, cy, r * (0.55 + 0.5 * t));
  for (let i = 0; i < B.lines; i++) {
    const a = -Math.PI / 2 + (i - (B.lines - 1) / 2) * B.fan;
    g.lineStyle(B.lineW * r, WHITE, Math.max(0, 1 - 2 * t));
    g.lineBetween(cx + Math.cos(a) * r * (0.9 + 0.6 * t), cy + Math.sin(a) * r * (0.9 + 0.6 * t), cx + Math.cos(a) * r * (1.3 + 0.9 * t), cy + Math.sin(a) * r * (1.3 + 0.9 * t));
  }
  drawPop(g, cx, cy, r, t, COLORS.cyan, B.drops);
}

/** A landing of radius `r` at `cx`, `cy`, `t` 0..1 through it: a white rim spreads and fades as droplets of `colour` fly out. The bubble's burst on the head in cyan (with `drops` droplets), the bottle's catch in yellow. */
export function drawPop(g: Graphics, cx: number, cy: number, r: number, t: number, colour: number = COLORS.cyan, drops = 6): void {
  const k = 1 - t;
  g.lineStyle(0.16 * r * k + 1, WHITE, k).strokeCircle(cx, cy, r * (1 + 0.6 * t));
  g.fillStyle(colour, k).lineStyle(0.06 * r, INK, k);
  for (let i = 0; i < drops; i++) {
    const a = (i / drops) * 2 * Math.PI + 0.3;
    const d = r * (0.9 + 1.2 * t);
    const dr = 0.2 * r * (0.5 + 0.5 * k);
    g.fillCircle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, dr);
    g.strokeCircle(cx + Math.cos(a) * d, cy + Math.sin(a) * d, dr);
  }
}

/** A water bottle centred at `cx`, `cy`, `h` tall, 0.42 `h` wide: a white cap, a cyan body shadowed down its right side, a white label with a yellow bolt and a glint. */
export function drawBottle(g: Graphics, cx: number, cy: number, h: number): void {
  const lw = 0.05 * h;
  const w = 0.42 * h;
  g.fillStyle(WHITE, 1).fillRoundedRect(cx - 0.15 * h, cy - 0.5 * h, 0.3 * h, 0.14 * h, 0.04 * h);
  g.lineStyle(lw, INK, 1).strokeRoundedRect(cx - 0.15 * h, cy - 0.5 * h, 0.3 * h, 0.14 * h, 0.04 * h);
  g.fillStyle(shade(COLORS.cyan, 0.72), 1).fillRoundedRect(cx - w / 2, cy - 0.38 * h, w, 0.88 * h, 0.12 * h);
  g.fillStyle(COLORS.cyan, 1).fillRoundedRect(cx - w / 2, cy - 0.38 * h, 0.7 * w, 0.88 * h, 0.12 * h);
  g.fillStyle(WHITE, 1).fillRect(cx - w / 2, cy - 0.1 * h, w, 0.34 * h);
  g.strokeRoundedRect(cx - w / 2, cy - 0.38 * h, w, 0.88 * h, 0.12 * h);
  g.lineStyle(0.7 * lw, INK, 1).lineBetween(cx - w / 2, cy - 0.1 * h, cx + w / 2, cy - 0.1 * h).lineBetween(cx - w / 2, cy + 0.24 * h, cx + w / 2, cy + 0.24 * h);
  const bolt = boltPoints(cx, cy + 0.07 * h, 0.13 * h); // centred on the label band
  g.fillStyle(COLORS.yellow, 1).fillPoints(bolt, true);
  g.strokePoints(bolt, true);
  g.fillStyle(WHITE, 0.5).fillRoundedRect(cx - w / 2 + 0.05 * h, cy - 0.32 * h, 0.06 * h, 0.18 * h, 0.03 * h);
}

/** Points along the quadratic curve from `a` through control `c` to `b`, both ends included. */
function curve(a: Pt, c: Pt, b: Pt, n = 8): Pt[] {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = i / n;
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  });
}
