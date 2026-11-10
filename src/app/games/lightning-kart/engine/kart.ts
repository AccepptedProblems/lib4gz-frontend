import { nearest, Track, wrapAngle } from '../track/geometry';
import { C } from './constants';
import { addEffect, Effect, speedMultiplier, tickEffects } from './effects';

// Opaque ids chosen by the shell, such as 'chr_bolt' and 'krt_classic'. The engine never reads them.
export interface Appearance {
  characterId: string;
  kartId: string;
}

export interface KartInput {
  steer: number; // -1..1, positive turns right
  drift: boolean;
}

/**
 * A kart: position, heading and velocity in world units. It accelerates by itself to the
 * top speed times its effects; the grip pulls the velocity toward the heading and the rest
 * is slide. Progress along the lap is kept here too.
 */
export interface Kart {
  id: string;
  x: number;
  y: number;
  /** Radians, 0 along +x, increasing clockwise on the texture (a right turn). */
  heading: number;
  vx: number;
  vy: number;
  speed: number;
  drifting: boolean;
  onGrass: boolean;
  onWall: boolean;
  /** Race time of the last bump event, so rubbing a wall does not thud every frame. */
  lastBumpS: number;
  effects: Effect[];
  charges: number;
  /** Distance along the lap after the last step. */
  d: number;
  /** Signed offset across the road after the last step. */
  offset: number;
  /** Index of the next checkpoint to cross; one past the last means the line is next. */
  nextCheckpoint: number;
  lap: number;
  finishMs: number | null;
  appearance: Appearance;
}

export type KartEvent = { type: 'bump'; racerId: string; steep: boolean };

export function createKart(id: string, appearance: Appearance): Kart {
  return {
    id, x: 0, y: 0, heading: 0, vx: 0, vy: 0, speed: 0,
    drifting: false, onGrass: false, onWall: false, lastBumpS: -Infinity, effects: [], charges: 0,
    d: 0, offset: 0, nextCheckpoint: 0, lap: 1, finishMs: null, appearance,
  };
}

const K = C.kart;
const DEG = Math.PI / 180;

/** One step of the kart model; returns what the shell should hear about. */
export function stepKart(k: Kart, input: KartInput, track: Track, dt: number, nowS: number): KartEvent[] {
  const events: KartEvent[] = [];
  tickEffects(k.effects, dt);
  const top = K.topSpeed;
  const steer = Math.max(-1, Math.min(1, input.steer));

  // Drift: held with a direction. Starting needs some speed; letting go snaps the velocity to the heading.
  const holding = input.drift && steer !== 0;
  if (k.drifting && !holding) {
    k.drifting = false;
    k.vx = Math.cos(k.heading) * k.speed;
    k.vy = Math.sin(k.heading) * k.speed;
  } else if (!k.drifting && holding && k.speed >= K.drift.minSpeedFrac * top) {
    k.drifting = true;
  }
  if (k.drifting) addEffect(k.effects, 'drift', K.drift.mul, 0);

  // Heading: the turn rate falls with speed and is nothing at a standstill.
  let rate = K.turnRateLow + (K.turnRate - K.turnRateLow) * Math.min(1, k.speed / top);
  rate *= Math.min(1, k.speed / K.minTurnSpeed);
  if (k.drifting) rate *= K.drift.turnMul;
  k.heading = wrapAngle(k.heading + steer * rate * dt);

  // Speed toward the target; the velocity direction follows the heading at the grip's pace.
  const target = top * speedMultiplier(k.effects);
  k.speed += Math.max(-K.brake * dt, Math.min(K.accel * dt, target - k.speed));
  let dir = k.speed > 0.01 && (k.vx !== 0 || k.vy !== 0) ? Math.atan2(k.vy, k.vx) : k.heading;
  const tau = k.drifting ? K.drift.gripTau : k.onGrass ? K.grass.gripTau : K.gripTau;
  dir += wrapAngle(k.heading - dir) * (1 - Math.exp(-dt / tau));
  k.vx = Math.cos(dir) * k.speed;
  k.vy = Math.sin(dir) * k.speed;
  k.x += k.vx * dt;
  k.y += k.vy * dt;

  // Where on the track: grass slows and slides, the wall slides or bounces.
  const n = nearest(track, k);
  k.d = n.d;
  k.offset = n.offset;
  k.onGrass = Math.abs(n.offset) > n.half;
  if (k.onGrass) addEffect(k.effects, 'offroad', K.grass.mul, 0);
  const limit = n.half + track.verge - K.width / 2;
  if (Math.abs(n.offset) > limit) {
    const side = Math.sign(n.offset); // +1: the wall on the right of the tangent
    const rx = -n.ty * side; // unit vector from the track toward this wall
    const ry = n.tx * side;
    const inside = limit - K.wall.pushIn;
    k.x = n.x + rx * inside;
    k.y = n.y + ry * inside;
    k.offset = inside * side;
    const vn = k.vx * rx + k.vy * ry; // toward the wall
    const vt = k.vx * n.tx + k.vy * n.ty; // along the track
    if (vn > 0) {
      const steep = Math.atan2(vn, Math.abs(vt)) > K.wall.steepDeg * DEG;
      if (steep) {
        k.vx = n.tx * vt - rx * vn * K.wall.bounce;
        k.vy = n.ty * vt - ry * vn * K.wall.bounce;
        const tangent = Math.atan2(n.ty * Math.sign(vt || 1), n.tx * Math.sign(vt || 1));
        k.heading = wrapAngle(2 * tangent - k.heading);
        addEffect(k.effects, 'bump', C.bump.mul, C.bump.seconds);
        k.drifting = false;
      } else {
        const keep = k.onWall ? 1 : 1 - K.wall.slideLoss;
        k.vx = n.tx * vt * keep;
        k.vy = n.ty * vt * keep;
      }
      if (steep || nowS - k.lastBumpS >= K.wall.eventGapS) {
        k.lastBumpS = nowS;
        events.push({ type: 'bump', racerId: k.id, steep });
      }
      k.speed = Math.hypot(k.vx, k.vy);
    }
    k.onWall = true;
  } else {
    k.onWall = false;
  }
  return events;
}

/** Angle between the nose and the way the kart is actually moving, for drawing a drift. */
export function slideAngle(k: Kart): number {
  if (k.speed < 0.01) return 0;
  return wrapAngle(Math.atan2(k.vy, k.vx) - k.heading);
}
