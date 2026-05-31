import { SummaryResponse } from './summary.model';
import { ExerciseResponse } from './exercise.model';

export interface CreateLessonRequest {
  title: string;
  orderIndex?: number | null;
}

export interface UpdateLessonRequest {
  title?: string | null;
  orderIndex?: number | null;
}

export interface LessonResponse {
  id: string;
  moduleId: string;
  title: string;
  orderIndex: number;
  hasSummary: boolean;
  exerciseCount?: number | null;
  createdAt: number;
  updatedAt: number;
  // Denormalized: parent module's title.
  moduleTitle?: string | null;
  // Returned when GET /lessons/{id}?expand=module
  module?: ModuleSummary | null;
  // Returned when GET /lessons/{id}?expand=summary
  summary?: SummaryResponse | null;
  // Returned when GET /lessons/{id}?expand=exercises
  exercises?: ExerciseResponse[] | null;
}

export interface ModuleSummary {
  id: string;
  title: string;
  orderIndex: number;
}

/** Tokens the lessons GET endpoint accepts for `?expand=`. */
export type LessonExpand = 'summary' | 'exercises' | 'module' | 'questions' | 'mySubmission';
