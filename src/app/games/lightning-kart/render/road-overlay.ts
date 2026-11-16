import Phaser from 'phaser';
import { C } from '../engine/constants';
import { stageScale } from '../scenes/widgets';
import { pointAt, tangentAt, wrapDistance } from '../track/geometry';
import { BuiltTrack } from '../track/track-def';
import { Mode7Camera } from './mode7';
import { EDGE_BANDS, edgeNormal, startChecker } from './track-texture';

const UI = C.ui;
const ROAD = UI.road;
const O = ROAD.overlay;
const SW = UI.stage.w;
const SH = UI.stage.h;
const NEAR = C.camera.near;

/** `top` at `alpha` over `under`, channel by channel, the way the canvas composites the texture. */
function over(under: number, top: number, alpha: number): number {
  let out = 0;
  for (const shift of [16, 8, 0]) {
    const a = (under >> shift) & 255;
    const b = (top >> shift) & 255;
    out |= Math.round(a + (b - a) * alpha) << shift;
  }
  return out;
}

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

/** A band across the road at one distance: its centre and the unit tangent there, as the texture's `across` takes them. */
interface Across {
  x: number;
  y: number;
  tx: number;
  ty: number;
}

/** The flat colour of the glow stripe between its soft inner edge and the core, where the texture is even. */
const GLOW = over(ROAD.road[0], ROAD.edgeGlow, ROAD.edgeGlowAlpha);
/** Between the ground's two check tones, so the feather beside the wall matches either. */
const GROUND = over(ROAD.ground[0], ROAD.ground[1], 0.5);

/**
 * The wall with the stripe inside it, the start line and the checkpoint marks, redrawn every
 * frame as flat shapes over the track texture near the eye, so they stay sharp where the
 * texture is magnified many times. They are projected with the mode 7 camera's own maths,
 * clipped at its near plane, and fade out into the texture's own painting with depth and
 * where their thinnest part drops toward a pixel, so far away the mipmaps keep them calm.
 * Each edge facing the road or the ground has a feather of that neighbour's colour, fading
 * out, that hides the texture's soft edge under the sharp one. No spot is drawn twice, so a
 * fading part blends one colour over the texture: the glow is two strips either side of the
 * core, each checker cell is its own, and the stripe is left out where a band crosses it.
 * The shapes come from the texture's own (`edgeNormal`, `EDGE_BANDS`, `startChecker`); the
 * camera maths are a copy of `projectToScreen` in `render/mode7.ts` and change with it. One
 * Graphics, triangles only, at the depth its scene gives; the per-frame state lives in
 * arrays made once.
 */
export class RoadOverlay {
  readonly graphics: Phaser.GameObjects.Graphics;
  /** Centreline samples every `step` units through the texture's points: position, unit normal to the right, half width. */
  private readonly sx: Float64Array;
  private readonly sy: Float64Array;
  private readonly snx: Float64Array;
  private readonly sny: Float64Array;
  private readonly half: Float64Array;
  /** Sample `i` ends a band across the road; the strip from sample `i` to the next lies inside one. */
  private readonly stop: Uint8Array;
  private readonly cut: Uint8Array;
  /** Per frame: each sample's depth, and its alpha on the left and right (`2 * i` and `2 * i + 1`). */
  private readonly depth: Float64Array;
  private readonly alpha: Float64Array;
  /** The bands across the road: the start line, then each checkpoint mark; their half width along the lap; their alpha this frame. */
  private readonly bands: Across[];
  private readonly bandW: number[];
  private readonly bandA: Float64Array;
  private readonly cell: number;
  private readonly cols: number;
  /** Canvas px per stage px. */
  private readonly ratio: number;
  // The camera of this frame: position, height, forward, right and up, focal length in stage px, half width of the view.
  private camX = 0;
  private camY = 0;
  private camH = 0;
  private fx = 0;
  private fy = 0;
  private fz = 0;
  private rx = 0;
  private ry = 0;
  private ux = 0;
  private uy = 0;
  private uz = 0;
  private focal = 1;
  private tanX = 1;
  // The polygon being filled: up to 4 corners in camera space, up to 8 after the near clip.
  private readonly inD = new Float64Array(4);
  private readonly inX = new Float64Array(4);
  private readonly inY = new Float64Array(4);
  private readonly inA = new Float64Array(4);
  private readonly outX = new Float64Array(8);
  private readonly outY = new Float64Array(8);
  private readonly outA = new Float64Array(8);
  private corners = 0;
  private fillColour = -1;
  private fillAlpha = -1;

