import { forwardGap, tangentAt, widthAt, worldAt } from '../track/geometry';
import { LAP } from '../track/lap';
import { TEST_TRACK } from '../track/test-track';
import { C } from './constants';
import { placeKart } from './kart';
import { applyBoost, applyTrap, createRace, hudState, LOCAL_RACER, Race, RaceEvent, step } from './race';

const DT = 1 / 60;
const HANDS_OFF = { steer: 0 };

function local(race: Race) {
  return race.racers[0];
}

/** Steps `race` for `seconds` with `input`, collecting the events. */
function run(race: Race, seconds: number, input = HANDS_OFF): RaceEvent[] {
  const all: RaceEvent[] = [];
  for (let t = 0; t < seconds - 1e-9; t += DT) all.push(...step(race, DT, input));
  return all;
}

/** Where the road edge stops the kart's centre at distance `d`. */
function edge(race: Race, d: number): number {
  return widthAt(race.built.track, d) / 2 - C.kart.width / 2;
}

/** The running boosts by kind: `['boost']`, `['double']` or none. */
function boosts(race: Race): string[] {
  return local(race).effects.filter((e) => e.type === 'boost').map((e) => (e.mul === C.boost.doubleMul ? 'double' : 'boost'));
}

/**
 * Drives three laps at `dt` steps with a Double Boost kept running, steered by `steer`, and
 * returns how many boxes were hit at each pass of each row, by lap then row.
 */
function rowHits(dt: number, steer: (race: Race) => number): number[][] {
  const race = createRace({ track: LAP, laps: 3 });
  const k = local(race);
  const rows = [...new Set(race.boxes.map((b) => b.d))];
  const hits = Array.from({ length: 3 }, () => rows.map(() => 0));
  k.speed = C.kart.topSpeed * C.boost.doubleMul;
  for (let t = 0; t < 400 && k.finishMs === null; t += dt) {
    applyBoost(race, LOCAL_RACER, 'double');
    const lap = k.lap - 1;
    step(race, dt, { steer: steer(race) });
    race.boxes.forEach((b) => { if (b.hitAtMs === race.elapsedMs) hits[lap][rows.indexOf(b.d)]++; });
  }
  expect(k.finishMs).not.toBeNull();
  return hits;
}

