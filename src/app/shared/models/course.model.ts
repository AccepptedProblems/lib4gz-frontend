import { Visibility } from './enums';
import { UserSummary } from './common.model';

export interface CreateCourseRequest {
  title: string;
  description?: string | null;
  visibility?: Visibility;
  settings?: Record<string, any>;
}

export interface UpdateCourseRequest {
  title?: string | null;
  description?: string | null;
  visibility?: Visibility | null;
  settings?: Record<string, any> | null;
}

export interface CourseResponse {
  id: string;
  code: string;
  title: string;
  description: string | null;
  visibility: Visibility;
  createdBy: UserSummary;
  settings: Record<string, any>;
  createdAt: number;
  updatedAt: number;
  moduleCount?: number | null;
  enrollmentCount?: number | null;
}

export type CourseListType = 'created' | 'enrolled' | 'public';
