import Phaser from 'phaser';
import { C } from '../engine/constants';

const CR = C.ui.streak.crackle;
type Pt = { x: number; y: number };

/**
 * The Lightning tier's crackle: thin jagged arcs of electricity that snap on over the racer,
 * hold a few frames and go. Each of `CR.arcs` slots has its own rhythm: a period, and in each
 * period an arc that lives `CR.life` ms from a kink-for-kink shape of its own; all of it comes
 * from race time and a repeatable noise, so the same moment looks the same on every machine.
 * An arc runs between two points on or just off an ellipse round the racer's middle (`CR.hug`):
 * a short way round it, over the helmet, the shoulders or down a side, or now and then
 * straight across in front; some carry one short fork. Each slot starts its arcs in its own
 * sector of the ellipse, so they spread round the racer. Each arc is stroked with every one of
 * `CR.strokes`: a wide faint blue glow, a narrower brighter one and a thin white core. Under
 * reduced motion the first slot always shows an arc and every slot holds its arc for a whole
 * `CR.calmMs`, the slots changing one at a time.
 * Its own Graphics over the kart, like the badge, outside the racer's draw budgets: at most
 * `arcs * (segments + forkSegments)` segments per stroke.
 */
export class Crackle {
  private readonly g: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene, private readonly calm: boolean) {
    this.g = scene.add.graphics().setVisible(false);
  }

  get shown(): boolean {
    return this.g.visible;
  }

  /** The arcs round `x`, `y`, the racer's middle on the stage, for a kart `s` stage px wide (the behind view's width at its depth), at race time `nowMs`, at `depth`. */
  show(x: number, y: number, s: number, nowMs: number, depth: number): void {
    const arcs: Pt[][] = [];
    for (let i = 0; i < CR.arcs; i++) {
      const cycle = this.cycle(i, nowMs);
      if (cycle !== null) arcs.push(...arc(x, y, s, cycle, i));
    }
    const g = this.g.clear().setVisible(true).setDepth(depth);
    for (const [w, colour, alpha] of CR.strokes) {
      g.lineStyle(Math.max(1, w * s), colour, alpha);
      for (const points of arcs) g.strokePoints(points);
    }
  }

  hide(): void {
    this.g.setVisible(false);
  }

  /** Slot `i`'s cycle number at `nowMs` while its arc is on, or null while it is off. */
  private cycle(i: number, nowMs: number): number | null {
    if (this.calm) {
      const bucket = Math.floor((nowMs + (i * CR.calmMs) / CR.arcs) / CR.calmMs);
      return i === 0 || noise(bucket, i, 7) < CR.calmOn ? bucket : null;
    }
    const period = lerp(CR.period, noise(i, 0, 11));
    const t = nowMs + noise(i, 0, 12) * period;
    const cycle = Math.floor(t / period);
    return t - cycle * period < lerp(CR.life, noise(cycle, i, 13)) ? cycle : null;
  }
}

/** The arc of slot `i` in `cycle`, and its fork when it has one, as polylines round `x`, `y` for a kart `s` wide. */
function arc(x: number, y: number, s: number, cycle: number, i: number): Pt[][] {
  const n = (k: number): number => noise(cycle, i, k);
  const on = (angle: number, out: number): Pt => ({ x: x + Math.cos(angle) * CR.hug[0] * s * out, y: y + Math.sin(angle) * CR.hug[1] * s * out });
  // somewhere in the slot's own sector of the ellipse, the bottom (a quarter turn, y down) left out
  const a0 = Math.PI / 2 + CR.skip / 2 + ((i + n(1)) / CR.arcs) * (2 * Math.PI - CR.skip);
  const across = n(3) < CR.cross;
  // most arcs run up the body, away from the bottom: on the left half that is a growing angle
  const up = (a0 - Math.PI / 2 + 2 * Math.PI) % (2 * Math.PI) < Math.PI ? 1 : -1;
  const a1 = across ? a0 + Math.PI + (n(4) - 0.5) * CR.span[0] : a0 + (n(4) < CR.rise ? up : -up) * lerp(CR.span, n(5));
  const from = on(a0, lerp(CR.off, n(2)));
  const to = on(a1, across ? CR.off[0] : lerp(CR.off, n(6)));
  const main = jag(from, to, CR.segments, (k) => n(20 + k));
  if (n(8) >= CR.fork) return [main];
  // one short fork off a kink, turned off the arc's line
  const at = main[1 + Math.floor(n(9) * (CR.segments - 1))];
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const turn = (n(10) < 0.5 ? -1 : 1) * lerp(CR.forkTurn, n(11));
  const len = CR.forkLength;
  const end = { x: at.x + (dx * Math.cos(turn) - dy * Math.sin(turn)) * len, y: at.y + (dx * Math.sin(turn) + dy * Math.cos(turn)) * len };
  return [main, jag(at, end, CR.forkSegments, (k) => n(40 + k))];
}

/** A jagged line from `a` to `b` in `segments` pieces, each inner point kicked off the line by up to `CR.kink` of a piece's length either way. */
function jag(a: Pt, b: Pt, segments: number, rand: (k: number) => number): Pt[] {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy) || 1;
  const kick = (CR.kink * len) / segments;
  return Array.from({ length: segments + 1 }, (_, k) => {
    const f = k / segments;
    const off = k === 0 || k === segments ? 0 : (rand(k) - 0.5) * 2 * kick;
    return { x: a.x + dx * f - (dy / len) * off, y: a.y + dy * f + (dx / len) * off };
  });
}

function lerp([lo, hi]: readonly [number, number], f: number): number {
  return lo + (hi - lo) * f;
}

/** A repeatable number in [0, 1) from three integers. */
function noise(a: number, b: number, c: number): number {
  const h = Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453;
  return h - Math.floor(h);
}
