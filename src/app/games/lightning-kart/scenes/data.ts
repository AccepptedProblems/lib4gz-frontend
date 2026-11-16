import { DealtRace, RaceQuestion, RaceScope } from '../bridge';
import { AnswerChecker } from './answer-checker';

/** What Scope hands to Ready: the chosen scope, how many questions its bank holds, and who decides its answers. */
export interface ScopeChoice {
  scope: RaceScope;
  name: string;
  count: number;
  checker: AnswerChecker;
}

/** What Ready hands to Race: the choice and the race the server dealt for it. */
export interface RaceStart {
  choice: ScopeChoice;
  race: DealtRace;
}

/** What Race hands to Result. */
export interface RaceOutcome {
  choice: ScopeChoice;
  raceId: string;
  finishMs: number;
  /** The verdicts the game received. The saved result's counts are the server's, which may also count a voided answer. */
  correctCount: number;
  wrongCount: number;
  /** The questions judged wrong, timeouts included, in the order asked. */
  missed: RaceQuestion[];
  /** The longest run of right answers in the race. The Result shows it; the server never gets it. */
  bestStreak: number;
}

/**
 * Every question the player was asked was answered right: at least one, none wrong, no
 * timeout (a timeout counts as wrong). A question still open at the finish, or void, counts neither way.
 */
export function perfectRace(o: Pick<RaceOutcome, 'correctCount' | 'wrongCount'>): boolean {
  return o.correctCount > 0 && o.wrongCount === 0;
}
