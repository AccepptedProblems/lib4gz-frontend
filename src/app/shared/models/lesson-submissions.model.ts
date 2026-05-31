import { ExerciseType } from './enums';
import { QuestionResponse } from './question.model';
import { SubmissionResponse } from './submission.model';

/**
 * Composite response for `GET /v1/lessons/{id}/submissions?expand=answers,questions`.
 *
 * Replaces the 1 + 3N + M fan-out the Lesson Submissions tab used to issue
 * (exercises + per-ex submissions + per-ex questions + per-submission re-fetch).
 *
 * Teacher-only — service enforces.
 */
export interface LessonSubmissionsResponse {
  exercises: ExerciseSubmissionsGroup[];
}

export interface ExerciseSubmissionsGroup {
  id: string;
  title: string;
  type: ExerciseType;
  orderIndex: number;
  // Returned when `expand` contains `questions`
  questions?: QuestionResponse[] | null;
  // Submissions are always included. Each carries `answers` when `expand=answers`.
  submissions: SubmissionResponse[];
}

/** Tokens accepted by `GET /lessons/{id}/submissions?expand=`. */
export type LessonSubmissionsExpand = 'answers' | 'questions';
