import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateSummaryRequest,
  UpdateSummaryRequest,
  SummaryResponse
} from '../shared/models';

@Injectable({ providedIn: 'root' })
export class SummaryService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  get(lessonId: string): Observable<SummaryResponse> {
    return this.http.get<SummaryResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}/summary`
    );
  }

  createOrUpdate(lessonId: string, request: CreateSummaryRequest | UpdateSummaryRequest): Observable<SummaryResponse> {
    return this.http.post<SummaryResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}/summary`,
      request
    );
  }
}
