import { C } from '../engine/constants';
import { createTrack, isInsideWall, isOnRoad, layout, nearest, pointAt, tangentAt, wallNormal, worldAt } from './geometry';
import { LAP } from './lap';
import { TEST_TRACK } from './test-track';
import { buildTrack } from './track-def';

describe('track geometry', () => {
  const lap = buildTrack(LAP).track;
  const test = buildTrack(TEST_TRACK).track;

  it('lays out a closed centreline that ends where it started, heading +x', () => {
    for (const t of [lap, test]) {
      const pts = t.line.points;
      const last = pts[pts.length - 1];
      expect(Math.hypot(last.x, last.y)).toBeLessThan(C.world.spacing * 1.5);
      expect(pts[0]).toEqual(jasmine.objectContaining({ x: 0, y: 0 }));
      const tg = tangentAt(t, 0);
      expect(tg.x).toBeCloseTo(1, 3);
      expect(tg.y).toBeCloseTo(0, 3);
    }
  });

  it('round-trips a distance through pointAt and nearest', () => {
    for (const d of [0, 100, 777, lap.length - 3]) {
      const p = pointAt(lap, d);
      const n = nearest(lap, p);
      expect(n.d).toBeCloseTo(d, 3);
      expect(Math.abs(n.offset)).toBeLessThan(1e-6);
    }
  });

  it('tells the road from the grass and the grass from beyond the wall', () => {
    const verged = { ...lap, verge: 3 }; // the queries read the track's own verge; the shipped one is 0
    const half = C.world.roadWidth / 2;
    const onRoad = worldAt(verged, 500, half - 0.5);
    const onGrass = worldAt(verged, 500, half + verged.verge / 2);
    const outside = worldAt(verged, 500, half + verged.verge + 1);
    expect(isOnRoad(verged, onRoad)).toBeTrue();
    expect(isOnRoad(verged, onGrass)).toBeFalse();
    expect(isInsideWall(verged, onGrass)).toBeTrue();
    expect(isInsideWall(verged, outside)).toBeFalse();
    const normal = wallNormal(verged, outside);
    const back = { x: outside.x + normal.x * 3, y: outside.y + normal.y * 3 };
    expect(Math.abs(nearest(verged, back).offset)).toBeLessThan(Math.abs(nearest(verged, outside).offset));
  });

  it('puts the wall at the road edge: the shipped verge is 0', () => {
    expect(lap.verge).toBe(0);
    expect(isInsideWall(lap, worldAt(lap, 500, C.world.roadWidth / 2 + 0.5))).toBeFalse();
  });

  it('makes the full lap about sixty seconds at top speed and the test track shorter', () => {
    const seconds = lap.length / C.kart.topSpeed;
    expect(seconds).toBeGreaterThan(50);
    expect(seconds).toBeLessThan(72);
    expect(test.length).toBeLessThan(lap.length);
  });

  it('puts every box slot on the road and every checkpoint in order', () => {
    for (const def of [LAP, TEST_TRACK]) {
      const built = buildTrack(def);
      for (const b of built.boxes) {
        expect(b.d).toBeLessThan(built.track.length);
        expect(isOnRoad(built.track, worldAt(built.track, b.d, b.offset))).toBeTrue();
      }
      const sorted = built.checkpoints.slice().sort((a, b) => a - b);
      expect(built.checkpoints).toEqual(sorted);
      expect(built.checkpoints[built.checkpoints.length - 1]).toBeLessThan(built.track.length);
    }
  });

  it('refuses a layout that cannot close', () => {
    expect(() => layout([{ straight: 100 }], 10, 5)).toThrow();
    expect(() => layout([{ straight: 100 }, { deg: 90, r: 20 }], 10, 5)).toThrow();
    const t = createTrack({ points: layout([{ straight: 100 }, { deg: 180, r: 20 }, { straight: 150 }, { deg: 180, r: 20 }], 10, 5) }, 4);
    expect(t.length).toBeGreaterThan(200);
  });
});
