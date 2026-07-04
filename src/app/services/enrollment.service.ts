import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  EnrollmentRequest,
  UpdateEnrollmentRequest,
  EnrollmentResponse
} from '../shared/models';
import { CourseCacheService } from './course-cache.service';

@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CourseCacheService);
  private readonly apiUrl = environment.apiUrl;

  enroll(courseId: string, request?: EnrollmentRequest): Observable<EnrollmentResponse> {
    return this.http.post<EnrollmentResponse>(
      `${this.apiUrl}/v1/courses/${courseId}/enroll`,
      request ?? {}
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  listByCourse(courseId: string): Observable<EnrollmentResponse[]> {
    return this.http.get<EnrollmentResponse[]>(
      `${this.apiUrl}/v1/courses/${courseId}/enrollments`
    );
  }

  getMyEnrollment(courseId: string): Observable<EnrollmentResponse> {
    return this.http.get<EnrollmentResponse>(
      `${this.apiUrl}/v1/courses/${courseId}/my-enrollment`
    );
  }

  update(enrollmentId: string, request: UpdateEnrollmentRequest): Observable<EnrollmentResponse> {
    return this.http.put<EnrollmentResponse>(
      `${this.apiUrl}/v1/enrollments/${enrollmentId}`,
      request
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  approve(enrollmentId: string): Observable<EnrollmentResponse> {
    return this.http.post<EnrollmentResponse>(
      `${this.apiUrl}/v1/enrollments/${enrollmentId}/approve`,
      {}
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  reject(enrollmentId: string): Observable<EnrollmentResponse> {
    return this.http.post<EnrollmentResponse>(
      `${this.apiUrl}/v1/enrollments/${enrollmentId}/reject`,
      {}
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  delete(enrollmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/v1/enrollments/${enrollmentId}`).pipe(
      tap(() => this.cache.bustFreshness())
    );
  }
}
