import { C } from './constants';
import { answerStreak, createStreak, nextTier, StreakChange, tierOf } from './streak';

/** `n` answers into a fresh streak, each `right`, and the change the last one made. */
function run(...answers: boolean[]): { streak: ReturnType<typeof createStreak>; last: StreakChange } {
  const streak = createStreak();
  let last!: StreakChange;
  for (const right of answers) last = answerStreak(streak, right);
  return { streak, last };
}

describe('streak', () => {
  it('counts right answers in a row', () => {
    const streak = createStreak();
    expect(answerStreak(streak, true)).toEqual({ type: 'up', count: 1, tierUp: null });
    expect(answerStreak(streak, true).type).toBe('up');
    expect(streak.count).toBe(2);
  });

  it('reaches Spark at 2, Charged at 3 and Lightning at 5, each once', () => {
    const streak = createStreak();
    const ups = Array.from({ length: 7 }, () => answerStreak(streak, true)).map(c => (c.type === 'up' ? c.tierUp : 'break'));
    expect(ups).toEqual([null, 'spark', 'charged', null, 'lightning', null, null]);
    expect([0, 1, 2, 3, 4, 5, 9].map(tierOf)).toEqual([null, null, 'spark', 'charged', 'charged', 'lightning', 'lightning']);
    expect(C.streak.tiers.map(t => t.at)).toEqual([2, 3, 5]);
  });

  it('names the tier one more right answer reaches, and nothing otherwise', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map(nextTier)).toEqual([null, 'spark', 'charged', null, 'lightning', null, null]);
  });

  it('breaks silently on a wrong answer at 2 and below, loudly at 3 and above, a timeout alike', () => {
    expect(run(true, true, false).last).toEqual({ type: 'break', length: 2, loud: false });
    expect(run(false).last).toEqual({ type: 'break', length: 0, loud: false });
    expect(run(true, true, true, false).last).toEqual({ type: 'break', length: 3, loud: true });
    const { streak, last } = run(true, true, true, true, true, true, false);
    expect(last).toEqual({ type: 'break', length: 6, loud: true });
    expect(streak.count).toBe(0);
  });

  it('keeps the best run across breaks and climbs the tiers again after one', () => {
    const { streak } = run(true, true, true, true, false, true, true);
    expect(streak.best).toBe(4);
    expect(streak.count).toBe(2);
    expect(answerStreak(streak, true)).toEqual({ type: 'up', count: 3, tierUp: 'charged' });
    expect(streak.best).toBe(4);
  });
});
