import { pointAt, worldAt, wrapAngle } from '../track/geometry';
import { LAP } from '../track/lap';
import { TEST_TRACK } from '../track/test-track';
import { C } from './constants';
import { addCharge, applySlow, createRace, fireNitro, hudState, LOCAL_RACER, Race, RaceEvent, RaceInput, step } from './race';

const DT = 1 / 60;

function local(race: Race) {
  return race.racers[0];
}

/** Steers toward the centreline point about a second ahead and drifts when the turn is sharp. */
function bot(race: Race, drift = true): RaceInput {
  const k = local(race);
  const ahead = pointAt(race.built.track, k.d + Math.max(12, k.speed));
  const diff = wrapAngle(Math.atan2(ahead.y - k.y, ahead.x - k.x) - k.heading);
  return { steer: Math.max(-1, Math.min(1, diff * 3)), drift: drift && Math.abs(diff) > 0.3 };
}

function runBot(race: Race, maxSeconds: number): RaceEvent[] {
  const all: RaceEvent[] = [];
  for (let t = 0; t < maxSeconds; t += DT) {
    all.push(...step(race, DT, bot(race)));
    if (local(race).finishMs !== null) break;
  }
  return all;
}

describe('race engine', () => {
  it('completes three laps of the full lap with a bot in about three minutes', () => {
    const race = createRace({ seed: 1, track: LAP, laps: 3 });
    const events = runBot(race, 400);
    const finish = events.find((e) => e.type === 'finish') as { finishMs: number } | undefined;
    expect(finish).toBeDefined();
    expect(events.filter((e) => e.type === 'lap').length).toBe(2);
    expect(events.filter((e) => e.type === 'checkpoint').length).toBe(3 * LAP.checkpointFractions.length);
    expect(finish!.finishMs).toBeGreaterThan(150000);
    expect(finish!.finishMs).toBeLessThan(240000);
    expect(step(race, DT, { steer: 0, drift: false })).toEqual([]);
  });

  it('bounces a kart aimed at the wall and slides one that grazes it', () => {
    const race = createRace({ seed: 1, track: TEST_TRACK });
    const k = local(race);
    const limit = C.world.roadWidth / 2 + C.world.verge - C.kart.width / 2; // where the wall stops the kart
    const start = worldAt(race.built.track, 40, limit - 0.1);
    Object.assign(k, start, { heading: Math.PI / 3, speed: C.kart.topSpeed });
    k.vx = Math.cos(k.heading) * k.speed;
    k.vy = Math.sin(k.heading) * k.speed;
    const events = step(race, DT, { steer: 0, drift: false });
    expect(events).toContain({ type: 'bump', racerId: LOCAL_RACER, steep: true });
    expect(k.heading).toBeLessThan(0); // the nose points back toward the road
    expect(k.effects.find((e) => e.type === 'bump')?.mul).toBe(C.bump.mul);

    const graze = createRace({ seed: 1, track: TEST_TRACK });
    const g = local(graze);
    Object.assign(g, worldAt(graze.built.track, 40, limit - 0.02), { heading: 0.15, speed: C.kart.topSpeed });
    g.vx = Math.cos(g.heading) * g.speed;
    g.vy = Math.sin(g.heading) * g.speed;
    const grazeEvents = step(graze, DT, { steer: 0, drift: false });
    expect(grazeEvents).toContain({ type: 'bump', racerId: LOCAL_RACER, steep: false });
    expect(g.speed).toBeLessThan(C.kart.topSpeed * (1 - C.kart.wall.slideLoss) + 0.01);
    expect(g.vy).toBeCloseTo(0, 1); // moving along the wall, not into it
  });

  it('slows on the grass when a track has a verge', () => {
    const race = createRace({ seed: 1, track: LAP });
    race.built.track.verge = 3; // the shipped tracks have none
    const k = local(race);
    Object.assign(k, worldAt(race.built.track, 60, C.world.roadWidth / 2 + 1));
    step(race, DT, { steer: 0, drift: false });
    expect(k.onGrass).toBeTrue();
    expect(hudState(race, LOCAL_RACER).speed).toBe(C.kart.grass.mul);
  });

  it('does not count a lap for a cut across the grass that skips checkpoints', () => {
    const race = createRace({ seed: 1, track: LAP, laps: 3 });
    const k = local(race);
    const track = race.built.track;
    // Teleport just before the line with no checkpoint passed, then drive over it.
    Object.assign(k, pointAt(track, track.length - 5), { heading: 0, speed: C.kart.topSpeed, d: track.length - 5 });
    const events: RaceEvent[] = [];
    for (let i = 0; i < 60; i++) events.push(...step(race, DT, { steer: 0, drift: false }));
    expect(events.some((e) => e.type === 'lap')).toBeFalse();
    expect(k.lap).toBe(1);
    expect(k.nextCheckpoint).toBe(0);
  });

  it('turns tighter in a drift than with plain steering at top speed', () => {
    const turned = (drift: boolean): number => {
      const race = createRace({ seed: 1, track: LAP });
      const k = local(race);
      k.speed = C.kart.topSpeed;
      k.vx = k.speed;
      for (let i = 0; i < 24; i++) step(race, DT, { steer: 1, drift });
      return k.heading;
    };
    expect(turned(true)).toBeGreaterThan(turned(false) * 1.5);
  });

  it('stores up to two charges and fires one as a five second boost', () => {
    const race = createRace({ seed: 1, track: LAP });
    expect(fireNitro(race, LOCAL_RACER)).toBe('none');
    expect(addCharge(race, LOCAL_RACER)).toBeTrue();
    expect(addCharge(race, LOCAL_RACER)).toBeTrue();
    expect(addCharge(race, LOCAL_RACER)).toBeFalse();
    expect(hudState(race, LOCAL_RACER).charges).toBe(2);
    expect(fireNitro(race, LOCAL_RACER)).toBe('fired');
    expect(hudState(race, LOCAL_RACER).speed).toBe(C.boost.mul);
    expect(fireNitro(race, LOCAL_RACER)).toBe('none'); // mid-boost: kept
    expect(hudState(race, LOCAL_RACER).charges).toBe(1);
  });

  it('chains a charge fired in the last second into one boost of about nine seconds', () => {
    const race = createRace({ seed: 1, track: LAP });
    addCharge(race, LOCAL_RACER);
    addCharge(race, LOCAL_RACER);
    fireNitro(race, LOCAL_RACER);
    let boosted = 0;
    let second = 'unfired';
    for (let t = 0; t < 20; t += DT) {
      step(race, DT, { steer: 0, drift: false });
      const hud = hudState(race, LOCAL_RACER);
      if (hud.effect?.type === 'boost') boosted += DT;
      if (t > C.boost.seconds - 0.8 && second === 'unfired') {
        expect(hud.chainWindow).toBeTrue();
        second = fireNitro(race, LOCAL_RACER);
      }
    }
    expect(second).toBe('chained');
    expect(boosted).toBeGreaterThan(8.5);
    expect(boosted).toBeLessThan(10.5);
  });

  it('slows for a wrong answer and expires', () => {
    const race = createRace({ seed: 1, track: LAP });
    applySlow(race, LOCAL_RACER);
    expect(hudState(race, LOCAL_RACER).speed).toBe(C.slow.mul);
    for (let t = 0; t < C.slow.seconds + 0.1; t += DT) step(race, DT, { steer: 0, drift: false });
    expect(hudState(race, LOCAL_RACER).speed).toBe(1);
  });

  it('emits an item event through a box once, then again after the cooldown', () => {
    const race = createRace({ seed: 1, track: LAP });
    const box = race.boxes[0];
    const k = local(race);
    Object.assign(k, { x: box.x, y: box.y });
    expect(step(race, DT, { steer: 0, drift: false })).toContain({ type: 'item', kind: 'question', racerId: LOCAL_RACER });
    expect(step(race, DT, { steer: 0, drift: false })).not.toContain({ type: 'item', kind: 'question', racerId: LOCAL_RACER });
    Object.assign(k, { x: box.x - 20, y: box.y, vx: 0, vy: 0, speed: 0 });
    for (let t = 0; t < C.world.boxCooldownS + 0.1; t += DT) step(race, DT, { steer: 0, drift: false });
    Object.assign(k, { x: box.x, y: box.y });
    expect(step(race, DT, { steer: 0, drift: false })).toContain({ type: 'item', kind: 'question', racerId: LOCAL_RACER });
  });
});
