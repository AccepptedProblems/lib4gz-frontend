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
}
