import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateModuleRequest,
  UpdateModuleRequest,
  ModuleResponse,
  ModuleExpand,
  ReorderModulesRequest
} from '../shared/models';
import { CourseCacheService } from './course-cache.service';

/** Optional flags for `get(moduleId, options)`. */
export interface ModuleGetOptions {
  expand?: ModuleExpand[];
}

@Injectable({ providedIn: 'root' })
export class ModuleService {
  private readonly http = inject(HttpClient);
  private readonly cache = inject(CourseCacheService);
  private readonly apiUrl = environment.apiUrl;

  create(courseId: string, request: CreateModuleRequest): Observable<ModuleResponse> {
    return this.http.post<ModuleResponse>(
      `${this.apiUrl}/v1/courses/${courseId}/modules`,
      request
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  listByCourse(courseId: string): Observable<ModuleResponse[]> {
    return this.http.get<ModuleResponse[]>(
      `${this.apiUrl}/v1/courses/${courseId}/modules`
    );
  }

  get(moduleId: string, options?: ModuleGetOptions): Observable<ModuleResponse> {
    let params = new HttpParams();
    if (options?.expand?.length) {
      params = params.set('expand', options.expand.join(','));
    }
    return this.http.get<ModuleResponse>(`${this.apiUrl}/v1/modules/${moduleId}`, { params });
  }

  update(moduleId: string, request: UpdateModuleRequest): Observable<ModuleResponse> {
    return this.http.patch<ModuleResponse>(
      `${this.apiUrl}/v1/modules/${moduleId}`,
      request
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  /** Sends every module of the course in the new order; returns them as `listByCourse` does. */
  reorder(courseId: string, moduleIds: string[]): Observable<ModuleResponse[]> {
    const body: ReorderModulesRequest = { moduleIds };
    return this.http.put<ModuleResponse[]>(
      `${this.apiUrl}/v1/courses/${courseId}/modules/order`,
      body
    ).pipe(tap(() => this.cache.bustFreshness()));
  }

  delete(moduleId: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/v1/modules/${moduleId}`).pipe(
      tap(() => this.cache.bustFreshness())
    );
  }
}
