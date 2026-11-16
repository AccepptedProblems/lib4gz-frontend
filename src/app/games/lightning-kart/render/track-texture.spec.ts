import Phaser from 'phaser';
import { C } from '../engine/constants';
import { nearest, pointAt, Track, Vec } from '../track/geometry';
import { LAP } from '../track/lap';
import { TEST_TRACK } from '../track/test-track';
import { buildTrack, TrackDef } from '../track/track-def';
import { createTrackTexture, EDGE_BANDS, pavingCellsNear, TrackTexture } from './track-texture';

const ROAD = C.ui.road;
const PAV = ROAD.paving;
const rgb = (c: number): number[] => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const ASPHALT = rgb(ROAD.road[0]);
const LINE = rgb(PAV.line);
const GROUND = ROAD.ground.map(rgb);
/** World units a looked-at point keeps from anything else drawn on the road or past it: three texels and a hair. */
const CLEAR = 3.5 / C.world.texScale;

/** The texture drawn in one go on its own canvas, through a stand-in for the scene's texture manager; no game needed. */
function draw(def: TrackDef): { track: Track; checkpoints: number[]; texture: TrackTexture; px: Uint8ClampedArray } {
  const built = buildTrack(def);
  let canvas: HTMLCanvasElement | null = null;
  const textures = { exists: () => false, addCanvas: (_key: string, c: HTMLCanvasElement) => { canvas = c; return null; } };
  const texture = createTrackTexture({ textures } as unknown as Phaser.Scene, 'track-spec', built);
  const px = canvas!.getContext('2d')!.getImageData(0, 0, texture.width, texture.height).data;
  Phaser.Display.Canvas.CanvasPool.remove(canvas!);
  return { track: built.track, checkpoints: built.checkpoints, texture, px };
}

/** Bare ground: each channel between the check's two colours, which blend where a check edge falls inside a texel, give or take the blend's rounding. */
function ground(c: number[]): boolean {
  return c.every((v, k) => v >= Math.min(GROUND[0][k], GROUND[1][k]) - 2 && v <= Math.max(GROUND[0][k], GROUND[1][k]) + 2);
}

/** The colours of the 3 by 3 texels round world point `p`. */
function around(t: TrackTexture, px: Uint8ClampedArray, p: Vec): number[][] {
  const cx = Math.floor((p.x - t.originX) * t.scale);
  const cy = Math.floor((p.y - t.originY) * t.scale);
  const out: number[][] = [];
  for (let y = cy - 1; y <= cy + 1; y++) for (let x = cx - 1; x <= cx + 1; x++) out.push([0, 1, 2].map(k => px[(y * t.width + x) * 4 + k]));
  return out;
}

/** Paving ink on the asphalt: every channel from the bare asphalt colour toward the line colour, together a few steps along. */
function paving(c: number[]): boolean {
  const along = c.map((v, k) => (v - ASPHALT[k]) / Math.sign(LINE[k] - ASPHALT[k]));
  return along.every((a, k) => a >= 0 && a <= Math.abs(LINE[k] - ASPHALT[k])) && along.reduce((a, b) => a + b, 0) >= 3;
}

/** The middle of each edge of every paving cell whose centre is within the road plus a cell of `at`: where each edge's ink is, clear of its corners and every other edge. */
function edgeMiddles(at: Vec, reach: number): Vec[] {
  const r = PAV.cell;
  return pavingCellsNear(at, reach).flatMap(c => Array.from({ length: 6 }, (_, k) => {
    const a = (k * Math.PI) / 3;
    const b = ((k + 1) * Math.PI) / 3;
    return { x: c.x + (r * (Math.cos(a) + Math.cos(b))) / 2, y: c.y + (r * (Math.sin(a) + Math.sin(b))) / 2 };
  }));
}

/**
 * Where on the lap to look: `count` places spread round it, the tightest bend and the
 * straightest point, each far enough from the start line and the checkpoint marks that
 * nothing across the road there is drawn over the paving.
 */
function places(track: Track, checkpoints: number[], count: number): Vec[] {
  const keepOff = C.world.roadWidth + 2 * PAV.cell;
  const clear = (d: number): boolean => [0, track.length, ...checkpoints].every(m => Math.abs(d - m) > keepOff);
  const ds = Array.from({ length: count }, (_, i) => ((i + 0.5) * track.length) / count).filter(clear);
  const byBend = track.cum.slice(0, -1).map((d, i) => ({ d, k: Math.abs(track.curvature[i]) })).filter(p => clear(p.d)).sort((a, b) => b.k - a.k);
  ds.push(byBend[0].d, byBend[byBend.length - 1].d);
  return ds.map(d => pointAt(track, d));
}

/**
 * The paving as drawn, read from the texture's pixels without the code that draws it: at
 * places round both tracks, the tightest bend and a straight among them, every edge of the
 * hexagon grid whose middle lies on bare asphalt (clear of the edge stripe, the lane lines
 * and the marks) shows paving ink, the outermost edges a too-tight cull would drop first
 * included; and no edge whose middle lies past the wall leaves any ink on the ground.
 */
describe('track texture paving', () => {
  for (const [name, def] of [['lap', LAP], ['test track', TEST_TRACK]] as const) {
    it(`paves the whole road of the ${name} up to its edges, and nothing past the wall`, () => {
      const { track, checkpoints, texture, px } = draw(def);
      const laneOffsets = Array.from({ length: C.world.lanes - 1 }, (_, k) => k + 1);
      let inside = 0;
      let outside = 0;
      let outermost = 0;
      const missing: string[] = [];
      const leaking: string[] = [];
      for (const at of places(track, checkpoints, 12)) {
        for (const p of edgeMiddles(at, C.world.roadWidth / 2 + 2 * PAV.cell)) {
          const near = nearest(track, p);
          const across = Math.abs(near.offset);
          const stripe = near.half - Math.max(EDGE_BANDS.glow[1], EDGE_BANDS.core[1]);
          const onLane = laneOffsets.some(k => Math.abs(near.offset - (k / C.world.lanes - 0.5) * 2 * near.half) < ROAD.lane.lineW / 2 + CLEAR);
          if (across < stripe - CLEAR && !onLane) {
            inside++;
            if (across > near.half - PAV.cell) outermost++; // an edge of a cell centred near or past the road edge
            if (!around(texture, px, p).some(paving)) missing.push(`(${p.x.toFixed(2)}, ${p.y.toFixed(2)}) ${across.toFixed(2)} across`);
          } else if (across > near.half - EDGE_BANDS.wall[0] + CLEAR) {
            outside++;
            if (!around(texture, px, p).every(ground)) leaking.push(`(${p.x.toFixed(2)}, ${p.y.toFixed(2)}) ${JSON.stringify(around(texture, px, p).find(c => !ground(c)))}`);
          }
        }
      }
      expect(inside).toBeGreaterThan(300);
      expect(outermost).toBeGreaterThan(30);
      expect(outside).toBeGreaterThan(100);
      expect(missing).toEqual([]);
      expect(leaking).toEqual([]);
    });
  }
});
