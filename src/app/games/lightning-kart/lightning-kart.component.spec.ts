import { ComponentFixture, TestBed, fakeAsync, flushMicrotasks, tick } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { environment } from '../../../environments/environment';
import { AuthService, MeService } from '../../services';
import { RaceResultResponse } from '../../shared/models';
import { CourseLayoutComponent } from '../../components/course/course-layout/course-layout.component';
import { Bridge, DealtRace, FinishedRace, RaceScope } from './bridge';
import { C } from './engine/constants';
import { LightningKartComponent } from './lightning-kart.component';

const RACES = `${environment.apiUrl}/v1/courses/crs_1/races`;
const BOARD = `${environment.apiUrl}/v1/courses/crs_1/race-leaderboard`;
const DEAL_FAILED = 'The race could not start. Check your connection and press START again.';
const RACE: FinishedRace = { scope: 'mod_a', raceId: 'rce_1', finishMs: 183456 };
const RESULT: RaceResultResponse = {
  id: 'rrs_1', userId: 'usr_me', courseId: 'crs_1', moduleId: 'mod_a', finishMs: 183456, correctCount: 10, wrongCount: 4, seed: 7, createdAt: 0,
  // As the server sends it: an entry only at the first four wrong numbers, null elsewhere.
  answerKey: [null, 2, null, null, 0, 1, null, 3, null, null, null, null, null, null],
};

/** The host's calls, reached as the bridge reaches them, without the game. */
interface Host {
  bridge: Bridge;
  deal(scope: RaceScope, questionCount: number, signal: AbortSignal): Promise<DealtRace>;
  answer(raceId: string, seq: number, choice: number | null): Promise<'right' | 'wrong'>;
  saveResult(race: FinishedRace): void;
  loadLeaderboard(scope: RaceScope): void;
}

const SAVE_FAILED = 'Could not save your time.';

/** Lets settled promises run their callbacks. */
const settle = (): Promise<void> => new Promise(resolve => setTimeout(resolve, 0));

