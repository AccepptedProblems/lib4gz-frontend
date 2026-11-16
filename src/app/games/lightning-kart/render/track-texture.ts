import Phaser from 'phaser';
import { C, cssHex } from '../engine/constants';
import { bounds, pointAt, tangentAt, Track, Vec } from '../track/geometry';
import { BuiltTrack } from '../track/track-def';

/** A top-down texture of the track in Phaser's texture manager and how world units map onto it. */
export interface TrackTexture {
  key: string;
  /** Texture pixels per world unit. */
  scale: number;
  /** World coordinates of the texture's top-left pixel. */
  originX: number;
  originY: number;
  width: number;
  height: number;
  /** World units the whole texture covers. */
  worldW: number;
  worldH: number;
}

const ROAD = C.ui.road;
const W = C.world;

/** The unit normal to the right at centreline point `i`, across the chord between its neighbours: every edge offset runs along it. */
export function edgeNormal(pts: Vec[], i: number): Vec {
  const n = pts.length;
  const a = pts[(i - 1 + n) % n];
  const c = pts[(i + 1) % n];
  const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
  return { x: -(c.y - a.y) / len, y: (c.x - a.x) / len };
}

/** The stripe's glow and core and the wall, each as the insets in from the road edge it spans (negative is outside the road). */
export const EDGE_BANDS = {
  glow: [0, ROAD.edgeGlowW],
  core: [0.5 * ROAD.edgeW, 1.5 * ROAD.edgeW],
  wall: [-ROAD.wallW, 0],
} as const;

/** The start line's checker across a road `width` wide: `cols` cells near `startCell` that span it exactly, so it never paints over the wall; cell (row, col) takes `startLine[(row + col) & 1]`. */
export function startChecker(width: number): { cols: number; cell: number } {
  const cols = Math.round(width / ROAD.startCell);
  return { cols, cell: width / cols };
}

/**
 * The paving's flat-top hexagon cells, `C.ui.road.paving.cell` from centre to corner, odd
 * columns half a row down, whose centre lies within `radius` of `p`: grid index and centre.
 */
export function pavingCellsNear(p: Vec, radius: number): { col: number; row: number; x: number; y: number }[] {
  const r = ROAD.paving.cell;
  const colW = 1.5 * r;
  const rowH = Math.sqrt(3) * r;
  const out: { col: number; row: number; x: number; y: number }[] = [];
  for (let col = Math.floor((p.x - radius) / colW); col * colW <= p.x + radius; col++) {
    const shift = col & 1 ? rowH / 2 : 0;
    for (let row = Math.floor((p.y - radius - shift) / rowH); row * rowH + shift <= p.y + radius; row++) {
      const x = col * colW;
      const y = row * rowH + shift;
      if (Math.hypot(x - p.x, y - p.y) <= radius) out.push({ col, row, x, y });
    }
  }
  return out;
}

function pow2(n: number): number {
  return 2 ** Math.ceil(Math.log2(n));
}

/**
 * Where a track's texture starts in the world and its size in px: the track's bounds plus
 * `texMargin` and a road width on every side, at `texScale`, padded right and down to a
 * power of two, so Phaser generates mipmaps on every upload and the far road is sampled
 * through them (the mode 7 view asks for the mipmap filter).
 */
export function textureSize(track: Track): { originX: number; originY: number; width: number; height: number } {
  const b = bounds(track);
  const m = W.texMargin + W.roadWidth;
  return {
    originX: b.minX - m,
    originY: b.minY - m,
    width: pow2(Math.ceil((b.maxX - b.minX + 2 * m) * W.texScale)),
    height: pow2(Math.ceil((b.maxY - b.minY + 2 * m) * W.texScale)),
  };
}

/**
 * Rasterises a track once per game under `key`, so one key per track: a texture already
 * under `key` is kept as it is. All of `trackTexturePasses` in one go; the Debug scene and a
 * race started without the Ready scene's loading use it.
 */
export function createTrackTexture(scene: Phaser.Scene, key: string, built: BuiltTrack): TrackTexture {
  const { texture, passes } = trackTexturePasses(scene, key, built);
  passes.forEach((pass) => pass());
  return texture;
}

