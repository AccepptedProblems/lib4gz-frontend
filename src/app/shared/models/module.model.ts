export interface CreateModuleRequest {
  title: string;
  orderIndex?: number | null;
}

export interface UpdateModuleRequest {
  title?: string | null;
  orderIndex?: number | null;
}

export interface ModuleResponse {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  lessonCount?: number | null;
  createdAt: number;
  updatedAt: number;
}
