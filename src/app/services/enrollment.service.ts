import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  EnrollmentRequest,
  UpdateEnrollmentRequest,
  EnrollmentResponse
} from '../shared/models';

@Injectable({ providedIn: 'root' })
export class EnrollmentService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  enroll(courseId: string, request?: EnrollmentRequest): Observable<EnrollmentResponse> {
    return this.http.post<EnrollmentResponse>(
      `${this.apiUrl}/v1/courses/${courseId}/enroll`,
      request ?? {}
    );
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
    );
  }

  approve(enrollmentId: string): Observable<EnrollmentResponse> {
    return this.http.post<EnrollmentResponse>(
      `${this.apiUrl}/v1/enrollments/${enrollmentId}/approve`,
      {}
    );
  }

  reject(enrollmentId: string): Observable<EnrollmentResponse> {
    return this.http.post<EnrollmentResponse>(
      `${this.apiUrl}/v1/enrollments/${enrollmentId}/reject`,
      {}
    );
  }

  delete(enrollmentId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/v1/enrollments/${enrollmentId}`);
  }
}
