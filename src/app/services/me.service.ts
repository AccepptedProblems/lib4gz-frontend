import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MeCoursesResponse, UpdateMeRequest, UserResponse } from '../shared/models';

/**
 * The signed-in user's own profile and dashboard data (under `/v1/users/me`).
 * Callers push fresh `UserResponse`s into `AuthService.setCurrentUser`; this service
 * does not inject AuthService, which would make an import cycle.
 * Changing the email is `AuthService.connectGoogle`: the address comes from the Google account.
 */
@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/users/me`;

  getMe(): Observable<UserResponse> {
    return this.http.get<UserResponse>(this.baseUrl);
  }

  updateMe(request: UpdateMeRequest): Observable<UserResponse> {
    return this.http.patch<UserResponse>(this.baseUrl, request);
  }

  getCourses(): Observable<MeCoursesResponse> {
    return this.http.get<MeCoursesResponse>(`${this.baseUrl}/courses`);
  }
}
