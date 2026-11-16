import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { RaceService } from './race.service';
import { environment } from '../../environments/environment';

const RACES = `${environment.apiUrl}/v1/courses/crs_1/races`;

describe('RaceService', () => {
  let service: RaceService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(RaceService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deals a race with a POST of the scope and the count', () => {
    service.startRace('crs_1', { moduleId: 'mod_a', questionCount: 24 }).subscribe();
    const req = http.expectOne(RACES);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ moduleId: 'mod_a', questionCount: 24 });
    req.flush({ raceId: 'rce_1', seed: 1, questions: [] });
  });

  it('sends an answer, a timeout as a null choice, to the race\'s answers', () => {
    service.answerRace('crs_1', 'rce_1', { seq: 3, choice: null }).subscribe();
    const req = http.expectOne(`${RACES}/rce_1/answers`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ seq: 3, choice: null });
    req.flush({ seq: 3, correct: false, correctCount: 0, wrongCount: 1 });
  });

  it('finishes a race with a POST of the time', () => {
    service.finishRace('crs_1', 'rce_1', { finishMs: 183456 }).subscribe();
    const req = http.expectOne(`${RACES}/rce_1/finish`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ finishMs: 183456 });
    req.flush({});
  });
});
