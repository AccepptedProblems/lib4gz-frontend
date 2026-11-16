import { C } from './constants';

/** A streak tier, lowest first: 'spark', 'charged', 'lightning' (`C.streak.tiers`). */
export type Tier = (typeof C.streak.tiers)[number]['name'];

/** One racer's right answers in a row this race, and the longest run so far. */
export interface Streak {
  count: number;
  best: number;
}

/**
 * What one answer did to the streak: a right one counts up and names the tier it reached, if
 * it reached a new one; a wrong one or a timeout breaks the run of `length`, loudly from
 * `C.streak.loudBreakAt` on.
 */
export type StreakChange =
  | { type: 'up'; count: number; tierUp: Tier | null }
  | { type: 'break'; length: number; loud: boolean };

export function createStreak(): Streak {
  return { count: 0, best: 0 };
}

/** The tier `count` right answers in a row reach, or null below the first. */
export function tierOf(count: number): Tier | null {
  let tier: Tier | null = null;
  for (const t of C.streak.tiers) if (count >= t.at) tier = t.name;
  return tier;
}

/** The tier one more right answer reaches from `count`, or null when it reaches none. */
export function nextTier(count: number): Tier | null {
  const next = tierOf(count + 1);
  return next !== tierOf(count) ? next : null;
}

/** Counts one answer into `streak`: `right` false is a wrong answer or a timeout. */
export function answerStreak(streak: Streak, right: boolean): StreakChange {
  if (!right) {
    const length = streak.count;
    streak.count = 0;
    return { type: 'break', length, loud: length >= C.streak.loudBreakAt };
  }
  const before = tierOf(streak.count);
  streak.count++;
  streak.best = Math.max(streak.best, streak.count);
  const tier = tierOf(streak.count);
  return { type: 'up', count: streak.count, tierUp: tier !== before ? tier : null };
}
