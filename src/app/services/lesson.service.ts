import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateLessonRequest,
  UpdateLessonRequest,
  LessonResponse
} from '../shared/models';

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

  get(lessonId: string): Observable<LessonResponse> {
    return this.http.get<LessonResponse>(`${this.apiUrl}/v1/lessons/${lessonId}`);
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
