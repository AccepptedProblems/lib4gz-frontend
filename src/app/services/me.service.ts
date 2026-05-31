import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import { MeCoursesResponse } from '../shared/models';

/**
 * Self-scoped composite reads (under `/v1/me`).
 *
 * Keeps the dashboard's two `enrolled` + `created` lists behind a single round-trip and
 * provides a single seam to add future self-scoped data (recent activity, pending
 * approvals, etc.) without changing call sites.
 */
@Injectable({ providedIn: 'root' })
export class MeService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/v1/me`;

  getCourses(): Observable<MeCoursesResponse> {
    return this.http.get<MeCoursesResponse>(`${this.baseUrl}/courses`);
  }
}
