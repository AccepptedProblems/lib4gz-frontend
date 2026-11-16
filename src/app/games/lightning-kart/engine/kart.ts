import { pointAt, Track, widthAt, wrapDistance } from '../track/geometry';
import { C } from './constants';
import { Effect, speedMultiplier, tickEffects } from './effects';

// Opaque ids chosen by the shell, such as 'chr_bolt' and 'krt_classic'. The engine never reads them.
export interface Appearance {
  characterId: string;
  kartId: string;
}

export interface KartInput {
  steer: number; // -1..1, positive slides right
}

/**
 * A kart on rails: it follows the lap by itself, `d` along it and `offset` across it, and the
 * player only slides it left and right. It accelerates by itself to the top speed times its
 * effects. `x`, `y` and `heading` are derived from `d` and `offset` every step.
 */
export interface Kart {
  id: string;
  x: number;
  y: number;
  /** Radians, 0 along +x, increasing clockwise on the texture (a right turn): the road's direction here. */
  heading: number;
  speed: number;
  effects: Effect[];
  /** Distance along the lap, in [0, length). */
  d: number;
  /** Signed offset across the road, positive right of the direction of travel. */
  offset: number;
  /** Index of the next checkpoint to cross; one past the last means the line is next. */
  nextCheckpoint: number;
  lap: number;
  finishMs: number | null;
  appearance: Appearance;
}

export function createKart(id: string, appearance: Appearance): Kart {
  return { id, x: 0, y: 0, heading: 0, speed: 0, effects: [], d: 0, offset: 0, nextCheckpoint: 0, lap: 1, finishMs: null, appearance };
}

const K = C.kart;

/**
 * Sets `x`, `y` and `heading` from `d` and `offset`. The heading is the chord across one
 * sample spacing centred on `d`, and the offset is taken square to it: unlike the polyline's
 * own tangent it turns smoothly, so the kart neither steps sideways nor twitches where one
 * centreline segment meets the next.
 */
export function placeKart(k: Kart, track: Track): Kart {
  const h = C.world.spacing / 2;
  const a = pointAt(track, k.d - h);
  const b = pointAt(track, k.d + h);
  const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
  const tx = (b.x - a.x) / len;
  const ty = (b.y - a.y) / len;
  const p = pointAt(track, k.d);
  k.x = p.x - ty * k.offset;
  k.y = p.y + tx * k.offset;
  k.heading = Math.atan2(ty, tx);
  return k;
}

/**
 * One step: the speed eases toward the top speed times the effects, `d` advances by it, and
 * `steer` slides the kart across at `C.kart.slideSpeed` whatever the speed, except while a
 * trap holds it. The road edge stops the slide and nothing else: no slowdown, no event.
 */
export function stepKart(k: Kart, input: KartInput, track: Track, dt: number): void {
  tickEffects(k.effects, dt);
  const target = K.topSpeed * speedMultiplier(k.effects);
  k.speed += Math.max(-K.brake * dt, Math.min(K.accel * dt, target - k.speed));
  k.d = wrapDistance(track, k.d + k.speed * dt);
  if (!k.effects.some((e) => e.type === 'trap')) {
    const steer = Math.max(-1, Math.min(1, input.steer));
    k.offset += steer * K.slideSpeed * dt;
  }
  const limit = widthAt(track, k.d) / 2 - K.width / 2;
  k.offset = Math.max(-limit, Math.min(limit, k.offset));
  placeKart(k, track);
}
