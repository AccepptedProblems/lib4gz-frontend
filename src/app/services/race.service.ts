import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  CreateRaceResultRequest,
  LeaderboardResponse,
  RaceQuestionResponse,
  RaceResultResponse,
  ReplaceRaceQuestionsRequest,
} from '../shared/models';

/** Lightning Kart: the course's race question bank, saved results and the leaderboard. Nothing here is cached. */
@Injectable({ providedIn: 'root' })
export class RaceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  listQuestions(courseId: string): Observable<RaceQuestionResponse[]> {
    return this.http.get<RaceQuestionResponse[]>(
      `${this.apiUrl}/v1/courses/${courseId}/race-questions`
    );
  }

  /** Replaces the whole bank; returns it as the server now holds it, ids assigned. */
  replaceQuestions(courseId: string, request: ReplaceRaceQuestionsRequest): Observable<RaceQuestionResponse[]> {
    return this.http.put<RaceQuestionResponse[]>(
      `${this.apiUrl}/v1/courses/${courseId}/race-questions`,
      request
    );
  }

  saveResult(courseId: string, request: CreateRaceResultRequest): Observable<RaceResultResponse> {
    return this.http.post<RaceResultResponse>(
      `${this.apiUrl}/v1/courses/${courseId}/race-results`,
      request
    );
  }

  /** Omit `moduleId` for the whole course. */
  leaderboard(courseId: string, moduleId?: string): Observable<LeaderboardResponse> {
    let params = new HttpParams();
    if (moduleId) params = params.set('moduleId', moduleId);
    return this.http.get<LeaderboardResponse>(
      `${this.apiUrl}/v1/courses/${courseId}/race-leaderboard`,
      { params }
    );
  }
}
