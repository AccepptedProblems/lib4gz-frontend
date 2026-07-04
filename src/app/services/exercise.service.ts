import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateExerciseRequest,
  UpdateExerciseRequest,
  ExerciseResponse,
  ExerciseExpand
} from '../shared/models';
import { CourseCacheService } from './course-cache.service';

export interface ExerciseListOptions {
  expand?: ExerciseExpand[];
  /** When set (and no expand is used), the list is served through the freshness cache. */
  courseId?: string;
}

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CourseCacheService);
  private readonly apiUrl = environment.apiUrl;

  create(lessonId: string, request: CreateExerciseRequest): Observable<ExerciseResponse> {
    return this.http.post<ExerciseResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}/exercises`,
      request
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  /**
   * `expand` supports `questions`, `mySubmission`. Used by Exercise Attempt and Lesson
   * Exercises tab to load everything in one round-trip.
   *
   * Only the plain (no-expand) shape is cached — the Exercise Attempt payload embeds
   * the caller's draft submission and stays network-only.
   */
  listByLesson(lessonId: string, options?: ExerciseListOptions): Observable<ExerciseResponse[]> {
    let params = new HttpParams();
    if (options?.expand?.length) {
      params = params.set('expand', options.expand.join(','));
    }
    const fetch$ = this.http.get<ExerciseResponse[]>(
      `${this.apiUrl}/v1/lessons/${lessonId}/exercises`,
      { params }
    );
    if (!options?.courseId || options.expand?.length) {
      return fetch$;
    }
    return this.cache.cachedGet({
      courseId: options.courseId,
      resourceType: 'EXERCISE',
      cacheKey: `exercises:${lessonId}`,
      fetch$,
    });
  }

  get(exerciseId: string, options?: ExerciseListOptions): Observable<ExerciseResponse> {
    let params = new HttpParams();
    if (options?.expand?.length) {
      params = params.set('expand', options.expand.join(','));
    }
    return this.http.get<ExerciseResponse>(
      `${this.apiUrl}/v1/exercises/${exerciseId}`,
      { params }
    );
  }

  update(exerciseId: string, request: UpdateExerciseRequest): Observable<ExerciseResponse> {
    return this.http.patch<ExerciseResponse>(
      `${this.apiUrl}/v1/exercises/${exerciseId}`,
      request
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  delete(exerciseId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/v1/exercises/${exerciseId}`).pipe(
      tap(() => this.cache.bustFreshness())
    );
  }
}
