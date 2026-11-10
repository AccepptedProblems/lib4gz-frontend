import { forwardGap, worldAt } from '../track/geometry';
import { BuiltTrack, buildTrack, TrackDef } from '../track/track-def';
import { C } from './constants';
import { addEffect, Effect, speedMultiplier } from './effects';
import { ItemEvent, ITEMS } from './items';
import { Appearance, createKart, Kart, KartInput, stepKart } from './kart';

export interface RaceBox {
  x: number;
  y: number;
  d: number;
  /** When it was last driven through, race time; null when never. */
  hitAtMs: number | null;
}

export interface Race {
  seed: number;
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
  | { type: 'checkpoint'; racerId: string; index: number }
  | { type: 'bump'; racerId: string; steep: boolean };

export interface HudState {
  lap: number;
  laps: number;
  elapsedMs: number;
  speed: number; // the current speed multiplier
  effect: Effect | null; // the active boost or slow
  charges: number;
  /** True while a fired charge would chain onto the running boost. */
  chainWindow: boolean;
  drifting: boolean;
}

export const LOCAL_RACER = 'local';

export function createRace(opts: {
  seed: number;
  track: TrackDef;
  laps?: number;
  racers?: { id: string; appearance: Appearance }[];
}): Race {
  const built = buildTrack(opts.track);
  const racers = (opts.racers ?? [{ id: LOCAL_RACER, appearance: { characterId: '', kartId: '' } }])
    .slice(0, C.maxRacers)
    .map((r) => createKart(r.id, r.appearance));
  return {
    seed: opts.seed,
    laps: opts.laps ?? C.laps,
    built,
    boxes: built.boxes.map((b) => ({ ...worldAt(built.track, b.d, b.offset), d: b.d, hitAtMs: null })),
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
    events.push(...stepKart(k, k.id === LOCAL_RACER ? input : { steer: 0, drift: false }, track, dt, race.elapsedMs / 1000));

    // Progress: a checkpoint or the line counts when passed going forward, in order.
    const moved = forwardGap(track, before, k.d);
    if (moved > 0 && moved < C.world.checkpointWindow) {
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
    }

    for (const box of race.boxes) {
      if (box.hitAtMs !== null && race.elapsedMs - box.hitAtMs < C.world.boxCooldownS * 1000) continue;
      if (Math.hypot(k.x - box.x, k.y - box.y) < C.world.boxRadius) {
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

/** A slowdown from a wrong answer or a timeout. */
export function applySlow(race: Race, racerId: string): void {
  addEffect(racerOf(race, racerId).effects, 'slow', C.slow.mul, C.slow.seconds);
}

/** A right answer stores one charge, up to the cap. Returns false when the slot is full. */
export function addCharge(race: Race, racerId: string): boolean {
  const k = racerOf(race, racerId);
  if (k.charges >= C.boost.maxCharges) return false;
  k.charges++;
  return true;
}

export type NitroResult = 'fired' | 'chained' | 'none';

/**
 * Fires one stored charge: a boost, or, in the last second of a running boost, the chain
 * that adds its seconds (Double Boost). Mid-boost, or with no charge, nothing happens and
 * the charge is kept.
 */
export function fireNitro(race: Race, racerId: string): NitroResult {
  const k = racerOf(race, racerId);
  if (k.charges <= 0) return 'none';
  const running = k.effects.find((e) => e.type === 'boost');
  if (running && running.left > C.boost.chainWindowS) return 'none';
  k.charges--;
  if (running) {
    running.left += C.boost.seconds;
    return 'chained';
  }
  addEffect(k.effects, 'boost', C.boost.mul, C.boost.seconds);
  return 'fired';
}

export function hudState(race: Race, racerId: string): HudState {
  const k = racerOf(race, racerId);
  const boost = k.effects.find((e) => e.type === 'boost');
  return {
    lap: k.lap,
    laps: race.laps,
    elapsedMs: race.elapsedMs,
    speed: speedMultiplier(k.effects),
    effect: boost ?? k.effects.find((e) => e.type === 'slow') ?? null,
    charges: k.charges,
    chainWindow: !!boost && boost.left <= C.boost.chainWindowS && k.charges > 0,
    drifting: k.drifting,
  };
}
