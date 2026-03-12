import { ExerciseType } from './enums';
import { CreateQuestionItem } from './question.model';

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
}
