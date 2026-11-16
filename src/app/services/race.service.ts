import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';
import {
  FinishRaceRequest,
  LeaderboardResponse,
  RaceAnswerRequest,
  RaceAnswerResponse,
  RaceQuestionResponse,
  RaceResultResponse,
  ReplaceRaceQuestionsRequest,
  StartRaceRequest,
  StartRaceResponse,
} from '../shared/models';

/** Lightning Kart: the course's race question bank, a race's deal, answers and finish, and the leaderboard. Nothing here is cached. */
@Injectable({ providedIn: 'root' })
export class RaceService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /** A student gets no options and no key: enough to count a scope's questions. */
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

  /** Deals a new race; every call is a new race. */
  startRace(courseId: string, request: StartRaceRequest): Observable<StartRaceResponse> {
    return this.http.post<StartRaceResponse>(
      `${this.apiUrl}/v1/courses/${courseId}/races`,
      request
    );
  }

  answerRace(courseId: string, raceId: string, request: RaceAnswerRequest): Observable<RaceAnswerResponse> {
    return this.http.post<RaceAnswerResponse>(
      `${this.apiUrl}/v1/courses/${courseId}/races/${raceId}/answers`,
      request
    );
  }

  /** Saves the result from the server's own counts. A second finish of one race is a 409. */
  finishRace(courseId: string, raceId: string, request: FinishRaceRequest): Observable<RaceResultResponse> {
    return this.http.post<RaceResultResponse>(
      `${this.apiUrl}/v1/courses/${courseId}/races/${raceId}/finish`,
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