/**
 * The track's texture and the passes that draw it, to run in order: the dusk ground with a
 * faint check, the road, its faint hex paving, the dashed lane lines, the glowing stripe
 * along both road edges, the wall, the start line checker and a thin line at each
 * checkpoint, then the upload. Drawn in world units through a canvas transform onto a
 * power-of-two canvas from Phaser's canvas pool, taken in the first pass (so a canvas the
 * browser refuses throws there), which joins the texture manager under `key` only in the
 * last pass, its one upload: passes left unrun leave nothing under `key`. The texture's
 * destroy gives the canvas back to the pool, shrunk to 1 px; `release` does so for a build
 * left unfinished and does nothing after the upload. The upload drops the copy of every
 * pixel that Phaser's `CanvasTexture` takes when it is made: only its `getPixel`,
 * `getPixels` and `update` read it, and nothing calls them on this texture (a lost WebGL
 * context is restored from the canvas). The Ready scene runs one pass per frame
 * (`scenes/loading.ts`). No passes when `key` already has a texture.
 */
export function trackTexturePasses(scene: Phaser.Scene, key: string, built: BuiltTrack): { texture: TrackTexture; passes: (() => void)[]; release: () => void } {
  const { track, checkpoints } = built;
  const scale = W.texScale;
  const { originX, originY, width, height } = textureSize(track);
  const worldW = width / scale;
  const worldH = height / scale;
  const texture = { key, scale, originX, originY, width, height, worldW, worldH };
  if (scene.textures.exists(key)) return { texture, passes: [], release: () => {} };
  let canvas: HTMLCanvasElement | null = null;
  let ctx!: CanvasRenderingContext2D;
  let uploaded = false;
  const release = (): void => {
    if (canvas && !uploaded) Phaser.Display.Canvas.CanvasPool.remove(canvas);
    canvas = null;
  };

  // the canvas, as `textures.createCanvas` takes it, then the ground with a check, so it reads as moving
  const ground = (): void => {
    canvas = Phaser.Display.Canvas.CanvasPool.create(scene.textures, width, height, Phaser.CANVAS, true);
    const context = canvas.getContext('2d', { willReadFrequently: true }); // as `CanvasTexture` asks for it
    if (!context) throw new Error('could not create the track texture');
    ctx = context;
    ctx.setTransform(scale, 0, 0, scale, -originX * scale, -originY * scale);
    ctx.fillStyle = cssHex(ROAD.ground[0]);
    ctx.fillRect(originX, originY, worldW, worldH);
    ctx.fillStyle = cssHex(ROAD.ground[1]);
    const cell = 16;
    for (let gx = Math.floor(originX / cell); gx * cell < originX + worldW; gx++) {
      for (let gy = Math.floor(originY / cell); gy * cell < originY + worldH; gy++) {
        if ((gx + gy) & 1) ctx.fillRect(gx * cell, gy * cell, cell, cell);
      }
    }
  };

  // edges: a point each side of every centreline point
  const pts = track.line.points;
  const n = pts.length;
  const edge = (i: number, offset: number): { x: number; y: number } => {
    const nrm = edgeNormal(pts, i);
    return { x: pts[i].x + nrm.x * offset, y: pts[i].y + nrm.y * offset };
  };
  // One point past the end on both sides, so the band covers the last segment into the line too.
  const ribbon = (half: (i: number) => number): void => {
    ctx.beginPath();
    for (let i = 0; i <= n; i++) {
      const p = edge(i % n, -half(i % n));
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    for (let i = n; i >= 0; i--) {
      const p = edge(i % n, half(i % n));
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  };

  const road = (): void => {
    ribbon((i) => pts[i].width / 2);
    ctx.fillStyle = cssHex(ROAD.road[0]);
    ctx.fill();
  };

  // the paving: a faint lattice of large flat-top hexagons, clipped to the road, every edge in
  // one path so a shared edge is stroked once and the lattice stays one even tone
  const paving = (): void => {
    const pav = ROAD.paving;
    ctx.save();
    ribbon((i) => pts[i].width / 2);
    ctx.clip();
    ctx.globalAlpha = pav.alpha;
    ctx.strokeStyle = cssHex(pav.line);
    ctx.lineWidth = pav.lineW;
    ctx.lineJoin = 'round';
    ctx.beginPath();
    const r = pav.cell;
    const colW = 1.5 * r;
    const rowH = Math.sqrt(3) * r;
    // Only the cells whose centre is within `reach` of a centreline point go in the path: the
    // clip hides every other one, and leaving them out makes this pass, once the slowest by
    // far, about fifty times faster. A texel the clip lets through lies within half the road plus half the
    // ribbon edge's longest step of a centreline point, and that step is the largest gap
    // between neighbouring points times 1 + half the road over the bend's radius, under 2
    // while no bend is tighter than half the road; a cell inks within its radius, half a line
    // and a texel of antialiasing of its centre.
    const gap = Math.max(...pts.map((p, i) => Math.hypot(pts[(i + 1) % n].x - p.x, pts[(i + 1) % n].y - p.y)));
    const reach = Math.max(...pts.map((p) => p.width)) / 2 + gap + r + pav.lineW / 2 + 1 / scale;
    const near = new Set<string>();
    for (const p of pts) for (const c of pavingCellsNear(p, reach)) near.add(`${c.col},${c.row}`);
    for (let col = Math.floor(originX / colW) - 1; col * colW < originX + worldW + colW; col++) {
      const cx = col * colW;
      const shift = col & 1 ? rowH / 2 : 0;
      for (let row = Math.floor(originY / rowH) - 1; row * rowH < originY + worldH + rowH; row++) {
        if (!near.has(`${col},${row}`)) continue;
        const cy = row * rowH + shift;
        for (let k = 0; k < 6; k++) {
          const a = (k * Math.PI) / 3;
          const x = cx + r * Math.cos(a);
          const y = cy + r * Math.sin(a);
          if (k === 0) ctx.moveTo(x, y); else ctx.lineTo(x, y);
        }
        ctx.closePath();
      }
    }
    ctx.stroke();
    ctx.restore();
  };

  // the lane lines: dashed, along the offset of every centreline point so they bend with the
  // road; each line's dash period is stretched to a whole number round its own length, so
  // the pattern meets itself at the start line
  const laneLines = (): void => {
    const lane = ROAD.lane;
    ctx.globalAlpha = lane.alpha;
    ctx.strokeStyle = cssHex(lane.line);
    ctx.lineWidth = lane.lineW;
    ctx.lineCap = 'butt';
    for (let k = 1; k < W.lanes; k++) {
      const line = pts.map((p, i) => edge(i, (k / W.lanes - 0.5) * p.width));
      const length = line.reduce((sum, p, i) => sum + Math.hypot(p.x - line[(i + 1) % n].x, p.y - line[(i + 1) % n].y), 0);
      const stretch = length / Math.max(1, Math.round(length / (lane.dash + lane.gap))) / (lane.dash + lane.gap);
      ctx.setLineDash([lane.dash * stretch, lane.gap * stretch]);
      ctx.beginPath();
      line.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
      ctx.closePath();
      ctx.stroke();
    }
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  };

  // the glowing stripe just inside both road edges, all the way round: a wide soft stroke
  // under a thin bright core
  const band = (side: number, [from, to]: readonly number[]): void => {
    ctx.lineWidth = to - from;
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = edge(i, side * (pts[i].width / 2 - (from + to) / 2));
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
    ctx.stroke();
  };
  const stripes = (): void => {
    ctx.lineJoin = 'round';
    for (const side of [-1, 1]) {
      ctx.globalAlpha = ROAD.edgeGlowAlpha;
      ctx.strokeStyle = cssHex(ROAD.edgeGlow);
      band(side, EDGE_BANDS.glow);
      ctx.globalAlpha = 1;
      ctx.strokeStyle = cssHex(ROAD.edge);
      band(side, EDGE_BANDS.core);
    }
  };

  // the wall, just outside the road edge: one loop per side, since stroking the closed ribbon
  // would also draw its joins across the road
  const wall = (): void => {
    ctx.strokeStyle = cssHex(ROAD.wall);
    for (const side of [-1, 1]) band(side, EDGE_BANDS.wall);
  };

  // across the road at a distance: the start line checker and the checkpoint marks
  const across = (d: number, draw: (half: number) => void): void => {
    const p = pointAt(track, d);
    const t = tangentAt(track, d);
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(Math.atan2(t.y, t.x));
    draw(pts[0].width / 2);
    ctx.restore();
  };
  const marks = (): void => {
    across(0, (half) => {
      const { cols, cell: cellSize } = startChecker(2 * half);
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < cols; col++) {
          ctx.fillStyle = cssHex(ROAD.startLine[(row + col) & 1]);
          ctx.fillRect(-cellSize + row * cellSize, -half + col * cellSize, cellSize, cellSize);
        }
      }
    });
    for (const d of checkpoints) {
      across(d, (half) => {
        ctx.fillStyle = cssHex(ROAD.checkpoint);
        ctx.fillRect(-ROAD.markW / 2, -half, ROAD.markW, 2 * half);
      });
    }
  };

  // the one upload, with mipmaps, then the pixel copy dropped
  const upload = (): void => {
    const added = scene.textures.addCanvas(key, canvas!);
    uploaded = true;
    if (added) Object.assign(added, { imageData: null, data: null, pixels: null, buffer: null });
  };

  return { texture, passes: [ground, road, paving, laneLines, stripes, wall, marks, upload], release };
}
