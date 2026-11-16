import { C } from '../engine/constants';
import { textureSize } from '../render/track-texture';
import { createTrack, layout, nearest, pointAt, tangentAt, worldAt } from './geometry';
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

  it('makes the lap 2,500 to 2,800 units and the test track shorter', () => {
    expect(lap.length).toBeGreaterThanOrEqual(2500);
    expect(lap.length).toBeLessThanOrEqual(2800);
    expect(test.length).toBeLessThan(lap.length);
    // The server's finish floor assumes at least this lap (the backend's application.race.lap-length).
    expect(lap.length).withContext('the server would refuse honest finishes').toBeGreaterThanOrEqual(2641);
  });

  it('bends right only, never tighter than radius 120, the closing arcs of the layout included', () => {
    for (const def of [LAP, TEST_TRACK]) {
      for (const p of def.pieces) if (!('straight' in p)) expect(p.deg).toBeGreaterThan(0);
    }
    for (const t of [lap, test]) {
      // the centreline's points include the closing section that layout adds itself, which
      // turns left first when the walk ends off level
      const tightest = Math.max(...t.curvature.map(Math.abs));
      expect(tightest).toBeLessThanOrEqual(1 / 120 + 1e-9);
      expect(Math.min(...t.curvature)).toBeGreaterThan(-1e-4);
    }
  });

  it('fits the track texture within 4096 px a side at world.texScale', () => {
    for (const t of [lap, test]) {
      const size = textureSize(t);
      expect(size.width).toBeLessThanOrEqual(4096);
      expect(size.height).toBeLessThanOrEqual(4096);
    }
  });

  it('spreads world.rowsPerLap rows evenly round the lap, the first half a row gap past the line, a box at each lane centre', () => {
    const built = buildTrack(LAP);
    const L = built.track.length;
    const n = C.world.rowsPerLap;
    expect(built.boxes.length).toBe(n * C.world.lanes);
    const rows = [...new Set(built.boxes.map((b) => b.d))];
    expect(rows.length).toBe(n);
    expect(rows[0]).toBeCloseTo(L / n / 2, 6);
    rows.forEach((d, i) => {
      const next = rows[(i + 1) % n];
      expect((next - d + L) % L).withContext(`from row ${d}`).toBeCloseTo(L / n, 6);
      // six lanes of six on a road of 36
      expect(built.boxes.filter((b) => b.d === d).map((b) => b.offset)).toEqual([-15, -9, -3, 3, 9, 15]);
    });
  });

  it('puts every box on the road and every checkpoint in order', () => {
    for (const def of [LAP, TEST_TRACK]) {
      const built = buildTrack(def);
      for (const b of built.boxes) {
        expect(b.d).toBeLessThan(built.track.length);
        expect(Math.abs(nearest(built.track, worldAt(built.track, b.d, b.offset)).offset)).toBeLessThan(C.world.roadWidth / 2);
      }
      const sorted = built.checkpoints.slice().sort((a, b) => a - b);
      expect(built.checkpoints).toEqual(sorted);
      expect(built.checkpoints[built.checkpoints.length - 1]).toBeLessThan(built.track.length);
    }
  });

  it('stands every roadside prop on the lap and outside the wall', () => {
    const wallW = C.ui.road.wallW;
    const minOffset = C.world.roadWidth / 2 + wallW + 1;
    for (const def of [LAP, TEST_TRACK]) {
      const built = buildTrack(def);
      expect(built.props.length).toBe(def.props.length);
      expect(built.props.map((p) => p.kind)).toContain('palm');
      for (const p of built.props) {
        expect(p.d).toBeGreaterThanOrEqual(0);
        expect(p.d).toBeLessThan(built.track.length);
        expect(Math.abs(p.offset)).toBeGreaterThanOrEqual(minOffset);
        // the real distance to the nearest centreline point, so a prop over another stretch of road fails too
        const n = nearest(built.track, p);
        expect(Math.hypot(p.x - n.x, p.y - n.y)).withContext(`prop at ${p.d}`).toBeGreaterThanOrEqual(minOffset);
      }
    }
  });

  it('refuses a layout that cannot close', () => {
    expect(() => layout([{ straight: 100 }], 10, 5)).toThrow();
    expect(() => layout([{ straight: 100 }, { deg: 90, r: 20 }], 10, 5)).toThrow();
    const t = createTrack({ points: layout([{ straight: 100 }, { deg: 180, r: 20 }, { straight: 150 }, { deg: 180, r: 20 }], 10, 5) });
    expect(t.length).toBeGreaterThan(200);
  });
});
