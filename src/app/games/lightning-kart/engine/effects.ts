/** A boost's `mul` tells a Double Boost (`C.boost.doubleMul`) from a plain one (`C.boost.mul`). */
export type EffectType = 'boost' | 'trap';

export interface Effect {
  type: EffectType;
  mul: number;
  left: number; // seconds
}

export function addEffect(effects: Effect[], type: EffectType, mul: number, left: number): Effect {
  const existing = effects.find((e) => e.type === type);
  if (existing) {
    existing.mul = mul;
    existing.left = left;
    return existing;
  }
  const effect = { type, mul, left };
  effects.push(effect);
  return effect;
}

export function speedMultiplier(effects: Effect[]): number {
  let mul = 1;
  for (const e of effects) mul *= e.mul;
  return mul;
}

export function tickEffects(effects: Effect[], dt: number): void {
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].left -= dt;
    if (effects[i].left <= 0) effects.splice(i, 1);
  }
}
