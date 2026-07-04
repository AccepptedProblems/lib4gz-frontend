import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateCourseRequest,
  UpdateCourseRequest,
  CourseResponse,
  CourseListType,
  SyllabusResponse
} from '../shared/models';
import { CourseCacheService } from './course-cache.service';

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CourseCacheService);
  private readonly baseUrl = `${environment.apiUrl}/v1/courses`;

  list(type?: CourseListType): Observable<CourseResponse[]> {
    let params = new HttpParams();
    if (type) {
      params = params.set('type', type);
    }
    return this.http.get<CourseResponse[]>(this.baseUrl, { params });
  }

  create(request: CreateCourseRequest): Observable<CourseResponse> {
    return this.http.post<CourseResponse>(this.baseUrl, request).pipe(
      tap(() => this.cache.bustFreshness())
    );
  }

  get(id: string): Observable<CourseResponse> {
    return this.http.get<CourseResponse>(`${this.baseUrl}/${id}`);
  }

  update(id: string, request: UpdateCourseRequest): Observable<CourseResponse> {
    return this.http.patch<CourseResponse>(`${this.baseUrl}/${id}`, request).pipe(
      tap(() => this.cache.bustFreshness())
    );
  }

  getByCode(code: string): Observable<CourseResponse> {
    return this.http.get<CourseResponse>(`${this.baseUrl}/code/${code}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`).pipe(
      tap(() => this.cache.bustFreshness())
    );
  }

  /**
   * One-shot course shell load: course + my enrollment + modules + lessons.
   * Replaces the 4-RTT fan-out used by `CourseLayout` / `CourseHome` / `CourseMaterial`.
   * Served through the freshness cache: unchanged courses come from IndexedDB.
   */
  getSyllabus(id: string): Observable<SyllabusResponse> {
    return this.cache.cachedGet({
      courseId: id,
      resourceType: 'SYLLABUS',
      cacheKey: 'syllabus',
      fetch$: this.http.get<SyllabusResponse>(`${this.baseUrl}/${id}/syllabus`),
    });
  }
}
