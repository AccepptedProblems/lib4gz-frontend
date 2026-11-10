import Phaser from 'phaser';
import { C } from '../engine/constants';
import { bounds, pointAt, tangentAt } from '../track/geometry';
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
  /** The canvas behind the texture, with its context set to draw in world units. Call `refresh()` after drawing on it. */
  canvas: Phaser.Textures.CanvasTexture;
}

const ROAD = C.ui.road;
const W = C.world;

function css(colour: number): string {
  return `#${colour.toString(16).padStart(6, '0')}`;
}

/**
 * Rasterises a track once: grass with a faint check, the sand verge, the road, kerbs where
 * the curvature passes the hard-corner threshold, the start line checker and, in a debug
 * colour, a thin line at each checkpoint. Drawn in world units through a canvas transform.
 */
export function createTrackTexture(scene: Phaser.Scene, key: string, built: BuiltTrack): TrackTexture {
  const { track, checkpoints } = built;
  const scale = W.texScale;
  const b = bounds(track);
  const m = W.texMargin + W.roadWidth;
  const originX = b.minX - m;
  const originY = b.minY - m;
  const worldW = b.maxX - b.minX + 2 * m;
  const worldH = b.maxY - b.minY + 2 * m;
  const width = Math.ceil(worldW * scale);
  const height = Math.ceil(worldH * scale);
  if (scene.textures.exists(key)) scene.textures.remove(key);
  const canvas = scene.textures.createCanvas(key, width, height);
  if (!canvas) throw new Error('could not create the track texture');
  const ctx = canvas.context;
  ctx.setTransform(scale, 0, 0, scale, -originX * scale, -originY * scale);

  // grass with a check, so the ground reads as moving
  ctx.fillStyle = css(ROAD.ground[0]);
  ctx.fillRect(originX, originY, worldW, worldH);
  ctx.fillStyle = css(ROAD.ground[1]);
  const cell = 16;
  for (let gx = Math.floor(originX / cell); gx * cell < originX + worldW; gx++) {
    for (let gy = Math.floor(originY / cell); gy * cell < originY + worldH; gy++) {
      if ((gx + gy) & 1) ctx.fillRect(gx * cell, gy * cell, cell, cell);
    }
  }

  // edges: a point each side of every centreline point
  const pts = track.line.points;
  const n = pts.length;
  const edge = (i: number, offset: number): { x: number; y: number } => {
    const a = pts[(i - 1 + n) % n];
    const c = pts[(i + 1) % n];
    const len = Math.hypot(c.x - a.x, c.y - a.y) || 1;
    const tx = (c.x - a.x) / len;
    const ty = (c.y - a.y) / len;
    return { x: pts[i].x - ty * offset, y: pts[i].y + tx * offset };
  };
  const ribbon = (half: (i: number) => number): void => {
    ctx.beginPath();
    for (let i = 0; i < n; i++) {
      const p = edge(i, -half(i));
      if (i === 0) ctx.moveTo(p.x, p.y); else ctx.lineTo(p.x, p.y);
    }
    for (let i = n - 1; i >= 0; i--) {
      const p = edge(i, half(i));
      ctx.lineTo(p.x, p.y);
    }
    ctx.closePath();
  };

  ribbon((i) => pts[i].width / 2 + track.verge);
  ctx.fillStyle = css(ROAD.verge[0]);
  ctx.fill();

  ribbon((i) => pts[i].width / 2);
  ctx.fillStyle = css(ROAD.road[0]);
  ctx.fill();

  // the wall, just outside the verge (or the road edge when the verge is 0)
  const wallW = 1.2;
  ribbon((i) => pts[i].width / 2 + track.verge + wallW / 2);
  ctx.strokeStyle = css(ROAD.wall);
  ctx.lineWidth = wallW;
  ctx.lineJoin = 'round';
  ctx.stroke();

  // kerbs on hard corners, both edges, alternating
  const kerbW = 0.9;
  for (let i = 0; i < n; i++) {
    if (Math.abs(track.curvature[i]) < W.kerbCurvature) continue;
    ctx.fillStyle = css(ROAD.kerb[i & 1]);
    for (const side of [-1, 1]) {
      const h0 = pts[i].width / 2;
      const h1 = pts[(i + 1) % n].width / 2;
      const a = edge(i, side * h0);
      const a2 = edge(i, side * (h0 - kerbW));
      const c = edge((i + 1) % n, side * h1);
      const c2 = edge((i + 1) % n, side * (h1 - kerbW));
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(c.x, c.y);
      ctx.lineTo(c2.x, c2.y);
      ctx.lineTo(a2.x, a2.y);
      ctx.closePath();
      ctx.fill();
    }
  }

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
  across(0, (half) => {
    const cellSize = 1.25;
    const cols = Math.ceil((2 * half) / cellSize);
    for (let row = 0; row < 2; row++) {
      for (let col = 0; col < cols; col++) {
        ctx.fillStyle = css(ROAD.startLine[(row + col) & 1]);
        ctx.fillRect(-cellSize + row * cellSize, -half + col * cellSize, cellSize, cellSize);
      }
    }
  });
  for (const d of checkpoints) {
    across(d, (half) => {
      ctx.fillStyle = css(ROAD.checkpoint);
      ctx.fillRect(-0.25, -half, 0.5, 2 * half);
    });
  }

  canvas.refresh();
  return { key, scale, originX, originY, width, height, worldW, worldH, canvas };
}
