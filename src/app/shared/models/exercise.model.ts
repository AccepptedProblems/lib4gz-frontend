import { ExerciseType, SubmissionStatus } from './enums';
import { CreateQuestionItem, QuestionResponse } from './question.model';
import { SubmissionResponse } from './submission.model';

export interface CreateExerciseRequest {
  title: string;
  type: ExerciseType;
  settings?: Record<string, any>;
  orderIndex?: number | null;
  questions?: CreateQuestionItem[];
}

export interface UpdateExerciseRequest {
  title?: string | null;
  type?: ExerciseType | null;
  settings?: Record<string, any> | null;
  orderIndex?: number | null;
}

export interface ExerciseResponse {
  id: string;
  lessonId: string;
  title: string;
  type: ExerciseType;
  settings: Record<string, any>;
  orderIndex: number;
  questionCount?: number | null;
  createdAt: number;
  updatedAt: number;
  // Denormalized status of caller's submission (null when none).
  mySubmissionStatus?: SubmissionStatus | null;
  mySubmissionId?: string | null;
  // Returned when listed with `?expand=questions`
  questions?: QuestionResponse[] | null;
  // Returned when listed with `?expand=mySubmission`
  mySubmission?: SubmissionResponse | null;
}

/** Tokens accepted by `GET /lessons/{id}/exercises?expand=` and `GET /exercises/{id}?expand=`. */
export type ExerciseExpand = 'questions' | 'mySubmission';
