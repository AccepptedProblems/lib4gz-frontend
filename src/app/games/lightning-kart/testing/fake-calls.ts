import { DealtRace, RaceCalls, RaceQuestion, RaceScope } from '../bridge';
import { AnswerChecker } from '../scenes/answer-checker';

/** For specs only: the right option of every question `card` makes. */
export const RIGHT = 1;

/** For specs only: dealt question `seq`, three options, the right one 'b' (`RIGHT`). */
export function card(seq: number): RaceQuestion {
  return { seq, content: `Q${seq}?`, options: ['a', 'b', 'c'] };
}

/** For specs only: a race the server dealt, `n` questions of `card`. */
export function dealtRace(raceId: string, n: number): DealtRace {
  return { raceId, questions: Array.from({ length: n }, (_, seq) => card(seq)) };
}

/** For specs only: a checker that decides at once from `right(question)`, `RIGHT` unless a question says otherwise. */
export function keyChecker(right: (q: RaceQuestion) => number = () => RIGHT): AnswerChecker {
  return { check: (_raceId, question, choice) => Promise.resolve(choice === right(question) ? 'right' : 'wrong') };
}

export interface Deal {
  scope: RaceScope;
  questionCount: number;
  signal: AbortSignal;
  resolve(race: DealtRace): void;
  reject(reason: unknown): void;
}

export interface Answer {
  raceId: string;
  seq: number;
  choice: number | null;
  reply(verdict: 'right' | 'wrong'): void;
}

/**
 * For specs only: the host's calls by hand. Each waits in `deals` or `answers` until the spec
 * settles it; with `autoDeal` a deal resolves at once with a race of the count asked for.
 */
export function fakeCalls(): RaceCalls & { deals: Deal[]; answers: Answer[]; autoDeal: boolean } {
  const deals: Deal[] = [];
  const answers: Answer[] = [];
  const calls = {
    deals,
    answers,
    autoDeal: false,
    deal: (scope: RaceScope, questionCount: number, signal: AbortSignal) => new Promise<DealtRace>((resolve, reject) => {
      deals.push({ scope, questionCount, signal, resolve, reject });
      if (calls.autoDeal) resolve(dealtRace(`rce_${deals.length}`, questionCount));
    }),
    answer: (raceId: string, seq: number, choice: number | null) => new Promise<'right' | 'wrong'>(reply => {
      answers.push({ raceId, seq, choice, reply });
    }),
  };
  return calls;
}
