import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateExerciseRequest,
  UpdateExerciseRequest,
  ExerciseResponse
} from '../shared/models';

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

  listByLesson(lessonId: string): Observable<ExerciseResponse[]> {
    return this.http.get<ExerciseResponse[]>(
      `${this.apiUrl}/v1/lessons/${lessonId}/exercises`
    );
  }

  get(exerciseId: string): Observable<ExerciseResponse> {
    return this.http.get<ExerciseResponse>(`${this.apiUrl}/v1/exercises/${exerciseId}`);
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
