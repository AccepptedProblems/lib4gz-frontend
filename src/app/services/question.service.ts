import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateQuestionsRequest,
  UpdateQuestionsRequest,
  QuestionResponse,
  QuestionsResponse
} from '../shared/models';

@Injectable({ providedIn: 'root' })
export class QuestionService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listByExercise(exerciseId: string): Observable<QuestionResponse[]> {
    return this.http.get<QuestionResponse[]>(
      `${this.apiUrl}/v1/exercises/${exerciseId}/questions`
    );
  }

  batchCreate(exerciseId: string, request: CreateQuestionsRequest): Observable<QuestionResponse[]> {
    return this.http.post<QuestionResponse[]>(
      `${this.apiUrl}/v1/exercises/${exerciseId}/questions`,
      request
    );
  }

  batchUpdate(exerciseId: string, request: UpdateQuestionsRequest): Observable<QuestionsResponse> {
    return this.http.patch<QuestionsResponse>(
      `${this.apiUrl}/v1/exercises/${exerciseId}/questions`,
      request
    );
  }
}
