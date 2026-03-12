import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateSubmissionRequest,
  UpdateSubmissionRequest,
  CommentRequest,
  RevisionRequest,
  SubmissionResponse
} from '../shared/models';

@Injectable({ providedIn: 'root' })
export class SubmissionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listByExercise(exerciseId: string): Observable<SubmissionResponse[]> {
    return this.http.get<SubmissionResponse[]>(
      `${this.apiUrl}/v1/exercises/${exerciseId}/submissions`
    );
  }

  getMySubmission(exerciseId: string): Observable<SubmissionResponse> {
    return this.http.get<SubmissionResponse>(
      `${this.apiUrl}/v1/exercises/${exerciseId}/my-submission`
    );
  }

  createOrUpdate(
    exerciseId: string,
    request: CreateSubmissionRequest | UpdateSubmissionRequest
  ): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(
      `${this.apiUrl}/v1/exercises/${exerciseId}/submissions`,
      request
    );
  }

  get(submissionId: string): Observable<SubmissionResponse> {
    return this.http.get<SubmissionResponse>(
      `${this.apiUrl}/v1/submissions/${submissionId}`
    );
  }

  submit(submissionId: string): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(
      `${this.apiUrl}/v1/submissions/${submissionId}/submit`,
      {}
    );
  }

  approve(submissionId: string): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(
      `${this.apiUrl}/v1/submissions/${submissionId}/approve`,
      {}
    );
  }

  requestRevision(submissionId: string, request?: RevisionRequest): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(
      `${this.apiUrl}/v1/submissions/${submissionId}/revision`,
      request ?? {}
    );
  }

  addComment(answerId: string, request: CommentRequest): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(
      `${this.apiUrl}/v1/answers/${answerId}/comment`,
      request
    );
  }
}
