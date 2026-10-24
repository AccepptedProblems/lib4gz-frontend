export interface CreateModuleRequest {
  title: string;
  orderIndex?: number | null;
}

export interface UpdateModuleRequest {
  title?: string | null;
  orderIndex?: number | null;
}

/** Every visible module of the course, in the new order. */
export interface ReorderModulesRequest {
  moduleIds: string[];
}

export interface ModuleResponse {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  lessonCount?: number | null;
  // Returned when GET /modules/{id}?expand=submissionCount and the caller teaches the course:
  // student submissions inside, drafts included.
  submissionCount?: number | null;
  createdAt: number;
  updatedAt: number;
}

/** Tokens the module GET endpoint accepts for `?expand=`. */
export type ModuleExpand = 'submissionCount';
