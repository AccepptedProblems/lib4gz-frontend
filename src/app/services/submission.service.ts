import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateSubmissionRequest,
  UpdateSubmissionRequest,
  CommentRequest,
  RevisionRequest,
  SubmissionResponse,
  LessonSubmissionsResponse,
  LessonSubmissionsExpand
} from '../shared/models';
import { CourseCacheService } from './course-cache.service';

export interface LessonSubmissionsOptions {
  expand?: LessonSubmissionsExpand[];
  /** When set, the review queue is served through the freshness cache. */
  courseId?: string;
}

@Injectable({ providedIn: 'root' })
export class SubmissionService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CourseCacheService);
  private readonly apiUrl = environment.apiUrl;

  /**
   * Teacher review queue for one lesson — composite response.
   * Replaces the 1 + 3N + M fan-out the Lesson Submissions tab used to issue.
   * The SUBMISSION token only moves on submit/approve/revision/comment (never on
   * student autosave drafts), so caching this tab is safe.
   */
  listByLesson(
    lessonId: string,
    options?: LessonSubmissionsOptions
  ): Observable<LessonSubmissionsResponse> {
    let params = new HttpParams();
    if (options?.expand?.length) {
      params = params.set('expand', options.expand.join(','));
    }
    const fetch$ = this.http.get<LessonSubmissionsResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}/submissions`,
      { params }
    );
    if (!options?.courseId) {
      return fetch$;
    }
    return this.cache.cachedGet({
      courseId: options.courseId,
      resourceType: 'SUBMISSION',
      cacheKey: `lesson-submissions:${lessonId}:${(options.expand ?? []).join(',')}`,
      fetch$,
    });
  }

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
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  approve(submissionId: string): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(
      `${this.apiUrl}/v1/submissions/${submissionId}/approve`,
      {}
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  requestRevision(submissionId: string, request?: RevisionRequest): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(
      `${this.apiUrl}/v1/submissions/${submissionId}/revision`,
      request ?? {}
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  addComment(answerId: string, request: CommentRequest): Observable<SubmissionResponse> {
    return this.http.post<SubmissionResponse>(
      `${this.apiUrl}/v1/answers/${answerId}/comment`,
      request
    ).pipe(tap(() => this.cache.bustFreshness()));
  }
}
