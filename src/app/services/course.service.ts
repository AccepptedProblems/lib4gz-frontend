import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateCourseRequest,
  UpdateCourseRequest,
  CourseResponse,
  CourseListType
} from '../shared/models';

@Injectable({ providedIn: 'root' })
export class CourseService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/courses`;

  list(type?: CourseListType): Observable<CourseResponse[]> {
    let params = new HttpParams();
    if (type) {
      params = params.set('type', type);
    }
    return this.http.get<CourseResponse[]>(this.baseUrl, { params });
  }

  create(request: CreateCourseRequest): Observable<CourseResponse> {
    return this.http.post<CourseResponse>(this.baseUrl, request);
  }

  get(id: string): Observable<CourseResponse> {
    return this.http.get<CourseResponse>(`${this.baseUrl}/${id}`);
  }

  update(id: string, request: UpdateCourseRequest): Observable<CourseResponse> {
    return this.http.patch<CourseResponse>(`${this.baseUrl}/${id}`, request);
  }

  getByCode(code: string): Observable<CourseResponse> {
    return this.http.get<CourseResponse>(`${this.baseUrl}/code/${code}`);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}
