import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { errorInterceptor } from './error.interceptor';
import { jwtInterceptor } from './jwt.interceptor';
import { environment } from '../../environments/environment';
import {
  SERVER_ERROR, SESSION_KEYS, UNAUTHORIZED, clearSessionKeys, renewedSession, storeAnotherTabsPair, storeSession,
} from './session.spec-helpers';

/** Both interceptors in the app's order, so the refresh call goes through them as it does live. */
describe('errorInterceptor', () => {
  const meUrl = `${environment.apiUrl}/v1/users/me`;
  const refreshUrl = `${environment.apiUrl}/v1/auth/refresh-token`;
  let http: HttpClient;
  let httpMock: HttpTestingController;
  let navigate: jasmine.Spy;

  beforeEach(() => {
    clearSessionKeys();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([jwtInterceptor, errorInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
    navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
  });

  afterEach(() => {
    httpMock.verify();
    clearSessionKeys();
  });

  it('a 401 renews once and retries once with the new token', () => {
    storeSession(60 * 60_000);
    let body: unknown;

    http.get(meUrl).subscribe(b => (body = b));
    httpMock.expectOne(meUrl).flush({}, UNAUTHORIZED);
    httpMock.expectOne(refreshUrl).flush(renewedSession());
    const retry = httpMock.expectOne(meUrl);
    expect(retry.request.headers.get('access_token')).toBe('new-jwt');
    retry.flush({ ok: true });

    expect(body).toEqual({ ok: true });
    expect(localStorage.getItem('refresh_token')).toBe('new-rt');
  });

  it('when another tab renewed first, retries with the token in storage, not the one in the reply', () => {
    storeSession(60 * 60_000);
    let body: unknown;

    http.get(meUrl).subscribe(b => (body = b));
    httpMock.expectOne(meUrl).flush({}, UNAUTHORIZED);
    const refresh = httpMock.expectOne(refreshUrl);
    storeAnotherTabsPair();
    refresh.flush(renewedSession());
    expect(httpMock.expectOne(`${environment.apiUrl}/v1/auth/logout`).request.body).toEqual({ refreshToken: 'new-rt' });
    const retry = httpMock.expectOne(meUrl);
    expect(retry.request.headers.get('access_token')).toBe('other-jwt');
    retry.flush({ ok: true });

    expect(body).toEqual({ ok: true });
    expect(localStorage.getItem('refresh_token')).toBe('other-rt');
  });

  it('a second 401 on the retry surfaces with no second refresh', () => {
    storeSession(60 * 60_000);
    let failed: HttpErrorResponse | undefined;

    http.get(meUrl).subscribe({ error: e => (failed = e) });
    httpMock.expectOne(meUrl).flush({}, UNAUTHORIZED);
    httpMock.expectOne(refreshUrl).flush(renewedSession());
    httpMock.expectOne(meUrl).flush({}, UNAUTHORIZED);

    expect(failed?.status).toBe(401);
    expect(navigate).not.toHaveBeenCalled();
  });

  it('a 401 from refresh clears the session, goes to /login and does not loop', () => {
    storeSession(60 * 60_000);
    let failed: HttpErrorResponse | undefined;

    http.get(meUrl).subscribe({ error: e => (failed = e) });
    httpMock.expectOne(meUrl).flush({}, UNAUTHORIZED);
    httpMock.expectOne(refreshUrl).flush({}, UNAUTHORIZED);

    expect(failed?.status).toBe(401);
    expect(navigate).toHaveBeenCalledOnceWith(['/login']);
    SESSION_KEYS.forEach(key => expect(localStorage.getItem(key)).withContext(key).toBeNull());
  });

  it('a network error or a 500 from refresh fails the request, keeps the session and stays put', () => {
    storeSession(60 * 60_000);
    const before = SESSION_KEYS.map(key => localStorage.getItem(key));
    const failures: number[] = [];

    http.get(meUrl).subscribe({ error: e => failures.push(e.status) });
    httpMock.expectOne(meUrl).flush({}, UNAUTHORIZED);
    httpMock.expectOne(refreshUrl).error(new ProgressEvent('error'));
    http.get(meUrl).subscribe({ error: e => failures.push(e.status) });
    httpMock.expectOne(meUrl).flush({}, UNAUTHORIZED);
    httpMock.expectOne(refreshUrl).flush({}, SERVER_ERROR);

    expect(failures).toEqual([0, 500]);
    expect(navigate).not.toHaveBeenCalled();
    expect(SESSION_KEYS.map(key => localStorage.getItem(key))).toEqual(before);
  });

  it('a 401 from login and from logout passes through untouched', () => {
    storeSession(60 * 60_000);
    const failures: number[] = [];

    http.post(`${environment.apiUrl}/v1/auth/login`, {}).subscribe({ error: e => failures.push(e.status) });
    httpMock.expectOne(`${environment.apiUrl}/v1/auth/login`).flush({}, UNAUTHORIZED);
    http.post(`${environment.apiUrl}/v1/auth/logout`, {}).subscribe({ error: e => failures.push(e.status) });
    httpMock.expectOne(`${environment.apiUrl}/v1/auth/logout`).flush({}, UNAUTHORIZED);

    expect(failures).toEqual([401, 401]);
    expect(navigate).not.toHaveBeenCalled();
    expect(localStorage.getItem('refresh_token')).toBe('old-rt');
  });

  it('a 401 with no refresh token clears the session and goes to /login', () => {
    storeSession(60 * 60_000, false);

    http.get(meUrl).subscribe({ error: () => {} });
    httpMock.expectOne(meUrl).flush({}, UNAUTHORIZED);

    expect(navigate).toHaveBeenCalledOnceWith(['/login']);
    expect(localStorage.getItem('access_token')).toBeNull();
  });
});
