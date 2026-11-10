import Phaser from 'phaser';
import { Bridge, BRIDGE_KEY } from '../bridge';
import { C } from '../engine/constants';
import { pointAt } from '../track/geometry';
import { LAP } from '../track/lap';
import { buildTrack } from '../track/track-def';
import { hasWebGL, Mode7View, projectToScreen } from './mode7';
import { createTrackTexture } from './track-texture';

/**
 * The mode 7 pipeline end to end in a WebGL game: the shader compiles, a ground point
 * projected by `projectToScreen` lands on the same texture feature in the rendered frame
 * (road grey on the road, grass green beside it), and points behind the eye project to null.
 * Pending when the test browser has no WebGL.
 */
describe('mode 7 view', () => {
  let game: Phaser.Game;
  let scene: Phaser.Scene | null = null;
  let view: Mode7View | null = null;
  let failed: unknown = null;

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

  beforeAll(() => {
    game = new Phaser.Game({
      type: Phaser.AUTO, // Canvas when there is no WebGL, and the spec goes pending
      width: C.ui.stage.w,
      height: C.ui.stage.h,
      audio: { noAudio: true },
      banner: false,
      callbacks: { preBoot: g => g.registry.set(BRIDGE_KEY, new Bridge({} as never)) },
      scene: [ViewScene],
    });
  });

  afterAll(() => {
    game.destroy(true);
  });

  function pixelAt(x: number, y: number): Promise<{ r: number; g: number; b: number }> {
    return new Promise(resolve => {
      (game.renderer as Phaser.Renderer.WebGL.WebGLRenderer).snapshotPixel(Math.round(x), Math.round(y), (c) => {
        const colour = c as Phaser.Display.Color;
        resolve({ r: colour.red, g: colour.green, b: colour.blue });
      });
    });
  }

  it('renders the track where the projection says it is', async () => {
    const started = Date.now();
    while (!scene && Date.now() - started < 4000) await new Promise(resolve => setTimeout(resolve, 16));
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
    await new Promise(resolve => setTimeout(resolve, 100)); // a few rendered frames

    const track = buildTrack(LAP).track;
    const onRoad = pointAt(track, 24); // the start straight, centre of the road
    const onGrass = { x: onRoad.x, y: onRoad.y + C.world.roadWidth / 2 + C.world.verge + 6 };
    const behind = { x: cam.x - 10, y: 0 };
    expect(projectToScreen(behind, cam)).toBeNull();
    const road = projectToScreen(onRoad, cam)!;
    const grass = projectToScreen(onGrass, cam)!;
    expect(road).not.toBeNull();
    const focal = C.ui.stage.h / 2 / Math.tan((cam.fovDeg * Math.PI) / 360);
    const horizonY = C.ui.stage.h / 2 - Math.tan(cam.pitch) * focal;
    expect(road.x).toBeCloseTo(C.ui.stage.w / 2, 0); // straight ahead
    expect(road.y).toBeGreaterThan(horizonY); // on the ground, below the horizon
    expect(grass.y).toBeGreaterThan(horizonY);
    expect(grass.x).toBeGreaterThan(road.x); // +y is the right-hand side on screen

    const roadPx = await pixelAt(road.x, road.y);
    const grassPx = await pixelAt(grass.x, grass.y);
    // road is a neutral grey; grass is green
    expect(Math.abs(roadPx.r - roadPx.g)).toBeLessThan(20);
    expect(Math.abs(roadPx.g - roadPx.b)).toBeLessThan(20);
    expect(grassPx.g).toBeGreaterThan(grassPx.r + 20);
    expect(grassPx.g).toBeGreaterThan(grassPx.b + 20);
  });
});
