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

/** Every visible lesson of the module, in the new order. */
export interface ReorderLessonsRequest {
  lessonIds: string[];
}

export interface LessonResponse {
  id: string;
  moduleId: string;
  title: string;
  orderIndex: number;
  hasSummary: boolean;
  exerciseCount?: number | null;
  // Caller's completion (syllabus only): true/false for exercise-bearing lessons,
  // null/absent when the lesson has no exercises or context carries no progress.
  completed?: boolean | null;
  // Caller's SUBMITTED/APPROVED exercise count (syllabus only). With
  // exerciseCount this yields the sidebar marker: == exerciseCount → full,
  // in between → partial, 0 → no mark.
  completedExerciseCount?: number | null;
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
  // Returned when GET /lessons/{id}?expand=submissionCount and the caller teaches the course:
  // student submissions inside, drafts included.
  submissionCount?: number | null;
}

export interface ModuleSummary {
  id: string;
  title: string;
  orderIndex: number;
}

/** Tokens the lessons GET endpoint accepts for `?expand=`. */
export type LessonExpand =
  | 'summary'
  | 'exercises'
  | 'module'
  | 'questions'
  | 'mySubmission'
  | 'submissionCount';
