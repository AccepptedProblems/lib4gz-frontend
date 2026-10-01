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
  // Caller's progress, server-derived from submissions. Present on enrolled
  // listings (GET /v1/users/me/courses) and the syllabus; null elsewhere.
  progress?: CourseProgressResponse | null;
}

/**
 * Server-side course progress. A lesson counts as done when all of its exercises
 * are SUBMITTED/APPROVED; lessons without exercises are excluded, so
 * `totalLessons` is the number of exercise-bearing lessons. `totalLessons === 0`
 * means no gradable content yet — render no percentage.
 */
export interface CourseProgressResponse {
  completedLessons: number;
  totalLessons: number;
  lastVisitedLessonId?: string | null;
  lastVisitedLessonTitle?: string | null;
  lastVisitedAt?: number | null;
}

export type CourseListType = 'created' | 'enrolled' | 'public';

/**
 * Dashboard composite response — replaces the two parallel `list(type=enrolled|created)` calls.
 */
export interface MeCoursesResponse {
  enrolled: CourseResponse[];
  created: CourseResponse[];
}
