import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateLessonRequest,
  UpdateLessonRequest,
  LessonResponse,
  LessonExpand
} from '../shared/models';

/** Optional flags for `get(lessonId, options)`. */
export interface LessonGetOptions {
  expand?: LessonExpand[];
}

@Injectable({ providedIn: 'root' })
export class LessonService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  create(moduleId: string, request: CreateLessonRequest): Observable<LessonResponse> {
    return this.http.post<LessonResponse>(
      `${this.apiUrl}/v1/modules/${moduleId}/lessons`,
      request
    );
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
   */
  get(lessonId: string, options?: LessonGetOptions): Observable<LessonResponse> {
    let params = new HttpParams();
    if (options?.expand?.length) {
      params = params.set('expand', options.expand.join(','));
    }
    return this.http.get<LessonResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}`,
      { params }
    );
  }

  update(lessonId: string, request: UpdateLessonRequest): Observable<LessonResponse> {
    return this.http.patch<LessonResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}`,
      request
    );
  }

  delete(lessonId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/v1/lessons/${lessonId}`);
  }
}
