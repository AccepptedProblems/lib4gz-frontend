import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateLessonRequest,
  UpdateLessonRequest,
  LessonResponse,
  LessonExpand,
  ReorderLessonsRequest
} from '../shared/models';
import { CourseCacheService } from './course-cache.service';

/** Optional flags for `get(lessonId, options)`. */
export interface LessonGetOptions {
  expand?: LessonExpand[];
  /** When set (and no expand is used), the response is served through the freshness cache. */
  courseId?: string;
}

@Injectable({ providedIn: 'root' })
export class LessonService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CourseCacheService);
  private readonly apiUrl = environment.apiUrl;

  create(moduleId: string, request: CreateLessonRequest): Observable<LessonResponse> {
    return this.http.post<LessonResponse>(
      `${this.apiUrl}/v1/modules/${moduleId}/lessons`,
      request
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  listByModule(moduleId: string): Observable<LessonResponse[]> {
    return this.http.get<LessonResponse[]>(
      `${this.apiUrl}/v1/modules/${moduleId}/lessons`
    );
  }

  /**
   * `expand` supports `summary`, `exercises`, `module`. Combine with the exercise-level
   * tokens (`questions`, `mySubmission`) to populate the Exercise Attempt screen in
   * a single round-trip via the lesson endpoint.
   *
   * Only the plain (no-expand) shape is cached — expanded payloads embed per-user
   * submission state and stay network-only.
   */
  get(lessonId: string, options?: LessonGetOptions): Observable<LessonResponse> {
    let params = new HttpParams();
    if (options?.expand?.length) {
      params = params.set('expand', options.expand.join(','));
    }
    const fetch$ = this.http.get<LessonResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}`,
      { params }
    );
    if (!options?.courseId || options.expand?.length) {
      return fetch$;
    }
    return this.cache.cachedGet({
      courseId: options.courseId,
      resourceType: 'LESSON',
      cacheKey: `lesson:${lessonId}`,
      fetch$,
    });
  }

  update(lessonId: string, request: UpdateLessonRequest): Observable<LessonResponse> {
    return this.http.patch<LessonResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}`,
      request
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  /** Sends every lesson of the module in the new order; returns them as `listByModule` does. */
  reorder(moduleId: string, lessonIds: string[]): Observable<LessonResponse[]> {
    const body: ReorderLessonsRequest = { lessonIds };
    return this.http.put<LessonResponse[]>(
      `${this.apiUrl}/v1/modules/${moduleId}/lessons/order`,
      body
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  delete(lessonId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/v1/lessons/${lessonId}`).pipe(
      tap(() => this.cache.bustFreshness())
    );
  }
}
