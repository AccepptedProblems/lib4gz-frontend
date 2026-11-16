// Track geometry: a closed centreline of points with a road width each, in world units
// (y down, as on the texture), and the queries the engine and the renderer need. No Phaser.

export interface Vec {
  x: number;
  y: number;
}

export interface TrackPoint extends Vec {
  /** Full road width at this point. */
  width: number;
}

/** A closed polyline: the last point joins the first. */
export interface Centreline {
  points: TrackPoint[];
}

export interface Track {
  line: Centreline;
  length: number;
  /** Distance along the line at each point; `cum[n]` is the total length. */
  cum: number[];
  /** Signed curvature at each point, 1/units; positive bends right (clockwise on the texture). */
  curvature: number[];
}

export interface Nearest {
  /** Distance along the line of the foot point. */
  d: number;
  /** Signed distance across the road: positive to the right of the tangent. */
  offset: number;
  /** The foot point and the unit tangent there. */
  x: number;
  y: number;
  tx: number;
  ty: number;
  /** Half road width at the foot point. */
  half: number;
}

export function createTrack(line: Centreline): Track {
  const pts = line.points;
  const n = pts.length;
  if (n < 3) throw new Error('a track needs at least three points');
  const cum = [0];
  for (let i = 0; i < n; i++) cum.push(cum[i] + dist(pts[i], pts[(i + 1) % n]));
  const curvature = pts.map((_, i) => {
    const a = pts[(i - 1 + n) % n];
    const b = pts[i];
    const c = pts[(i + 1) % n];
    const h1 = Math.atan2(b.y - a.y, b.x - a.x);
    const h2 = Math.atan2(c.y - b.y, c.x - b.x);
    return wrapAngle(h2 - h1) / ((dist(a, b) + dist(b, c)) / 2);
  });
  return { line, length: cum[n], cum, curvature };
}

export function wrapAngle(a: number): number {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
}

export function wrapDistance(t: Track, d: number): number {
  const L = t.length;
  return ((d % L) + L) % L;
}

/** Forward distance from `from` to `to` along the lap, in [0, length). */
export function forwardGap(t: Track, from: number, to: number): number {
  return wrapDistance(t, to - from);
}

function dist(a: Vec, b: Vec): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

/** Index of the segment holding distance `d` and the fraction along it. */
function locate(t: Track, d: number): { i: number; f: number } {
  const dd = wrapDistance(t, d);
  const cum = t.cum;
  let lo = 0;
  let hi = cum.length - 2;
  while (lo < hi) {
    const mid = (lo + hi + 1) >> 1;
    if (cum[mid] <= dd) lo = mid; else hi = mid - 1;
  }
  const len = cum[lo + 1] - cum[lo];
  return { i: lo, f: len > 0 ? (dd - cum[lo]) / len : 0 };
}

export function pointAt(t: Track, d: number): Vec {
  const { i, f } = locate(t, d);
  const a = t.line.points[i];
  const b = t.line.points[(i + 1) % t.line.points.length];
  return { x: a.x + (b.x - a.x) * f, y: a.y + (b.y - a.y) * f };
}

export function tangentAt(t: Track, d: number): Vec {
  const { i } = locate(t, d);
  const a = t.line.points[i];
  const b = t.line.points[(i + 1) % t.line.points.length];
  const len = dist(a, b) || 1;
  return { x: (b.x - a.x) / len, y: (b.y - a.y) / len };
}

export function widthAt(t: Track, d: number): number {
  const { i, f } = locate(t, d);
  const a = t.line.points[i];
  const b = t.line.points[(i + 1) % t.line.points.length];
  return a.width + (b.width - a.width) * f;
}

