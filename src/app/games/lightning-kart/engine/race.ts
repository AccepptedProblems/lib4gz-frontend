import { forwardGap, worldAt } from '../track/geometry';
import { BuiltTrack, buildTrack, TrackDef } from '../track/track-def';
import { C } from './constants';
import { addEffect, speedMultiplier } from './effects';
import { ItemEvent, ITEMS } from './items';
import { Appearance, createKart, Kart, KartInput, placeKart, stepKart } from './kart';

export interface RaceBox {
  x: number;
  y: number;
  d: number;
  /** Its lane centre across the road, as the kart's `offset`. */
  offset: number;
  /** When it was last driven through, race time; null when never. */
  hitAtMs: number | null;
}

export interface Race {
  laps: number;
  built: BuiltTrack;
  boxes: RaceBox[];
  racers: Kart[];
  elapsedMs: number;
}

export type RaceInput = KartInput;

export type RaceEvent =
  | ItemEvent
  | { type: 'finish'; racerId: string; finishMs: number }
  | { type: 'lap'; racerId: string; lap: number }
  | { type: 'checkpoint'; racerId: string; index: number };

export interface HudState {
  lap: number;
  laps: number;
  elapsedMs: number;
  speed: number; // the current speed multiplier
}

export const LOCAL_RACER = 'local';

export function createRace(opts: {
  track: TrackDef;
  laps?: number;
  racers?: { id: string; appearance: Appearance }[];
}): Race {
  const built = buildTrack(opts.track);
  // On the line at the first lane centre right of the middle: on the centreline a hands-off
  // kart would pass exactly boxRadius from a row's two middle boxes and the strict hit test
  // would miss both. Phase 3's grid will give each racer its own lane.
  const offset = C.world.roadWidth / C.world.lanes / 2;
  const racers = (opts.racers ?? [{ id: LOCAL_RACER, appearance: { characterId: '', kartId: '' } }])
    .slice(0, C.maxRacers)
    .map((r) => placeKart({ ...createKart(r.id, r.appearance), offset }, built.track));
  return {
    laps: opts.laps ?? C.laps,
    built,
    boxes: built.boxes.map((b) => ({ ...worldAt(built.track, b.d, b.offset), d: b.d, offset: b.offset, hitAtMs: null })),
    racers,
    elapsedMs: 0,
  };
}

export function step(race: Race, dt: number, input: RaceInput): RaceEvent[] {
  const events: RaceEvent[] = [];
  if (race.racers.every((r) => r.finishMs !== null)) return events;
  race.elapsedMs += dt * 1000;
  const { track, checkpoints } = race.built;
  for (const k of race.racers) {
    if (k.finishMs !== null) continue;
    const before = k.d;
    const offsetBefore = k.offset;
    stepKart(k, k.id === LOCAL_RACER ? input : { steer: 0 }, track, dt);

    // Progress: a checkpoint, the line or a box row counts when passed going forward, a step
    // shorter than the window (a teleport counts nothing).
    const moved = forwardGap(track, before, k.d);
    if (!(moved > 0 && moved < C.world.checkpointWindow)) continue;
    const lineNext = k.nextCheckpoint >= checkpoints.length;
    const target = lineNext ? 0 : checkpoints[k.nextCheckpoint];
    if (forwardGap(track, before, target) <= moved && forwardGap(track, before, target) > 0) {
      if (!lineNext) {
        events.push({ type: 'checkpoint', racerId: k.id, index: k.nextCheckpoint });
        k.nextCheckpoint++;
      } else {
        k.nextCheckpoint = 0;
        if (k.lap < race.laps) {
          k.lap++;
          events.push({ type: 'lap', racerId: k.id, lap: k.lap });
        } else {
          const overshoot = k.d / Math.max(k.speed, 0.01);
          k.finishMs = Math.max(0, Math.round(race.elapsedMs - overshoot * 1000));
          events.push({ type: 'finish', racerId: k.id, finishMs: k.finishMs });
        }
      }
    }

    // A box is hit when its row is passed in this step, `(before, k.d]` along the lap, with the
    // kart's offset there (the slide taken as even over the step) under `boxRadius` from it.
    for (const box of race.boxes) {
      const gap = forwardGap(track, before, box.d);
      if (gap <= 0 || gap > moved) continue;
      if (box.hitAtMs !== null && race.elapsedMs - box.hitAtMs < C.world.boxCooldownS * 1000) continue;
      const offset = offsetBefore + ((k.offset - offsetBefore) * gap) / moved;
      if (Math.abs(offset - box.offset) < C.world.boxRadius) {
        box.hitAtMs = race.elapsedMs;
        events.push(ITEMS.question.onHit(k.id));
      }
    }
  }
  return events;
}

export function racerOf(race: Race, racerId: string): Kart {
  return race.racers.find((x) => x.id === racerId) ?? race.racers[0];
}

export type BoostKind = 'boost' | 'double';

/** What a right answer gives now: a Double Boost while a boost or a Double Boost runs, else a boost. */
export function boostKind(race: Race, racerId: string): BoostKind {
  return racerOf(race, racerId).effects.some((e) => e.type === 'boost') ? 'double' : 'boost';
}

/** True while a Double Boost runs, as the flame reads it. */
export function isDouble(k: Kart): boolean {
  return k.effects.some((e) => e.type === 'boost' && e.mul === C.boost.doubleMul);
}

/**
 * A right answer's bottle caught: a boost of `kind` for `C.boost.seconds`, replacing whatever
 * boost runs, so a Double Boost during one restarts it. `kind` defaults to what runs now; the
 * Race scene decides it at the verdict instead.
 */
export function applyBoost(race: Race, racerId: string, kind: BoostKind = boostKind(race, racerId)): BoostKind {
  addEffect(racerOf(race, racerId).effects, 'boost', kind === 'double' ? C.boost.doubleMul : C.boost.mul, C.boost.seconds);
  return kind;
}

/**
 * A wrong answer's or a timeout's bubble burst on the racer's head: a running boost ends, the kart
 * stops dead and the trap holds it there, unable to slide, for `C.trap.seconds`; then it
 * accelerates from zero. A trap during a trap starts it again.
 */
export function applyTrap(race: Race, racerId: string): void {
  const k = racerOf(race, racerId);
  k.effects = k.effects.filter((e) => e.type !== 'boost');
  k.speed = 0;
  addEffect(k.effects, 'trap', 0, C.trap.seconds);
}

export function hudState(race: Race, racerId: string): HudState {
  const k = racerOf(race, racerId);
  return { lap: k.lap, laps: race.laps, elapsedMs: race.elapsedMs, speed: speedMultiplier(k.effects) };
}