describe('race engine', () => {
  it('drives a hands-off kart round three laps of the lap, in its lane, in the time top speed allows', () => {
    const race = createRace({ track: LAP, laps: 3 });
    const k = local(race);
    const lane = k.offset;
    const events: RaceEvent[] = [];
    let worst = 0;
    for (let t = 0; t < 600 && k.finishMs === null; t += DT) {
      events.push(...step(race, DT, HANDS_OFF));
      // On the road, in its lane, facing along it: where the boxes' frame puts that lane.
      const there = worldAt(race.built.track, k.d, lane);
      worst = Math.max(worst, Math.hypot(k.x - there.x, k.y - there.y));
      const tg = tangentAt(race.built.track, k.d);
      expect(Math.cos(k.heading) * tg.x + Math.sin(k.heading) * tg.y).toBeGreaterThan(0.98);
    }
    expect(k.offset).toBe(lane);
    expect(worst).toBeLessThan(0.5);
    const finish = events.find((e) => e.type === 'finish') as { finishMs: number } | undefined;
    expect(finish).toBeDefined();
    expect(events.filter((e) => e.type === 'lap').length).toBe(2);
    expect(events.filter((e) => e.type === 'checkpoint').length).toBe(3 * LAP.checkpointFractions.length);
    // Three laps at top speed plus what the start from rest costs, whatever the owner has tuned
    // the track and the speeds to.
    const ideal = ((3 * race.built.track.length) / C.kart.topSpeed) * 1000;
    const launch = (C.kart.topSpeed / (2 * C.kart.accel)) * 1000;
    expect(finish!.finishMs).toBeGreaterThanOrEqual(ideal);
    expect(finish!.finishMs).toBeLessThanOrEqual(ideal + launch + 100);
    expect(step(race, DT, HANDS_OFF)).toEqual([]);
  });

  it('slides across at the slide speed and stops at the road edge with no speed loss and no event', () => {
    const race = createRace({ track: TEST_TRACK });
    const k = local(race);
    k.speed = C.kart.topSpeed;
    const from = k.offset;
    run(race, 0.25, { steer: 1 });
    expect(k.offset - from).toBeCloseTo(0.25 * C.kart.slideSpeed, 1);

    const events = run(race, C.world.roadWidth / C.kart.slideSpeed + 1, { steer: 1 });
    expect(k.offset).toBe(edge(race, k.d));
    expect(k.speed).toBe(C.kart.topSpeed);
    expect(events.filter((e) => e.type !== 'item' && e.type !== 'checkpoint')).toEqual([]);

    run(race, C.world.roadWidth / C.kart.slideSpeed + 1, { steer: -1 });
    expect(k.offset).toBe(-edge(race, k.d));
    expect(k.speed).toBe(C.kart.topSpeed);
  });

  it('slides at the same rate at any speed', () => {
    const slid = (speed: number): number => {
      const race = createRace({ track: LAP });
      const k = local(race);
      Object.assign(k, { speed, offset: 0 });
      step(race, DT, { steer: -1 });
      return k.offset;
    };
    expect(slid(2)).toBeCloseTo(slid(C.kart.topSpeed), 9);
    expect(slid(2)).toBeCloseTo(-C.kart.slideSpeed * DT, 9);
  });

  it('does not count a lap that skips checkpoints', () => {
    const race = createRace({ track: LAP, laps: 3 });
    const k = local(race);
    const track = race.built.track;
    // Teleport just before the line with no checkpoint passed, then drive over it.
    placeKart(Object.assign(k, { d: track.length - 5, speed: C.kart.topSpeed }), track);
    const events = run(race, 1);
    expect(events.some((e) => e.type === 'lap')).toBeFalse();
    expect(k.lap).toBe(1);
    expect(k.nextCheckpoint).toBe(0);
  });

  it('boosts for five seconds and ends', () => {
    const race = createRace({ track: LAP });
    const k = local(race);
    k.speed = C.kart.topSpeed;
    expect(applyBoost(race, LOCAL_RACER)).toBe('boost');
    expect(hudState(race, LOCAL_RACER).speed).toBe(C.boost.mul);
    run(race, C.boost.seconds - 0.1);
    expect(boosts(race)).toEqual(['boost']);
    expect(k.speed).toBeCloseTo(C.kart.topSpeed * C.boost.mul, 5);
    run(race, 0.2);
    expect(boosts(race)).toEqual([]);
    expect(hudState(race, LOCAL_RACER).speed).toBe(1);
  });

  it('gives a Double Boost for a right answer while a boost runs, replacing it', () => {
    const race = createRace({ track: LAP });
    applyBoost(race, LOCAL_RACER);
    run(race, 3);
    expect(applyBoost(race, LOCAL_RACER)).toBe('double');
    expect(boosts(race)).toEqual(['double']);
    expect(hudState(race, LOCAL_RACER).speed).toBe(C.boost.doubleMul);
    expect(local(race).effects.find((e) => e.type === 'boost')!.left).toBe(C.boost.seconds);
    run(race, C.boost.seconds + 0.1);
    expect(boosts(race)).toEqual([]);
    // Nothing is stored: the next right answer from rest is a plain boost.
    expect(applyBoost(race, LOCAL_RACER)).toBe('boost');
  });

  it('restarts a Double Boost for a right answer during one', () => {
    const race = createRace({ track: LAP });
    applyBoost(race, LOCAL_RACER);
    applyBoost(race, LOCAL_RACER);
    run(race, 4);
    const double = local(race).effects.find((e) => e.type === 'boost')!;
    expect(double.left).toBeLessThan(1.01);
    expect(applyBoost(race, LOCAL_RACER)).toBe('double');
    expect(boosts(race)).toEqual(['double']);
    expect(local(race).effects.find((e) => e.type === 'boost')!.left).toBe(C.boost.seconds);
    run(race, C.boost.seconds - 0.1);
    expect(boosts(race)).toEqual(['double']);
  });

  it('traps the kart: the boost ends, it stops dead and cannot slide, then it restarts from zero', () => {
    const race = createRace({ track: LAP });
    const k = local(race);
    k.speed = C.kart.topSpeed;
    applyBoost(race, LOCAL_RACER);
    applyBoost(race, LOCAL_RACER);
    run(race, 2);
    expect(k.speed).toBeGreaterThan(C.kart.topSpeed);

    applyTrap(race, LOCAL_RACER);
    expect(boosts(race)).toEqual([]);
    expect(k.speed).toBe(0);
    expect(hudState(race, LOCAL_RACER).speed).toBe(0);
    const at = { d: k.d, offset: k.offset };
    run(race, C.trap.seconds - 0.05, { steer: 1 });
    expect(k.d).toBeCloseTo(at.d, 6);
    expect(k.offset).toBe(at.offset);
    expect(k.speed).toBe(0);

    // Released: it slides again and gathers speed from zero at the kart's acceleration.
    run(race, 0.05 + 1, { steer: 1 });
    expect(k.effects).toEqual([]);
    expect(k.offset).toBeGreaterThan(at.offset);
    expect(k.speed).toBeGreaterThan(0.9 * C.kart.accel);
    expect(k.speed).toBeLessThan(1.1 * C.kart.accel);
    run(race, C.kart.topSpeed / C.kart.accel);
    expect(k.speed).toBeCloseTo(C.kart.topSpeed, 9);
    // The boost it had is gone for good: the next right answer is a plain one.
    expect(applyBoost(race, LOCAL_RACER)).toBe('boost');
  });

  it('starts on the line at a lane centre, so a hands-off start opens one box of the first row', () => {
    const race = createRace({ track: LAP });
    const k = local(race);
    expect(k.d).toBe(0);
    expect(k.offset).toBe(C.world.roadWidth / C.world.lanes / 2);
    const past = Math.min(...race.boxes.map((b) => b.d)) + 20;
    const items: RaceEvent[] = [];
    for (let t = 0; t < 30 && k.d < past; t += DT) items.push(...step(race, DT, HANDS_OFF).filter((e) => e.type === 'item'));
    expect(k.d).toBeGreaterThanOrEqual(past);
    expect(items.length).toBe(1);
  });

  it('darkens only the box driven through; the rest of its row stay lit', () => {
    const race = createRace({ track: LAP });
    const first = 2 * C.world.lanes; // the third row
    const d = race.boxes[first].d;
    const row = race.boxes.slice(first, first + C.world.lanes);
    const target = row[1];
    const k = local(race);
    placeKart(Object.assign(k, { d: d - 20, offset: race.built.boxes[first + 1].offset, speed: C.kart.topSpeed }), race.built.track);
    const events = run(race, 1);
    expect(k.d).toBeGreaterThan(d + 10);
    expect(events.filter((e) => e.type === 'item').length).toBe(1);
    expect(target.hitAtMs).not.toBeNull();
    expect(race.elapsedMs - target.hitAtMs!).toBeLessThan(C.world.boxCooldownS * 1000);
    expect(row.filter((b) => b !== target).map((b) => b.hitAtMs)).toEqual(Array(C.world.lanes - 1).fill(null));
  });

  it('hits a box only when its row is driven through, and again after the cooldown', () => {
    const race = createRace({ track: LAP });
    const box = race.boxes[0];
    const k = local(race);
    const track = race.built.track;
    const hit: RaceEvent = { type: 'item', kind: 'question', racerId: LOCAL_RACER };
    // Parked on the box: nothing passes, nothing is hit.
    placeKart(Object.assign(k, { d: box.d, offset: box.offset, speed: 0 }), track);
    k.effects.push({ type: 'trap', mul: 0, left: 1 });
    expect(run(race, 0.5)).not.toContain(hit);
    // Driven through: one hit; through again inside the cooldown: none.
    const through = (): RaceEvent[] => {
      placeKart(Object.assign(k, { d: box.d - 2, offset: box.offset, speed: C.kart.topSpeed, effects: [] }), track);
      return run(race, 0.2);
    };
    expect(through().filter((e) => e.type === 'item').length).toBe(1);
    expect(through()).not.toContain(hit);
    placeKart(Object.assign(k, { d: box.d + 100 }), track);
    run(race, C.world.boxCooldownS);
    expect(through()).toContain(hit);
  });

  it('hits every row once per pass at 1/10 s steps under a Double Boost, hands-off and while sliding edge to edge', () => {
    const once = [0, 1, 2].map(() => Array(C.world.rowsPerLap).fill(1));
    expect(rowHits(0.1, () => 0)).toEqual(once);
    // Sliding all the time: right to the edge, then left to the other, and so on.
    let dir = 1;
    expect(rowHits(0.1, (race) => {
      const k = local(race);
      if (Math.abs(k.offset) >= edge(race, k.d) - 1e-9) dir = -Math.sign(k.offset);
      return dir;
    })).toEqual(once);
  });

  it('hits no box in a step that moves the window or more, as after a teleport', () => {
    const race = createRace({ track: LAP });
    const k = local(race);
    const box = race.boxes[0];
    placeKart(Object.assign(k, { d: box.d - 1, offset: box.offset, speed: C.kart.topSpeed }), race.built.track);
    const events = step(race, (C.world.checkpointWindow + 4) / C.kart.topSpeed, HANDS_OFF);
    expect(k.d - (box.d - 1)).toBeGreaterThan(C.world.checkpointWindow);
    expect(events.filter((e) => e.type === 'item')).toEqual([]);
    expect(race.boxes.every((b) => b.hitAtMs === null)).toBeTrue();
  });

  it('takes the offset where the row is passed inside a step, not where the step ends', () => {
    const race = createRace({ track: LAP });
    const k = local(race);
    const lane = C.world.roadWidth / C.world.lanes;
    const row = race.boxes.filter((b) => b.d === race.boxes[0].d);
    const inLane = row.find((b) => b.offset === lane / 2)!; // the lane right of the middle
    const nextLane = row.find((b) => b.offset === lane * 1.5)!;
    // A 1/10 s step at top speed while sliding right: it passes the row a tenth of the way in,
    // still inside the first lane, and ends across the lane line in the next.
    const moved = 0.1 * C.kart.topSpeed;
    const from = lane - 0.5;
    placeKart(Object.assign(k, { d: inLane.d - 0.1 * moved, offset: from, speed: C.kart.topSpeed }), race.built.track);
    step(race, 0.1, { steer: 1 });
    expect(k.offset).toBeGreaterThan(lane); // ended in the next lane
    expect(inLane.hitAtMs).not.toBeNull();
    expect(nextLane.hitAtMs).toBeNull();
  });

  it('crosses the line in one 1/10 s step and times the finish at the line, not at the step', () => {
    const race = createRace({ track: LAP, laps: 1 });
    const k = local(race);
    const track = race.built.track;
    placeKart(Object.assign(k, { d: track.length - 2, speed: C.kart.topSpeed, nextCheckpoint: race.built.checkpoints.length }), track);
    const events = step(race, 0.1, HANDS_OFF);
    expect(forwardGap(track, track.length - 2, k.d)).toBeCloseTo(0.1 * C.kart.topSpeed, 9);
    // The step ends 2.4 past the line; the finish is put back by that over the speed.
    expect(events).toContain({ type: 'finish', racerId: LOCAL_RACER, finishMs: Math.round((2 / C.kart.topSpeed) * 1000) });
  });

  it('runs a boost caught in a trap at once, its clock through the trap, at no speed until the trap ends', () => {
    const race = createRace({ track: LAP });
    const k = local(race);
    applyTrap(race, LOCAL_RACER);
    run(race, 0.3);
    expect(applyBoost(race, LOCAL_RACER)).toBe('boost');
    run(race, 0.3);
    expect(k.speed).toBe(0);
    expect(boosts(race)).toEqual(['boost']);
    run(race, C.trap.seconds - 0.6 + DT);
    expect(k.effects.map((e) => e.type)).toEqual(['boost']);
    expect(k.effects[0].left).toBeCloseTo(C.boost.seconds - C.trap.seconds + 0.3, 1);
    expect(hudState(race, LOCAL_RACER).speed).toBe(C.boost.mul);
  });

  it('starts a trap again for a trap during a trap', () => {
    const race = createRace({ track: LAP });
    const k = local(race);
    applyTrap(race, LOCAL_RACER);
    run(race, C.trap.seconds - 0.1);
    applyTrap(race, LOCAL_RACER);
    expect(k.effects).toEqual([{ type: 'trap', mul: 0, left: C.trap.seconds }]);
    run(race, C.trap.seconds - 0.05);
    expect(k.speed).toBe(0);
    run(race, 0.1);
    expect(k.effects).toEqual([]);
  });

  it('gives the boost kind it is told, whatever runs: the Race scene decides it at the verdict', () => {
    const race = createRace({ track: LAP });
    expect(applyBoost(race, LOCAL_RACER, 'double')).toBe('double');
    expect(boosts(race)).toEqual(['double']);
    expect(applyBoost(race, LOCAL_RACER, 'boost')).toBe('boost');
    expect(boosts(race)).toEqual(['boost']);
  });
});
