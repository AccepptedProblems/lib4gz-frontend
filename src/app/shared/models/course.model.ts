import { Visibility } from './enums';
import { UserSummary } from './common.model';
import { EnrollmentSummary } from './enrollment.model';

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
  // Denormalized: caller's enrollment. Null when unenrolled (PUBLIC visibility only).
  myEnrollment?: EnrollmentSummary | null;
}

export type CourseListType = 'created' | 'enrolled' | 'public';

/**
 * Dashboard composite response — replaces the two parallel `list(type=enrolled|created)` calls.
 */
export interface MeCoursesResponse {
  enrolled: CourseResponse[];
  created: CourseResponse[];
}