/** The nearest point on the centreline to `p`, by projecting onto every segment. */
export function nearest(t: Track, p: Vec): Nearest {
  const pts = t.line.points;
  const n = pts.length;
  let best = Infinity;
  let bi = 0;
  let bf = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1;
    const f = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / len2));
    const fx = a.x + dx * f;
    const fy = a.y + dy * f;
    const d2 = (p.x - fx) ** 2 + (p.y - fy) ** 2;
    if (d2 < best) {
      best = d2;
      bi = i;
      bf = f;
    }
  }
  const a = pts[bi];
  const b = pts[(bi + 1) % n];
  const len = dist(a, b) || 1;
  const tx = (b.x - a.x) / len;
  const ty = (b.y - a.y) / len;
  const x = a.x + (b.x - a.x) * bf;
  const y = a.y + (b.y - a.y) * bf;
  // right of the tangent, with y down, is (-ty, tx)
  const offset = (p.x - x) * -ty + (p.y - y) * tx;
  return { d: t.cum[bi] + len * bf, offset, x, y, tx, ty, half: (a.width + (b.width - a.width) * bf) / 2 };
}

/** A world point from a distance along the lap and an offset across it (positive right). */
export function worldAt(t: Track, d: number, offset: number): Vec {
  const p = pointAt(t, d);
  const tg = tangentAt(t, d);
  return { x: p.x - tg.y * offset, y: p.y + tg.x * offset };
}

export function bounds(t: Track): { minX: number; minY: number; maxX: number; maxY: number } {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const p of t.line.points) {
    b.minX = Math.min(b.minX, p.x);
    b.minY = Math.min(b.minY, p.y);
    b.maxX = Math.max(b.maxX, p.x);
    b.maxY = Math.max(b.maxY, p.y);
  }
  return b;
}

// ── Laying a track out ──

/** A straight of `len` units, or an arc of `deg` degrees (positive turns right) with radius `r`. */
export type Piece = { straight: number } | { deg: number; r: number };

/**
 * Walks the pieces from the origin heading +x, sampling a point every `spacing` units, then
 * closes the loop: the walk must end heading +x somewhere west of the origin, and two equal
 * gentle arcs plus a straight bring it back. The closing section is the finish straight.
 */
export function layout(pieces: Piece[], width: number, spacing: number): TrackPoint[] {
  const pts: TrackPoint[] = [];
  let x = 0;
  let y = 0;
  let h = 0;
  const walk = (piece: Piece): void => {
    if ('straight' in piece) {
      const steps = Math.max(1, Math.round(piece.straight / spacing));
      for (let i = 0; i < steps; i++) {
        pts.push({ x, y, width });
        x += Math.cos(h) * (piece.straight / steps);
        y += Math.sin(h) * (piece.straight / steps);
      }
    } else {
      const total = (piece.deg * Math.PI) / 180;
      const len = Math.abs(total) * piece.r;
      const steps = Math.max(2, Math.round(len / spacing));
      const dh = total / steps;
      const step = len / steps;
      for (let i = 0; i < steps; i++) {
        pts.push({ x, y, width });
        // advance along the chord of this small arc
        x += Math.cos(h + dh / 2) * step;
        y += Math.sin(h + dh / 2) * step;
        h += dh;
      }
    }
  };
  pieces.forEach(walk);
  if (Math.abs(wrapAngle(h)) > 1e-6) throw new Error(`the layout must end heading +x, ends at ${h}`);
  if (x >= -spacing) throw new Error(`the layout must end west of the origin, ends at ${x.toFixed(0)}, ${y.toFixed(0)}`);
  const gap = -x;
  const rise = -y; // positive when the end is above the origin, so the first arc turns right (down)
  if (Math.abs(rise) > 1e-6) {
    const span = gap * 0.7;
    const phi = 2 * Math.atan(Math.abs(rise) / span);
    const r = span / (2 * Math.sin(phi));
    const deg = (phi * 180) / Math.PI * Math.sign(rise);
    walk({ deg, r });
    walk({ deg: -deg, r });
    walk({ straight: gap - span });
  } else {
    walk({ straight: gap });
  }
  return pts;
}
