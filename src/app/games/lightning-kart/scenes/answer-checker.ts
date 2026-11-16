import { RaceCalls, RaceQuestion } from '../bridge';

/** `void`: no buff, no debuff, the streak untouched; the question just closes. Only the Race scene gives it, at its deadline. */
export type Verdict = 'right' | 'wrong' | 'void';

/**
 * Decides one attempt at an answer for the Race scene: the chosen option's index in the
 * dealt order, or `null` for a timeout. It may never settle, or reject; the scene asks again
 * and gives up on its own clock (`C.answer`).
 */
export interface AnswerChecker {
  check(raceId: string, question: RaceQuestion, choice: number | null): Promise<'right' | 'wrong'>;
}

/** The server's check, through the host's answer call. */
export function serverChecker(calls: RaceCalls): AnswerChecker {
  return { check: (raceId, question, choice) => calls.answer(raceId, question.seq, choice) };
}
