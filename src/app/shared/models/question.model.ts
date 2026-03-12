import { QuestionVisibility, QuestionAction } from './enums';

export interface CreateQuestionItem {
  content: string;
  orderIndex?: number | null;
  meta?: Record<string, any>;
  visibility?: QuestionVisibility;
}

export interface CreateQuestionsRequest {
  questions: CreateQuestionItem[];
}

export interface UpdateQuestionItem {
  action: QuestionAction;
  questionId?: string | null;
  content?: string | null;
  orderIndex?: number | null;
  meta?: Record<string, any> | null;
  visibility?: QuestionVisibility | null;
}

export interface UpdateQuestionsRequest {
  questions: UpdateQuestionItem[];
}

export interface QuestionResponse {
  id: string;
  exerciseId: string;
  content: string;
  orderIndex: number;
  meta: Record<string, any>;
  visibility: QuestionVisibility;
  createdAt: number;
  updatedAt: number;
}

export interface QuestionsResponse {
  created: QuestionResponse[];
  updated: QuestionResponse[];
  deleted: string[];
}
