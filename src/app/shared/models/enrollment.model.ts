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