/** The host's calls to the server, with no game created: its view is never initialised. */
describe('LightningKartComponent calls', () => {
  let host: Host;
  let fixture: ComponentFixture<LightningKartComponent>;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(), provideHttpClientTesting(),
        { provide: CourseLayoutComponent, useValue: { courseId: () => 'crs_1', modulesWithLessons: () => [] } },
        { provide: AuthService, useValue: { currentUser: () => null } },
        { provide: MeService, useValue: {} },
        { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap({}) } } },
      ],
    });
    fixture = TestBed.createComponent(LightningKartComponent);
    host = fixture.componentInstance as unknown as Host;
    host.bridge = new Bridge({
      loading: false, error: null, questions: [], modules: [], user: { id: 'usr_me', name: 'Me' },
      look: { characterId: 'chr_bolt', kartId: 'krt_classic' }, lookError: null,
      leaderboard: null, leaderboardError: null, save: null, debug: null, track: null,
    }, {} as never);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('deals with the server\'s own text on a 403 and a fixed line on a 500', async () => {
    const forbidden = host.deal('mod_a', 24, new AbortController().signal);
    const req = http.expectOne(RACES);
    expect(req.request.body).toEqual({ moduleId: 'mod_a', questionCount: 24 });
    req.flush({ errors: [{ reason: 'You need an active enrollment in this course to race' }] }, { status: 403, statusText: 'Forbidden' });
    await expectAsync(forbidden).toBeRejectedWith('You need an active enrollment in this course to race');

    const broken = host.deal('course', 24, new AbortController().signal);
    const whole = http.expectOne(RACES);
    expect(whole.request.body).toEqual({ moduleId: null, questionCount: 24 });
    whole.flush('java.lang.NullPointerException', { status: 500, statusText: 'Server Error' });
    await expectAsync(broken).toBeRejectedWith(DEAL_FAILED);
  });

  it('gives up on the deal at its time limit, and cancels it on the signal', fakeAsync(() => {
    let reason: unknown;
    host.deal('course', 24, new AbortController().signal).catch(r => { reason = r; });
    const slow = http.expectOne(RACES);
    tick(C.net.dealMs - 1);
    flushMicrotasks();
    expect(reason).toBeUndefined();
    tick(1);
    flushMicrotasks();
    expect(slow.cancelled).toBeTrue();
    expect(reason).toBe(DEAL_FAILED);

    const controller = new AbortController();
    host.deal('course', 24, controller.signal).catch(() => undefined);
    const left = http.expectOne(RACES);
    controller.abort();
    flushMicrotasks();
    expect(left.cancelled).toBeTrue();
  }));

  it('answers for its own question, and rejects a 409 and a reply for another question', async () => {
    const right = host.answer('rce_1', 2, 1);
    const req = http.expectOne(`${RACES}/rce_1/answers`);
    expect(req.request.body).toEqual({ seq: 2, choice: 1 });
    req.flush({ seq: 2, correct: true, correctCount: 1, wrongCount: 0 });
    await expectAsync(right).toBeResolvedTo('right');

    const refused = host.answer('rce_1', 1, null);
    http.expectOne(`${RACES}/rce_1/answers`)
      .flush({ errors: [{ reason: 'That question has already been answered or skipped.' }] }, { status: 409, statusText: 'Conflict' });
    await expectAsync(refused).toBeRejected();

    const other = host.answer('rce_1', 3, 0);
    http.expectOne(`${RACES}/rce_1/answers`).flush({ seq: 2, correct: true, correctCount: 1, wrongCount: 0 });
    await expectAsync(other).toBeRejected();
  });

  /** The player chose `scope`: its board is asked for and answered. */
  function chooseScope(scope: RaceScope): void {
    host.loadLeaderboard(scope);
    http.expectOne(r => r.url === BOARD).flush({ rows: [], mine: null });
  }

  it('holds the finish until the answer still out settles, then reports the save and reloads the board', async () => {
    chooseScope('mod_a');
    const answer = host.answer('rce_1', 5, 0);
    const out = http.expectOne(`${RACES}/rce_1/answers`);
    host.saveResult(RACE);
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_1', state: 'saving' });
    await settle();
    http.expectNone(`${RACES}/rce_1/finish`);

    out.flush({ seq: 5, correct: false, correctCount: 3, wrongCount: 2 });
    await answer;
    await settle();
    const finish = http.expectOne(`${RACES}/rce_1/finish`);
    expect(finish.request.body).toEqual({ finishMs: 183456 });
    finish.flush(RESULT, { status: 201, statusText: 'Created' });
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_1', state: 'saved', result: RESULT });
    const board = http.expectOne(r => r.url === BOARD);
    expect(board.request.params.get('moduleId')).toBe('mod_a');
    expect(host.bridge.data.leaderboard).withContext('the board kept while it reloads').toEqual({ rows: [], mine: null });
    board.flush({ rows: [], mine: null });
  });

  it('reports a failed save in the server\'s words, and takes a 409 on the retry as saved', async () => {
    chooseScope('mod_a');
    host.saveResult(RACE);
    await settle();
    http.expectOne(`${RACES}/rce_1/finish`)
      .flush({ errors: [{ reason: 'That finish time is faster than your right answers allow.' }] }, { status: 400, statusText: 'Bad Request' });
    // A refusal: the same finish would be refused again, so no Retry.
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_1', state: 'failed', error: 'That finish time is faster than your right answers allow.', retry: false });
    http.expectNone(r => r.url === BOARD);

    host.saveResult(RACE);
    await settle();
    http.expectOne(`${RACES}/rce_1/finish`).flush({ errors: [{ reason: 'This race is already finished.' }] }, { status: 409, statusText: 'Conflict' });
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_1', state: 'saved', result: null });
    http.expectOne(r => r.url === BOARD).flush({ rows: [], mine: null });
  });

  it('gives up on the finish at its time limit as a failed save, which Retry can send again', fakeAsync(() => {
    chooseScope('mod_a');
    host.saveResult(RACE);
    flushMicrotasks();
    const hung = http.expectOne(`${RACES}/rce_1/finish`);
    tick(C.net.finishMs - 1);
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_1', state: 'saving' });
    tick(1);
    expect(hung.cancelled).toBeTrue();
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_1', state: 'failed', error: SAVE_FAILED, retry: true });

    host.saveResult(RACE); // Retry: the lost first one had saved it
    flushMicrotasks();
    http.expectOne(`${RACES}/rce_1/finish`).flush({ errors: [{ reason: 'This race is already finished.' }] }, { status: 409, statusText: 'Conflict' });
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_1', state: 'saved', result: null });
    http.expectOne(r => r.url === BOARD).flush({ rows: [], mine: null });
  }));

  it('reloads the board after a save only while the finished race\'s scope is still the one chosen', async () => {
    chooseScope('mod_a');
    host.saveResult(RACE);
    await settle();
    const finish = http.expectOne(`${RACES}/rce_1/finish`);
    chooseScope('mod_b'); // the player moved on before the save landed
    finish.flush(RESULT, { status: 201, statusText: 'Created' });
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_1', state: 'saved', result: RESULT });
    http.expectNone(r => r.url === BOARD);
  });

  it('offers Retry after a server fault', async () => {
    host.saveResult(RACE);
    await settle();
    http.expectOne(`${RACES}/rce_1/finish`).flush('boom', { status: 503, statusText: 'Unavailable' });
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_1', state: 'failed', error: SAVE_FAILED, retry: true });
  });

  it('sends a finish still held for an answer at once when the page goes, and the leaving does not cancel it', () => {
    host.answer('rce_1', 5, 0).catch(() => undefined);
    const out = http.expectOne(`${RACES}/rce_1/answers`);
    host.saveResult(RACE);
    http.expectNone(`${RACES}/rce_1/finish`);
    fixture.destroy();
    const finish = http.expectOne(`${RACES}/rce_1/finish`);
    expect(finish.request.body).toEqual({ finishMs: 183456 });
    expect(finish.cancelled).toBeFalse();
    out.flush({ seq: 5, correct: true, correctCount: 1, wrongCount: 0 });
    finish.flush(RESULT, { status: 201, statusText: 'Created' });
    http.expectNone(`${RACES}/rce_1/finish`); // and only once
  });

  it('gives up on an answer at its time limit', fakeAsync(() => {
    let failed = false;
    host.answer('rce_1', 0, 1).catch(() => { failed = true; });
    const slow = http.expectOne(`${RACES}/rce_1/answers`);
    tick(C.net.answerMs - 1);
    flushMicrotasks();
    expect(failed).toBeFalse();
    tick(1);
    flushMicrotasks();
    expect([failed, slow.cancelled]).toEqual([true, true]);
  }));

  it('drops the save reply of a race finished before the last one', async () => {
    host.saveResult(RACE);
    await settle();
    const first = http.expectOne(`${RACES}/rce_1/finish`);
    host.saveResult({ ...RACE, raceId: 'rce_2' });
    await settle();
    const second = http.expectOne(`${RACES}/rce_2/finish`);
    first.flush(RESULT, { status: 201, statusText: 'Created' });
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_2', state: 'saving' });
    second.flush({ ...RESULT, id: 'rrs_2' }, { status: 201, statusText: 'Created' });
    expect(host.bridge.data.save).toEqual({ raceId: 'rce_2', state: 'saved', result: { ...RESULT, id: 'rrs_2' } });
  });
});
