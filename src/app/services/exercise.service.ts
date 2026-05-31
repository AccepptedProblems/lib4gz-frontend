import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateExerciseRequest,
  UpdateExerciseRequest,
  ExerciseResponse,
  ExerciseExpand
} from '../shared/models';

export interface ExerciseListOptions {
  expand?: ExerciseExpand[];
}

@Injectable({ providedIn: 'root' })
export class ExerciseService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  create(lessonId: string, request: CreateExerciseRequest): Observable<ExerciseResponse> {
    return this.http.post<ExerciseResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}/exercises`,
      request
    );
  }

  /**
   * `expand` supports `questions`, `mySubmission`. Used by Exercise Attempt and Lesson
   * Exercises tab to load everything in one round-trip.
   */
  listByLesson(lessonId: string, options?: ExerciseListOptions): Observable<ExerciseResponse[]> {
    let params = new HttpParams();
    if (options?.expand?.length) {
      params = params.set('expand', options.expand.join(','));
    }
    return this.http.get<ExerciseResponse[]>(
      `${this.apiUrl}/v1/lessons/${lessonId}/exercises`,
      { params }
    );
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
    );
  }

  delete(exerciseId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/v1/exercises/${exerciseId}`);
  }
}