  constructor(scene: Phaser.Scene, built: BuiltTrack, depth: number) {
    this.graphics = scene.add.graphics().setDepth(depth);
    this.ratio = stageScale(scene);
    const { track, checkpoints } = built;
    const pts = track.line.points;
    const n = pts.length;
    const { cols, cell } = startChecker(pts[0].width);
    this.cols = cols;
    this.cell = cell;
    const centres = [0, ...checkpoints];
    this.bandW = [cell, ...checkpoints.map(() => ROAD.markW / 2)];
    const ends = centres.flatMap((d, b) => [wrapDistance(track, d - this.bandW[b]), wrapDistance(track, d + this.bandW[b])]);
    const inBand = (d: number): boolean =>
      centres.some((c, b) => Math.min(wrapDistance(track, d - c), wrapDistance(track, c - d)) < this.bandW[b]);
    // Samples every `step` along each stretch, and one at each end of a band across the road.
    const at: { i: number; t: number; stop: boolean }[] = [];
    for (let i = 0; i < n; i++) {
      const len = track.cum[i + 1] - track.cum[i];
      const ts = new Map<number, boolean>();
      const per = Math.max(1, Math.round(len / O.step));
      for (let k = 0; k < per; k++) ts.set(k / per, false);
      for (const e of ends) {
        const t = Math.abs(e - track.cum[i]) < 1e-6 ? 0 : (e - track.cum[i]) / len;
        if (t >= 0 && t < 1) ts.set(t, true);
      }
      for (const [t, stop] of [...ts].sort((a, b) => a[0] - b[0])) at.push({ i, t, stop });
    }
    const m = at.length;
    this.sx = new Float64Array(m);
    this.sy = new Float64Array(m);
    this.snx = new Float64Array(m);
    this.sny = new Float64Array(m);
    this.half = new Float64Array(m);
    this.stop = new Uint8Array(m);
    this.cut = new Uint8Array(m);
    this.depth = new Float64Array(m);
    this.alpha = new Float64Array(2 * m);
    // Between the texture's points a Catmull-Rom curve and a blended normal, so a bend has no
    // facets; every texture point is a sample, so the two meet there exactly.
    const normals = pts.map((_, i) => edgeNormal(pts, i));
    const along = (s: number): number => (s < m ? track.cum[at[s].i] + at[s].t * (track.cum[at[s].i + 1] - track.cum[at[s].i]) : track.length);
    at.forEach(({ i, t, stop }, s) => {
      const p0 = pts[(i - 1 + n) % n];
      const p1 = pts[i];
      const p2 = pts[(i + 1) % n];
      const p3 = pts[(i + 2) % n];
      const t2 = t * t;
      const t3 = t2 * t;
      const w0 = -0.5 * t3 + t2 - 0.5 * t;
      const w1 = 1.5 * t3 - 2.5 * t2 + 1;
      const w2 = -1.5 * t3 + 2 * t2 + 0.5 * t;
      const w3 = 0.5 * t3 - 0.5 * t2;
      this.sx[s] = w0 * p0.x + w1 * p1.x + w2 * p2.x + w3 * p3.x;
      this.sy[s] = w0 * p0.y + w1 * p1.y + w2 * p2.y + w3 * p3.y;
      const a = normals[i];
      const b = normals[(i + 1) % n];
      const ax = a.x + (b.x - a.x) * t;
      const ay = a.y + (b.y - a.y) * t;
      const len = Math.hypot(ax, ay) || 1;
      this.snx[s] = ax / len;
      this.sny[s] = ay / len;
      this.half[s] = (p1.width + (p2.width - p1.width) * t) / 2;
      this.stop[s] = stop ? 1 : 0;
      this.cut[s] = inBand((along(s) + along(s + 1)) / 2) ? 1 : 0;
    });
    const across = (d: number): Across => {
      const p = pointAt(track, d);
      const t = tangentAt(track, d);
      return { x: p.x, y: p.y, tx: t.x, ty: t.y };
    };
    this.bands = centres.map(across);
    this.bandA = new Float64Array(this.bands.length);
  }

