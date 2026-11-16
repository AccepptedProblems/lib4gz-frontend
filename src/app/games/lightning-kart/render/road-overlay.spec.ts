import Phaser from 'phaser';
import { Bridge, BRIDGE_KEY } from '../bridge';
import { C } from '../engine/constants';
import { DebugScene } from '../scenes/debug';
import { SCENE } from '../scenes/keys';
import { pointAt, tangentAt, Track, Vec, worldAt, wrapDistance } from '../track/geometry';
import { LAP } from '../track/lap';
import { TEST_TRACK } from '../track/test-track';
import { buildTrack } from '../track/track-def';
import { SpecClock } from '../testing/spec-clock';
import { hasWebGL, Mode7Camera, Mode7View, projectToScreen } from './mode7';
import { RoadOverlay } from './road-overlay';
import { createTrackTexture } from './track-texture';

const ROAD = C.ui.road;
const SW = C.ui.stage.w;
const SH = C.ui.stage.h;
/** Canvas px per stage px, as on a phone or a HiDPI desktop. */
const DPR = 2;
const h = C.world.roadWidth / 2;

type Rgb = [number, number, number];
const rgb = (c: number): Rgb => [(c >> 16) & 255, (c >> 8) & 255, c & 255];
const mix = (a: number, b: number, t: number): Rgb => rgb(a).map((v, i) => Math.round(v + (rgb(b)[i] - v) * t)) as Rgb;
const dist = (a: Rgb, b: Rgb): number => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);

const WALL = rgb(ROAD.wall);
const GLOW = mix(ROAD.road[0], ROAD.edgeGlow, ROAD.edgeGlowAlpha); // the stripe's even glow over the asphalt
const GROUND = mix(ROAD.ground[0], ROAD.ground[1], 0.5);
const WHITE = rgb(ROAD.startLine[0]);
const DARK = rgb(ROAD.startLine[1]);
const ASPHALT = rgb(ROAD.road[0]);
const CORE = rgb(ROAD.edge);
const CYAN = rgb(ROAD.checkpoint);

/**
 * The sharp wall and start line (`RoadOverlay`) over the mode 7 view, rendered for real at
 * 1920 by 1080 on the lap: each edge sits where the camera's projection puts it, goes from one
 * colour to the other within two canvas px near the eye (the texture alone takes far more),
 * hands over to the texture with no change far away, and nothing is drawn above the horizon
 * or for a feature behind the eye; the Debug scene draws it too, on both tracks. Pending when
 * the test browser has no WebGL.
 */
