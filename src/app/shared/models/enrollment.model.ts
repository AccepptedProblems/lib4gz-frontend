import { EnrollmentRole, EnrollmentStatus } from './enums';
import { UserSummary } from './common.model';

export interface EnrollmentRequest {
  role?: EnrollmentRole;
}

export interface UpdateEnrollmentRequest {
  role?: EnrollmentRole | null;
  status?: EnrollmentStatus | null;
}

export interface EnrollmentResponse {
  id: string;
  courseId: string;
  courseName: string;
  user: UserSummary;
  role: EnrollmentRole;
  status: EnrollmentStatus;
  joinedAt: number | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * Lightweight self-enrollment view embedded in `CourseResponse` / `SyllabusResponse`.
 * Removes the dedicated `GET /courses/{id}/my-enrollment` round-trip.
 */
export interface EnrollmentSummary {
  id: string;
  role: EnrollmentRole;
  status: EnrollmentStatus;
  joinedAt: number | null;
}
