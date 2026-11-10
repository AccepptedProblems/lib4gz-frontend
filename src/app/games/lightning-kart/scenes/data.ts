import { RaceQuestionResponse } from '../../../shared/models';
import { RaceScope } from '../bridge';

/** What Scope hands to Ready and Ready to Race: the chosen scope and its deck. */
export interface ScopeChoice {
  scope: RaceScope;
  name: string;
  questions: RaceQuestionResponse[];
}

/** What Race hands to Result. */
export interface RaceOutcome {
  choice: ScopeChoice;
  seed: number;
  finishMs: number;
  correctCount: number;
  wrongCount: number;
  missed: RaceQuestionResponse[];
}
