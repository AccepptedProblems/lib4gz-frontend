import { SubmissionStatus } from './enums';
import { UserSummary } from './common.model';

export interface AnswerRequest {
  questionId: string;
  answer: string | null;
}

export interface CreateSubmissionRequest {
  answers?: AnswerRequest[];
}

export interface UpdateSubmissionRequest {
  answers: AnswerRequest[];
}

export interface CommentRequest {
  comment: string;
}

export interface RevisionRequest {
  feedback?: string | null;
}

export interface StudentAnswerResponse {
  id: string;
  questionId: string;
  questionContent: string;
  answer: string | null;
  teacherComment: string | null;
  createdAt: number;
  updatedAt: number;
}

export interface SubmissionResponse {
  id: string;
  exerciseId: string;
  user: UserSummary;
  status: SubmissionStatus;
  answers?: StudentAnswerResponse[] | null;
  createdAt: number;
  updatedAt: number;
  submittedAt: number | null;
  approvedAt: number | null;
}
