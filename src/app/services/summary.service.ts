import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateSummaryRequest,
  UpdateSummaryRequest,
  SummaryResponse
} from '../shared/models';
import { CourseCacheService } from './course-cache.service';

@Injectable({ providedIn: 'root' })
export class SummaryService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CourseCacheService);
  private readonly apiUrl = environment.apiUrl;

  /** When `courseId` is provided, the response is served through the freshness cache. */
  get(lessonId: string, courseId?: string): Observable<SummaryResponse> {
    const fetch$ = this.http.get<SummaryResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}/summary`
    );
    if (!courseId) {
      return fetch$;
    }
    return this.cache.cachedGet({
      courseId,
      resourceType: 'SUMMARY',
      cacheKey: `summary:${lessonId}`,
      fetch$,
    });
  }

  createOrUpdate(lessonId: string, request: CreateSummaryRequest | UpdateSummaryRequest): Observable<SummaryResponse> {
    return this.http.post<SummaryResponse>(
      `${this.apiUrl}/v1/lessons/${lessonId}/summary`,
      request
    ).pipe(tap(() => this.cache.bustFreshness()));
  }
}