  /** Redraws everything for this frame's camera; what is behind it, off the sides or too far is left out. */
  update(cam: Mode7Camera): void {
    this.graphics.clear();
    this.fillColour = -1;
    this.setCamera(cam);
    const m = this.sx.length;
    const half = (this.cols * this.cell) / 2;
    const reach = O.fade[1] + 2 * half;
    for (let i = 0; i < m; i++) {
      const d = this.depthOf(this.sx[i], this.sy[i]);
      this.depth[i] = d;
      const near = d > -2 * half && d < reach;
      this.alpha[2 * i] = near ? this.wallAlpha(i, -1) : 0;
      this.alpha[2 * i + 1] = near ? this.wallAlpha(i, 1) : 0;
    }
    for (let b = 0; b < this.bands.length; b++) {
      const { x, y, tx, ty } = this.bands[b];
      const w = this.bandW[b];
      // the start line's thinnest part is one row of its two; a checkpoint mark is one stroke
      this.bandA[b] = this.fade(x - tx * w, y - ty * w, x + tx * w, y + ty * w, b === 0 ? 0.5 : 1);
    }

    // A feather of asphalt either side of each band, up to the stripe's even glow.
    const { glow, core, wall } = EDGE_BANDS;
    const inner = (glow[1] + core[1]) / 2; // inside the glow's even middle, past the core's soft edge
    const halfIn = half - inner;
    for (let b = 0; b < this.bands.length; b++) {
      const a = this.bandA[b];
      const w = this.bandW[b];
      if (a <= 0) continue;
      this.rect(this.bands[b], w, w + O.feather, -halfIn, halfIn, ROAD.road[0], a, 0);
      this.rect(this.bands[b], -w - O.feather, -w, -halfIn, halfIn, ROAD.road[0], 0, a);
    }

    // The edges, both sides: the glow's even middle either side of the bright core (not where
    // a band crosses), the ground's feather and the flat wall; a standing wall goes on in a
    // second pass, over everything on the ground.
    const standing = O.wallH > 0;
    for (let pass = 0; pass < (standing ? 2 : 1); pass++) {
      for (let i = 0, k = 0; i < m; i = k) {
        // every sample near the eye, every second from `lod[0]` deep, every fourth from `lod[1]`,
        // never past a band's end
        const stride = this.depth[i] < O.lod[0] ? 1 : this.depth[i] < O.lod[1] ? 2 : 4;
        k = Math.min(m, i + stride - (i % stride));
        for (let q = i + 1; q < k; q++) {
          if (this.stop[q]) {
            k = q;
            break;
          }
        }
        const j = k % m;
        for (let side = -1; side <= 1; side += 2) {
          if (this.alpha[2 * i + (side + 1) / 2] <= 0 && this.alpha[2 * j + (side + 1) / 2] <= 0) continue;
          const h = this.half[i];
          const foot = h - wall[1];
          const out = h - wall[0];
          if (pass === 1) {
            this.ribbon(i, j, side, foot, 0, foot, 1, ROAD.wall, 1, 1); // the face toward the road
            this.ribbon(i, j, side, foot, 1, out, 1, O.wallTop, 1, 1);
            continue;
          }
          if (!this.cut[i]) {
            this.ribbon(i, j, side, h - inner, 0, h - core[1], 0, GLOW, 1, 1);
            this.ribbon(i, j, side, h - core[1], 0, h - core[0], 0, ROAD.edge, 1, 1);
            this.ribbon(i, j, side, h - core[0], 0, h - glow[0], 0, GLOW, 1, 1);
          }
          this.ribbon(i, j, side, out, 0, out + O.feather, 0, GROUND, 1, 0);
          if (!standing) this.ribbon(i, j, side, foot, 0, out, 0, ROAD.wall, 1, 1);
        }
      }
    }

    // From edge to edge of the road: the start line's checker, cell by cell, and the checkpoint marks.
    const sa = this.bandA[0];
    if (sa > 0) {
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < this.cols; col++) {
          const u = -this.cell + row * this.cell;
          const v = -half + col * this.cell;
          this.rect(this.bands[0], u, u + this.cell, v, v + this.cell, ROAD.startLine[(row + col) & 1], sa, sa);
        }
      }
    }
    for (let b = 1; b < this.bands.length; b++) {
      const a = this.bandA[b];
      if (a > 0) this.rect(this.bands[b], -this.bandW[b], this.bandW[b], -half, half, ROAD.checkpoint, a, a);
    }
  }

  destroy(): void {
    this.graphics.destroy();
  }

  private setCamera(cam: Mode7Camera): void {
    const cp = Math.cos(cam.pitch);
    const sp = Math.sin(cam.pitch);
    const cy = Math.cos(cam.yaw);
    const sy = Math.sin(cam.yaw);
    this.camX = cam.x;
    this.camY = cam.y;
    this.camH = cam.height;
    this.fx = cy * cp;
    this.fy = sy * cp;
    this.fz = -sp;
    this.rx = -sy;
    this.ry = cy;
    this.ux = cy * sp;
    this.uy = sy * sp;
    this.uz = cp;
    const tanHalf = Math.tan((cam.fovDeg * Math.PI) / 360);
    this.focal = SH / 2 / tanHalf;
    this.tanX = (tanHalf * SW) / SH;
  }

  /** Depth of a ground point along the view. */
  private depthOf(x: number, y: number): number {
    return (x - this.camX) * this.fx + (y - this.camY) * this.fy - this.camH * this.fz;
  }

  /** The wall's alpha at sample `i` on `side`, from its depth and how thin its stripe's core looks there. */
  private wallAlpha(i: number, side: number): number {
    const h = this.half[i];
    const nx = this.snx[i] * side;
    const ny = this.sny[i] * side;
    const x = this.sx[i];
    const y = this.sy[i];
    return this.fade(x + nx * h, y + ny * h, x + nx * (h + ROAD.wallW), y + ny * (h + ROAD.wallW), ROAD.edgeW / ROAD.wallW);
  }

  /**
   * The alpha of a feature measured across two ground points `a` and `b`: full near the eye,
   * fading between `fade` deep, and fading where its thinnest part, `share` of the span
   * between them on screen, drops from `thinPx[1]` to `thinPx[0]` canvas px.
   */
  private fade(ax: number, ay: number, bx: number, by: number, share: number): number {
    const da = this.depthOf(ax, ay);
    const db = this.depthOf(bx, by);
    if (da < NEAR || db < NEAR) return 1; // over the eye: as near as it gets
    const k = this.focal * this.ratio;
    const xa = ((ax - this.camX) * this.rx + (ay - this.camY) * this.ry) / da;
    const xb = ((bx - this.camX) * this.rx + (by - this.camY) * this.ry) / db;
    const ya = ((ax - this.camX) * this.ux + (ay - this.camY) * this.uy - this.camH * this.uz) / da;
    const yb = ((bx - this.camX) * this.ux + (by - this.camY) * this.uy - this.camH * this.uz) / db;
    const px = Math.hypot(xa - xb, ya - yb) * k * share;
    return smoothstep(O.thinPx[0], O.thinPx[1], px) * (1 - smoothstep(O.fade[0], O.fade[1], (da + db) / 2));
  }

  /**
   * A strip along the lap from sample `j` to `k` on `side`, between offsets `o1` and `o2`
   * from the centreline, each raised by `up` times the wall's height (scaled by the alpha
   * there, so a standing wall lies down as it fades), alpha times `f1` and `f2` at each offset.
   */
  private ribbon(j: number, k: number, side: number, o1: number, up1: number, o2: number, up2: number, colour: number, f1: number, f2: number): void {
    const aj = this.alpha[2 * j + (side + 1) / 2];
    const ak = this.alpha[2 * k + (side + 1) / 2];
    const hj = O.wallH * aj;
    const hk = O.wallH * ak;
    this.corners = 0;
    this.corner(this.sx[j] + this.snx[j] * side * o1, this.sy[j] + this.sny[j] * side * o1, up1 * hj, aj * f1);
    this.corner(this.sx[j] + this.snx[j] * side * o2, this.sy[j] + this.sny[j] * side * o2, up2 * hj, aj * f2);
    this.corner(this.sx[k] + this.snx[k] * side * o2, this.sy[k] + this.sny[k] * side * o2, up2 * hk, ak * f2);
    this.corner(this.sx[k] + this.snx[k] * side * o1, this.sy[k] + this.sny[k] * side * o1, up1 * hk, ak * f1);
    this.fill(colour);
  }

  /** A rectangle in band `at`'s frame, `u` along the lap and `v` across it (positive right), alpha `a1` at `u1` and `a2` at `u2`. */
  private rect(at: Across, u1: number, u2: number, v1: number, v2: number, colour: number, a1: number, a2: number): void {
    const { x, y, tx, ty } = at;
    const nx = -ty;
    const ny = tx;
    this.corners = 0;
    this.corner(x + tx * u1 + nx * v1, y + ty * u1 + ny * v1, 0, a1);
    this.corner(x + tx * u2 + nx * v1, y + ty * u2 + ny * v1, 0, a2);
    this.corner(x + tx * u2 + nx * v2, y + ty * u2 + ny * v2, 0, a2);
    this.corner(x + tx * u1 + nx * v2, y + ty * u1 + ny * v2, 0, a1);
    this.fill(colour);
  }

  private corner(x: number, y: number, z: number, a: number): void {
    const i = this.corners++;
    const qx = x - this.camX;
    const qy = y - this.camY;
    const qz = z - this.camH;
    this.inD[i] = qx * this.fx + qy * this.fy + qz * this.fz;
    this.inX[i] = qx * this.rx + qy * this.ry;
    this.inY[i] = qx * this.ux + qy * this.uy + qz * this.uz;
    this.inA[i] = a;
  }

  /** Clips the corners at the near plane, leaves out a polygon wholly off one side, and fills it as a fan. */
  private fill(colour: number): void {
    const n = this.corners;
    let m = 0;
    let left = true;
    let right = true;
    let shown = false;
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n;
      const di = this.inD[i];
      const dj = this.inD[j];
      if (di >= NEAR) m = this.emit(m, di, this.inX[i], this.inY[i], this.inA[i]);
      if (di >= NEAR !== dj >= NEAR) {
        const t = (NEAR - di) / (dj - di);
        m = this.emit(m, NEAR, this.inX[i] + (this.inX[j] - this.inX[i]) * t, this.inY[i] + (this.inY[j] - this.inY[i]) * t, this.inA[i] + (this.inA[j] - this.inA[i]) * t);
      }
    }
    if (m < 3) return;
    for (let i = 0; i < m; i++) {
      const x = (this.outX[i] - SW / 2) / this.focal; // back to x over depth
      if (x > -this.tanX) left = false;
      if (x < this.tanX) right = false;
      if (this.outA[i] > 0.002) shown = true;
    }
    if (left || right || !shown) return;
    const g = this.graphics;
    const a0 = this.outA[0];
    let even = true;
    for (let i = 1; i < m; i++) if (Math.abs(this.outA[i] - a0) > 0.002) even = false;
    if (even && (colour !== this.fillColour || a0 !== this.fillAlpha)) {
      g.fillStyle(colour, a0);
      this.fillColour = colour;
      this.fillAlpha = a0;
    }
    for (let i = 1; i < m - 1; i++) {
      if (!even) {
        g.fillGradientStyle(colour, colour, colour, colour, a0, this.outA[i], this.outA[i + 1], a0);
        this.fillColour = -1;
      }
      g.fillTriangle(this.outX[0], this.outY[0], this.outX[i], this.outY[i], this.outX[i + 1], this.outY[i + 1]);
    }
  }

  /** Projects one clipped corner to the stage into slot `m`; returns the next slot. */
  private emit(m: number, d: number, x: number, y: number, a: number): number {
    this.outX[m] = SW / 2 + (x / d) * this.focal;
    this.outY[m] = SH / 2 - (y / d) * this.focal;
    this.outA[m] = a;
    return m + 1;
  }
}
