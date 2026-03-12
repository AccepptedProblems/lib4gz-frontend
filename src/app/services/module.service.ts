import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateModuleRequest,
  UpdateModuleRequest,
  ModuleResponse
} from '../shared/models';

@Injectable({ providedIn: 'root' })
export class ModuleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  create(courseId: string, request: CreateModuleRequest): Observable<ModuleResponse> {
    return this.http.post<ModuleResponse>(
      `${this.apiUrl}/v1/courses/${courseId}/modules`,
      request
    );
  }

  listByCourse(courseId: string): Observable<ModuleResponse[]> {
    return this.http.get<ModuleResponse[]>(
      `${this.apiUrl}/v1/courses/${courseId}/modules`
    );
  }

  get(moduleId: string): Observable<ModuleResponse> {
    return this.http.get<ModuleResponse>(`${this.apiUrl}/v1/modules/${moduleId}`);
  }

  update(moduleId: string, request: UpdateModuleRequest): Observable<ModuleResponse> {
    return this.http.patch<ModuleResponse>(
      `${this.apiUrl}/v1/modules/${moduleId}`,
      request
    );
  }

  delete(moduleId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/v1/modules/${moduleId}`);
  }
}
