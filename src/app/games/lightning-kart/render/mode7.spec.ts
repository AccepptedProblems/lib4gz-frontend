import Phaser from 'phaser';
import { Bridge, BRIDGE_KEY } from '../bridge';
import { C } from '../engine/constants';
import { pointAt, worldAt } from '../track/geometry';
import { LAP } from '../track/lap';
import { buildTrack } from '../track/track-def';
import { hasWebGL, Mode7View, projectToScreen } from './mode7';
import { createTrackTexture } from './track-texture';
import { SpecClock } from '../testing/spec-clock';

/**
 * The mode 7 pipeline end to end in a WebGL game: the shader compiles, a ground point
 * projected by `projectToScreen` lands on the same texture feature in the rendered frame
 * (the asphalt colour on the road, the ground colour beside it), and points behind the eye
 * project to null.
 * Pending when the test browser has no WebGL.
 */
describe('mode 7 view', () => {
  let game: Phaser.Game;
  let scene: Phaser.Scene | null = null;
  let view: Mode7View | null = null;
  let failed: unknown = null;
  const clock = new SpecClock();

  class ViewScene extends Phaser.Scene {
    create(): void {
      scene = this;
      if (!hasWebGL(this)) return;
      try {
        const built = buildTrack(LAP);
        const texture = createTrackTexture(this, 'track-spec', built);
        view = new Mode7View(this, texture);
      } catch (e) {
        failed = e;
      }
    }
  }

  beforeAll(async () => {
    game = new Phaser.Game({
      type: Phaser.AUTO, // Canvas when there is no WebGL, and the spec goes pending
      width: C.ui.stage.w,
      height: C.ui.stage.h,
      audio: { noAudio: true },
      banner: false,
      callbacks: { preBoot: g => g.registry.set(BRIDGE_KEY, new Bridge({} as never, {} as never)) },
      scene: [ViewScene],
    });
    await clock.take(game);
  });

  afterAll(async () => {
    await clock.destroy(game);
  });

  type Rgb = { r: number; g: number; b: number };
  /** The pixel at (x, y), taken by the renderer at the end of the next drawn step. */
  async function pixelAt(x: number, y: number): Promise<Rgb> {
    let rgb: Rgb | null = null;
    (game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).snapshotPixel(Math.round(x), Math.round(y), (c) => {
      const colour = c as Phaser.Display.Color;
      rgb = { r: colour.red, g: colour.green, b: colour.blue };
    });
    await clock.until(() => rgb !== null, 'the snapshot');
    return rgb!;
  }

  it('renders the track where the projection says it is', async () => {
    await clock.until(() => scene !== null, 'the scene', 4000).catch(() => undefined);
    expect(scene).withContext('the scene created').not.toBeNull();
    if (!hasWebGL(scene!)) {
      pending('no WebGL in this browser');
      return;
    }
    expect(failed).toBeNull();
    expect(view).not.toBeNull();

    // The eye on the start straight, looking along it.
    const cam = { x: -12, y: 0, yaw: 0, height: C.camera.height, pitch: (C.camera.pitchDeg * Math.PI) / 180, fovDeg: C.camera.fovDeg };
    view!.setCamera(cam);
    await clock.play(3 * clock.stepMs); // a few rendered frames

    const track = buildTrack(LAP).track;
    const onRoad = pointAt(track, 24); // the start straight, centre of the road
    const onGround = { x: onRoad.x, y: onRoad.y + C.world.roadWidth / 2 + 6 };
    const behind = { x: cam.x - 10, y: 0 };
    expect(projectToScreen(behind, cam)).toBeNull();
    const road = projectToScreen(onRoad, cam)!;
    const ground = projectToScreen(onGround, cam)!;
    expect(road).not.toBeNull();
    const focal = C.ui.stage.h / 2 / Math.tan((cam.fovDeg * Math.PI) / 360);
    const horizonY = C.ui.stage.h / 2 - Math.tan(cam.pitch) * focal;
    expect(road.x).toBeCloseTo(C.ui.stage.w / 2, 0); // straight ahead
    expect(road.y).toBeGreaterThan(horizonY); // on the ground, below the horizon
    expect(ground.y).toBeGreaterThan(horizonY);
    expect(ground.x).toBeGreaterThan(road.x); // +y is the right-hand side on screen

    // Sampled mid-lane: the middle lane line runs along the centreline.
    const midLane = projectToScreen(worldAt(track, 24, C.world.roadWidth / C.world.lanes / 2), cam)!;
    const roadPx = await pixelAt(midLane.x, midLane.y);
    const groundPx = await pixelAt(ground.x, ground.y);
    const rgb = (c: number): Rgb => ({ r: (c >> 16) & 255, g: (c >> 8) & 255, b: c & 255 });
    const dist = (a: Rgb, b: Rgb): number => Math.hypot(a.r - b.r, a.g - b.g, a.b - b.b);
    const asphalt = rgb(C.ui.road.road[0]);
    const dusk = rgb(C.ui.road.ground[0]);
    // Each pixel is nearer its own palette colour than the other's, and the road pixel is the
    // asphalt within filtering noise (the fog at this depth is zero). The two colours are only
    // about 35 apart, so a one-sided tolerance alone would not tell road from ground.
    expect(dist(roadPx, asphalt)).withContext(`road ${JSON.stringify(roadPx)}`).toBeLessThan(dist(roadPx, dusk));
    expect(dist(roadPx, asphalt)).withContext(`road ${JSON.stringify(roadPx)}`).toBeLessThan(20);
    expect(dist(groundPx, dusk)).withContext(`ground ${JSON.stringify(groundPx)}`).toBeLessThan(dist(groundPx, asphalt));
  });
});