describe('road overlay', () => {
  let game: Phaser.Game;
  let scene: Phaser.Scene | null = null;
  let view: Mode7View | null = null;
  let overlay: RoadOverlay | null = null;
  let pixels: Uint8Array | null = null;
  let wantPixels = false;
  const clock = new SpecClock();
  const built = buildTrack(LAP);
  let track: Track = built.track; // the Debug and triangle specs switch it for a while

  class OverlayScene extends Phaser.Scene {
    create(): void {
      scene = this;
      if (!hasWebGL(this)) return;
      this.cameras.main.setZoom(DPR).centerOn(SW / 2, SH / 2);
      view = new Mode7View(this, createTrackTexture(this, 'track-overlay-spec', built));
      overlay = new RoadOverlay(this, built, 0.5);
      this.game.events.on(Phaser.Core.Events.POST_RENDER, () => {
        if (!wantPixels) return;
        const gl = (this.game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).gl;
        const out = new Uint8Array(SW * DPR * SH * DPR * 4);
        gl.readPixels(0, 0, SW * DPR, SH * DPR, gl.RGBA, gl.UNSIGNED_BYTE, out);
        pixels = out;
        wantPixels = false;
      });
    }
  }

  beforeAll(async () => {
    game = new Phaser.Game({
      type: Phaser.AUTO,
      width: SW * DPR,
      height: SH * DPR,
      audio: { noAudio: true },
      banner: false,
      render: { mipmapFilter: 'LINEAR_MIPMAP_LINEAR' },
      callbacks: { preBoot: g => g.registry.set(BRIDGE_KEY, new Bridge({} as never, {} as never)) },
      scene: [OverlayScene, DebugScene], // the Debug scene only when a spec starts it
    });
    await clock.take(game);
    await clock.until(() => scene !== null, 'the scene', 4000).catch(() => undefined);
  });

  afterAll(async () => {
    await clock.destroy(game);
  });

  function webgl(): boolean {
    expect(scene).withContext('the scene created').not.toBeNull();
    if (!hasWebGL(scene!)) {
      pending('no WebGL in this browser');
      return false;
    }
    return true;
  }

  /** The race camera behind a kart at `d` and `offset`, looking along its heading. */
  function behindKart(d: number, offset: number): Mode7Camera {
    const a = pointAt(track, d - C.world.spacing / 2);
    const b = pointAt(track, d + C.world.spacing / 2);
    const yaw = Math.atan2(b.y - a.y, b.x - a.x);
    const k = worldAt(track, d, offset);
    return { x: k.x - Math.cos(yaw) * C.camera.back, y: k.y - Math.sin(yaw) * C.camera.back, yaw, height: C.camera.height, pitch: (C.camera.pitchDeg * Math.PI) / 180, fovDeg: C.camera.fovDeg };
  }

  let cam: Mode7Camera;
  /** Renders the view from `at` with the overlay shown or not and keeps the frame's pixels. */
  async function render(at: Mode7Camera, shown = true): Promise<void> {
    cam = at;
    view!.setCamera(at);
    overlay!.update(at);
    overlay!.graphics.setVisible(shown);
    await clock.step();
    wantPixels = true;
    await clock.until(() => !wantPixels, 'the frame');
  }

  /** The canvas pixel at canvas point `p`. */
  function px(p: Vec): Rgb {
    expect(p.x >= 0 && p.x < SW * DPR && p.y >= 0 && p.y < SH * DPR).withContext(`${p.x}, ${p.y} on the canvas`).toBeTrue();
    const x = Math.round(p.x);
    const y = SH * DPR - 1 - Math.round(p.y); // GL rows start at the bottom
    const i = (y * SW * DPR + x) * 4;
    return [pixels![i], pixels![i + 1], pixels![i + 2]];
  }

  /** Where world point `d`, `offset` lands on the canvas. */
  function canvasAt(d: number, offset: number): Vec {
    const p = projectToScreen(worldAt(track, d, offset), cam)!;
    expect(p).withContext(`${d}, ${offset} in front of the eye`).not.toBeNull();
    return { x: p.x * DPR, y: p.y * DPR };
  }

  /**
   * An edge on the ground through world point `d`, `offset`: running along the lap
   * (`along` true) or across it. Returns the canvas point on it and the unit canvas normal
   * toward larger offset (along) or larger `d` (across).
   */
  function edge(d: number, offset: number, along: boolean): { at: Vec; n: Vec } {
    const at = canvasAt(d, offset);
    const e = along ? canvasAt(d + 0.5, offset) : canvasAt(d, offset + 0.5);
    const o = along ? canvasAt(d, offset + 0.05) : canvasAt(d + 0.05, offset);
    let nx = -(e.y - at.y);
    let ny = e.x - at.x;
    const len = Math.hypot(nx, ny);
    nx /= len;
    ny /= len;
    if ((o.x - at.x) * nx + (o.y - at.y) * ny < 0) { nx = -nx; ny = -ny; }
    return { at, n: { x: nx, y: ny } };
  }

  const step = (e: { at: Vec; n: Vec }, k: number): Vec => ({ x: e.at.x + e.n.x * k, y: e.at.y + e.n.y * k });

  /** Canvas px the colour takes to go from 10 % to 90 % of the way from `a` to `b`, scanning `reach` px either side of the edge. */
  function rise(e: { at: Vec; n: Vec }, a: Rgb, b: Rgb, reach = 12): number {
    const ab = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
    const ab2 = ab[0] ** 2 + ab[1] ** 2 + ab[2] ** 2;
    const t: number[] = [];
    for (let k = -reach; k <= reach; k++) {
      const c = px(step(e, k));
      t.push(((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2]) / ab2);
    }
    return t.findIndex(v => v >= 0.9) - t.findIndex(v => v >= 0.1);
  }

  const L = track.length;
  const cell = (2 * h) / Math.round((2 * h) / ROAD.startCell);
  const edgeX = h - C.kart.width / 2; // the kart against the road edge
  /** The grid, a straight and a bend (the cut corner, radius 150), each side of the road. */
  const places = [
    { name: 'the grid', d: wrapDistance(track, -6), offset: 3, side: 1, ahead: 16 },
    { name: 'the start straight', d: 60, offset: edgeX, side: 1, ahead: 3 },
    { name: 'the cut corner, inside', d: 840, offset: edgeX, side: 1, ahead: 3 },
    { name: 'the cut corner, outside', d: 840, offset: -edgeX, side: -1, ahead: 3 },
  ];

  it('draws the wall where the projection puts it, sharp, at the grid, on a straight and in a bend', async () => {
    if (!webgl()) return;
    for (const place of places) {
      await render(behindKart(place.d, place.offset));
      const d = place.d + place.ahead; // just ahead of the kart; on the grid, where the wall comes into the view
      const s = place.side;
      const inner = edge(d, s * h, true);
      const outer = edge(d, s * (h + ROAD.wallW), true);
      const toWall = s; // the normal points toward larger offset
      const near = (p: Vec, c: Rgb, what: string): void => {
        expect(dist(px(p), c)).withContext(`${place.name}: ${what} ${JSON.stringify(px(p))}`).toBeLessThan(14);
      };
      near(step(inner, 2.5 * toWall), WALL, 'just inside the wall at its road edge');
      near(canvasAt(d, s * (h - ROAD.edgeW / 4)), GLOW, 'the glow between the stripe\'s core and the wall');
      near(step(outer, -2.5 * toWall), WALL, 'just inside the wall at its outer edge');
      // the stripe's core: its middle, and its road-side edge from the glow, sharp
      near(canvasAt(d, s * (h - ROAD.edgeW)), CORE, "the middle of the stripe's core");
      const core = edge(d, s * (h - 1.5 * ROAD.edgeW), true);
      near(step(core, -2.5 * toWall), GLOW, "the glow just inside the core's road-side edge");
      near(step(core, 2.5 * toWall), CORE, "the core just past its road-side edge");
      expect(rise({ at: core.at, n: { x: core.n.x * toWall, y: core.n.y * toWall } }, GLOW, CORE)).withContext(`${place.name}: the core's road-side edge`).toBeLessThanOrEqual(2);
      expect(Math.min(dist(px(step(outer, 2.5 * toWall)), rgb(ROAD.ground[0])), dist(px(step(outer, 2.5 * toWall)), rgb(ROAD.ground[1]))))
        .withContext(`${place.name}: just outside the wall`).toBeLessThan(14);
      // from the road to the wall and from the wall to the ground, each within two canvas px
      expect(rise({ at: inner.at, n: { x: inner.n.x * toWall, y: inner.n.y * toWall } }, GLOW, WALL)).withContext(`${place.name}: the wall's road edge`).toBeLessThanOrEqual(2);
      expect(rise({ at: outer.at, n: { x: outer.n.x * toWall, y: outer.n.y * toWall } }, WALL, GROUND)).withContext(`${place.name}: the wall's outer edge`).toBeLessThanOrEqual(2);
    }
  });

  it('draws the start line where the projection puts it, its cells sharp, ahead of the kart and under it', async () => {
    if (!webgl()) return;
    for (const kartD of [wrapDistance(track, -6), 1.5]) {
      await render(behindKart(kartD, 3));
      // Row 1 (from 0 to one cell past the line), column 13 is white and 14 dark, both in
      // front of the kart; the line's front edge there meets the asphalt.
      const front = edge(cell, -h + 13.5 * cell, false);
      expect(dist(px(step(front, -2.5)), WHITE)).withContext(`kart at ${kartD}: inside the line's front edge`).toBeLessThan(14);
      expect(dist(px(step(front, 2.5)), ASPHALT)).withContext(`kart at ${kartD}: past the line's front edge`).toBeLessThan(14);
      expect(rise(front, WHITE, ASPHALT)).withContext(`kart at ${kartD}: the line's front edge`).toBeLessThanOrEqual(2);
      // The side of a cell slants on screen, so the scan stays within the row's height.
      const between = edge(cell / 2, -h + 14 * cell, true);
      expect(dist(px(step(between, -2.5)), WHITE)).withContext(`kart at ${kartD}: column 13`).toBeLessThan(14);
      expect(dist(px(step(between, 2.5)), DARK)).withContext(`kart at ${kartD}: column 14`).toBeLessThan(14);
      expect(rise(between, WHITE, DARK, 6)).withContext(`kart at ${kartD}: between two cells`).toBeLessThanOrEqual(2);
      if (kartD < L / 2) continue; // with the kart on the line its ends are off the canvas
      // The line's right end meets the wall.
      const end = edge(cell / 2, h, true);
      const last = (1 + Math.round((2 * h) / ROAD.startCell) - 1) & 1; // row 1, the last column
      expect(dist(px(step(end, -2.5)), rgb(ROAD.startLine[last]))).withContext(`kart at ${kartD}: the line's right end`).toBeLessThan(14);
      expect(dist(px(step(end, 2.5)), WALL)).withContext(`kart at ${kartD}: the wall past the line's end`).toBeLessThan(14);
    }
  });

  it('draws a checkpoint mark where the projection puts it, sharp, just ahead of the kart', async () => {
    if (!webgl()) return;
    const mark = built.checkpoints[0];
    await render(behindKart(mark - 6, 3));
    for (const end of [-1, 1]) {
      // its near and far edge in the lane right of the middle, clear of the lane lines
      const e = edge(mark + (end * ROAD.markW) / 2, 3, false);
      expect(dist(px(step(e, -2.5 * end)), CYAN)).withContext(`inside the mark's ${end < 0 ? 'near' : 'far'} edge`).toBeLessThan(14);
      // the texture's soft cyan under the fading feather leaves a tinge there, about 5 % of the way
      expect(dist(px(step(e, 2.5 * end)), ASPHALT)).withContext(`past the mark's ${end < 0 ? 'near' : 'far'} edge ${JSON.stringify(px(step(e, 2.5 * end)))}`).toBeLessThan(dist(CYAN, ASPHALT) / 10);
      expect(rise({ at: e.at, n: { x: e.n.x * end, y: e.n.y * end } }, CYAN, ASPHALT, 4)).withContext(`the mark's ${end < 0 ? 'near' : 'far'} edge`).toBeLessThanOrEqual(2);
    }
  });

  it('follows a bend, not its chords: the wall edge stays on the arc between the points', () => {
    if (!webgl()) return;
    // The middle point of the lap's tightest arc and its neighbours lie on the arc's circle
    // (two arcs share that radius: the longest run of points at it is one of them).
    const pts = track.line.points;
    const most = Math.max(...track.curvature);
    let run = { from: 0, length: 0 };
    for (let k = 0, from = 0; k <= pts.length; k++) {
      if (k < pts.length && Math.abs(track.curvature[k] - most) < 1e-6) continue;
      if (k - from > run.length) run = { from, length: k - from };
      from = k + 1;
    }
    const i = run.from + (run.length >> 1);
    const [a, b, c] = [pts[i - 1], pts[i], pts[i + 1]];
    const det = 2 * (a.x * (b.y - c.y) + b.x * (c.y - a.y) + c.x * (a.y - b.y));
    const sq = (p: Vec): number => p.x * p.x + p.y * p.y;
    const centre = { x: (sq(a) * (b.y - c.y) + sq(b) * (c.y - a.y) + sq(c) * (a.y - b.y)) / det, y: (sq(a) * (c.x - b.x) + sq(b) * (a.x - c.x) + sq(c) * (b.x - a.x)) / det };
    const r = Math.hypot(b.x - centre.x, b.y - centre.y);
    const o = overlay as unknown as { sx: Float64Array; sy: Float64Array; snx: Float64Array; sny: Float64Array };
    const off = h + ROAD.wallW; // the wall's outer edge, either side
    let worst = 0;
    for (let s = 0; s < o.sx.length; s++) {
      if (Math.hypot(o.sx[s] - b.x, o.sy[s] - b.y) > 2 * C.world.spacing) continue;
      for (const side of [-1, 1]) {
        const e = Math.hypot(o.sx[s] + o.snx[s] * side * off - centre.x, o.sy[s] + o.sny[s] * side * off - centre.y);
        worst = Math.max(worst, Math.min(Math.abs(e - (r + off)), Math.abs(e - (r - off))));
      }
    }
    expect(worst).withContext(`radius ${r.toFixed(1)}: the wall edge's worst distance from the arc`).toBeLessThan(0.005); // a chord sags about 0.03 there
  });

  it('draws in the Debug scene\'s mode 7 view on both tracks, sharp', async () => {
    if (!webgl()) return;
    try {
      for (const which of ['lap', 'test'] as const) {
        game.scene.start(SCENE.debug, { mode: 'mode7', track: which });
        await clock.until(() => game.scene.isActive(SCENE.debug), 'the Debug scene');
        const debug = game.scene.getScene(SCENE.debug) as unknown as { overlay: RoadOverlay; cam: Mode7Camera; race: { built: { track: Track } } };
        const drawn = spyOn(debug.overlay.graphics, 'fillTriangle').and.callThrough();
        await clock.play(2 * clock.stepMs);
        expect(drawn.calls.count()).withContext(`${which}: the overlay's triangles`).toBeGreaterThan(0);
        track = debug.race.built.track;
        cam = debug.cam;
        wantPixels = true;
        await clock.until(() => !wantPixels, 'the frame');
        // Its free camera starts 30 before the line looking along it: the right wall 10 before
        // the line is 20 deep, nearer than the marker on the line's end.
        const outer = edge(-10, h + ROAD.wallW, true);
        const scan = [-4, -2, 2, 4].map((k) => JSON.stringify(px(step(outer, k)))).join(' ');
        expect(rise(outer, WALL, GROUND, 6)).withContext(`${which}: the wall's outer edge, ${scan}`).toBeLessThanOrEqual(2);
        game.scene.stop(SCENE.debug);
        await clock.step();
      }
    } finally {
      game.scene.stop(SCENE.debug);
      track = built.track;
    }
  });

  it('hands over to the texture: past its fade the overlay changes no pixel', async () => {
    if (!webgl()) return;
    // From the start straight, the left wall just past the fade's end, where the fog has begun.
    const at = behindKart(30, 0);
    const d = 30 + ROAD.overlay.fade[1] + 15;
    const off = -(h + ROAD.wallW / 2);
    const depth = projectToScreen(worldAt(track, d, off), at)!.depth;
    expect(depth).toBeGreaterThan(ROAD.overlay.fade[1]);
    expect(depth).toBeLessThan(ROAD.overlay.fade[1] + C.world.roadWidth);
    await render(at, false);
    const p = canvasAt(d, off);
    const without = px(p);
    await render(at, true);
    expect(px(p)).toEqual(without);
  });

  it('blends each part in one layer while it fades: with it or without, a few levels apart', async () => {
    if (!webgl()) return;
    /** The first distance past `from` whose point at `off` is `depth` deep from `at`. */
    const deep = (at: Mode7Camera, from: number, off: number, depth: number): number => {
      let d = from;
      while (projectToScreen(worldAt(track, d, off), at)!.depth < depth) d += 0.05;
      return d;
    };
    // From the start straight, 80 deep (mid-fade): the right stripe's core (on the left it is
    // about 2 px across there, all edge) and the wall's middle on both sides.
    const straight = behindKart(30, 0);
    const probes: { what: string; at: Mode7Camera; d: number; off: number }[] = [
      { what: "the stripe's core", at: straight, d: deep(straight, 30, h - ROAD.edgeW, 80), off: h - ROAD.edgeW },
    ];
    for (const s of [-1, 1]) probes.push({ what: `the wall, side ${s}`, at: straight, d: deep(straight, 30, s * (h + ROAD.wallW / 2), 80), off: s * (h + ROAD.wallW / 2) });
    // From 45 before the line, about 54 deep while its cells are a few px tall: a white and a
    // dark cell in the middle, and the last cell where it crosses the stripe's core.
    const grid = behindKart(L - 45, 0);
    for (const off of [-h + 17.5 * cell, -h + 18.5 * cell, h - ROAD.edgeW]) probes.push({ what: `the start line at ${off.toFixed(2)}`, at: grid, d: cell / 2, off });
    for (const p of probes) {
      await render(p.at, false);
      const without = px(canvasAt(p.d, p.off));
      await render(p.at, true);
      const withIt = px(canvasAt(p.d, p.off));
      expect(dist(withIt, without)).withContext(`${p.what}: ${without} without, ${withIt} with`).toBeLessThanOrEqual(8);
    }
  });

  it('draws nothing above the horizon, and nothing of a feature behind the eye', () => {
    if (!webgl()) return;
    const tris: number[] = [];
    const colours: number[] = [];
    const testBuilt = buildTrack(TEST_TRACK);
    const test = new RoadOverlay(scene!, testBuilt, 0.5);
    for (const g of [overlay!.graphics, test.graphics]) {
      spyOn(g, 'fillTriangle').and.callFake((x0: number, y0: number, x1: number, y1: number, x2: number, y2: number) => {
        tris.push(y0, y1, y2);
        return g;
      });
    }
    const g = overlay!.graphics;
    spyOn(g, 'fillStyle').and.callFake((c: number) => { colours.push(c); return g; });
    spyOn(g, 'fillGradientStyle').and.callFake((c: number) => { colours.push(c); return g; });
    // Race poses on both tracks stay under the cap. The Debug scene's free camera can go
    // further (pitch 60 at height 15 drew up to 914): outside the cap, Debug is not played.
    const pitches = [C.camera.pitchDeg, 4, 40];
    let most = 0;
    try {
      for (const [o, t] of [[overlay!, built.track], [test, testBuilt.track]] as const) {
        track = t;
        for (let d = 0; d < t.length; d += 25) {
          for (const offset of [-edgeX, 0, edgeX]) {
            for (const pitchDeg of pitches) {
              const at = { ...behindKart(d, offset), pitch: (pitchDeg * Math.PI) / 180 };
              tris.length = 0;
              o.update(at);
              most = Math.max(most, tris.length / 3);
              const focal = SH / 2 / Math.tan((at.fovDeg * Math.PI) / 360);
              const horizon = SH / 2 - Math.tan(at.pitch) * focal;
              const top = Math.min(...tris, Infinity);
              expect(top).withContext(`${t === built.track ? 'lap' : 'test'} d ${d}, offset ${offset}, pitch ${pitchDeg}`).toBeGreaterThan(horizon);
            }
          }
        }
      }
    } finally {
      track = built.track;
      test.destroy();
    }
    expect(most).toBeLessThan(800);

    // Past the line and looking on down the start straight, the line is behind the eye.
    colours.length = 0;
    overlay!.update(behindKart(40, 0));
    expect(colours).not.toContain(ROAD.startLine[0]);
    expect(colours).not.toContain(ROAD.startLine[1]);
    expect(colours).toContain(ROAD.wall);
    // Outside the wall at the start, facing away from the lap (it bends right, so it lies to
    // the right of the start straight): the whole track is behind the eye.
    const start = pointAt(track, 0);
    const t = tangentAt(track, 0);
    tris.length = 0;
    overlay!.update({ x: start.x + t.y * 40, y: start.y - t.x * 40, yaw: Math.atan2(-t.x, t.y), height: C.camera.height, pitch: (C.camera.pitchDeg * Math.PI) / 180, fovDeg: C.camera.fovDeg });
    expect(tris.length).toBe(0);
  });
});
