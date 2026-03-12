import { UserSummary } from './common.model';

export interface CreateSummaryRequest {
  content: string;
}

export interface UpdateSummaryRequest {
  content: string;
}

export interface SummaryResponse {
  id: string;
  lessonId: string;
  content: string;
  editedBy: UserSummary;
  version: number;
  createdAt: number;
  updatedAt: number;
}
