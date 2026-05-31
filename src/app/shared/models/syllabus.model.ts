import { CourseResponse } from './course.model';
import { LessonResponse } from './lesson.model';

/**
 * Composite response for `GET /v1/courses/{id}/syllabus`.
 *
 * One round-trip replaces the chained `course → modules → my-enrollment → lessons` load
 * that course shell screens (`CourseLayout`, `CourseHome`, `CourseMaterial`) used to issue.
 *
 * `course.myEnrollment` reflects the caller's relationship — gate UI on it without an
 * additional request.
 */
export interface SyllabusResponse {
  course: CourseResponse;
  modules: SyllabusModule[];
}

export interface SyllabusModule {
  id: string;
  courseId: string;
  title: string;
  orderIndex: number;
  lessonCount: number;
  createdAt: number;
  updatedAt: number;
  lessons: LessonResponse[];
}
