import { TestBed } from '@angular/core/testing';
import { HttpClient, HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { jwtInterceptor } from './jwt.interceptor';
import { environment } from '../../environments/environment';
import {
  SERVER_ERROR, SESSION_KEYS, UNAUTHORIZED, clearSessionKeys, renewedSession, storeAnotherTabsPair, storeSession,
} from './session.spec-helpers';

/** The public list is matched by substring, so a new path can silently fall into it. */
describe('jwtInterceptor', () => {
  let http: HttpClient;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    localStorage.setItem('access_token', 'jwt');
    TestBed.configureTestingModule({
      providers: [provideHttpClient(withInterceptors([jwtInterceptor])), provideHttpClientTesting()],
    });
    http = TestBed.inject(HttpClient);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    clearSessionKeys();
  });

  function tokenSentTo(url: string): string | null {
    http.post(url, {}).subscribe();
    const req = httpMock.expectOne(url);
    req.flush({});
    return req.request.headers.get('access_token');
  }

  it('attaches the token to google:connect, which acts on the signed-in account', () => {
    expect(tokenSentTo(`${environment.apiUrl}/v1/auth/google:connect`)).toBe('jwt');
  });

  it('leaves the sign-in and sign-up calls unauthenticated', () => {
    expect(tokenSentTo(`${environment.apiUrl}/v1/auth/google:sign-in`)).toBeNull();
    expect(tokenSentTo(`${environment.apiUrl}/v1/auth/login`)).toBeNull();
    expect(tokenSentTo(`${environment.apiUrl}/v1/auth/register/email`)).toBeNull();
  });

  it('attaches the token to everything else', () => {
    expect(tokenSentTo(`${environment.apiUrl}/v1/users/me`)).toBe('jwt');
  });

  describe('renewal before the request', () => {
    const meUrl = `${environment.apiUrl}/v1/users/me`;
    const refreshUrl = `${environment.apiUrl}/v1/auth/refresh-token`;
    const logoutUrl = `${environment.apiUrl}/v1/auth/logout`;
    let navigate: jasmine.Spy;

    beforeEach(() => {
      clearSessionKeys();
      navigate = spyOn(TestBed.inject(Router), 'navigate').and.resolveTo(true);
    });

    it('renews a token 4 minutes from expiry, then sends with the new token', () => {
      storeSession(4 * 60_000);

      http.get(meUrl).subscribe();
      const refresh = httpMock.expectOne(refreshUrl);
      expect(refresh.request.body).toEqual({ refreshToken: 'old-rt' });
      expect(refresh.request.headers.get('access_token')).toBeNull();
      refresh.flush(renewedSession());

      expect(httpMock.expectOne(meUrl).request.headers.get('access_token')).toBe('new-jwt');
    });

    it('when another tab renewed first, sends with the token in storage, not the one in the reply', () => {
      storeSession(-1_000);

      http.get(meUrl).subscribe();
      const refresh = httpMock.expectOne(refreshUrl);
      storeAnotherTabsPair();
      refresh.flush(renewedSession());

      expect(httpMock.expectOne(logoutUrl).request.body).toEqual({ refreshToken: 'new-rt' });
      expect(httpMock.expectOne(meUrl).request.headers.get('access_token')).toBe('other-jwt');
      expect(localStorage.getItem('refresh_token')).toBe('other-rt');
    });

    it('three requests at once make one refresh and three sends', () => {
      storeSession(-1_000);

      [1, 2, 3].forEach(() => http.get(meUrl).subscribe());
      httpMock.expectOne(refreshUrl).flush(renewedSession());

      const sent = httpMock.match(meUrl);
      expect(sent.length).toBe(3);
      sent.forEach(req => expect(req.request.headers.get('access_token')).toBe('new-jwt'));
    });

    it('a fresh token starts no refresh', () => {
      storeSession(60 * 60_000);

      http.get(meUrl).subscribe();

      expect(httpMock.expectOne(meUrl).request.headers.get('access_token')).toBe('old-jwt');
    });

    it('an old session with no refresh token is sent as it is', () => {
      storeSession(-1_000, false);

      http.get(meUrl).subscribe();

      expect(httpMock.expectOne(meUrl).request.headers.get('access_token')).toBe('old-jwt');
    });

    it('refresh and logout carry no token and start no refresh', () => {
      storeSession(-1_000);

      http.post(refreshUrl, {}).subscribe();
      http.post(logoutUrl, {}).subscribe();

      expect(httpMock.expectOne(refreshUrl).request.headers.get('access_token')).toBeNull();
      expect(httpMock.expectOne(logoutUrl).request.headers.get('access_token')).toBeNull();
    });

    it('a 401 from refresh clears the session, goes to /login and fails the request unsent', () => {
      storeSession(-1_000);
      let failed: HttpErrorResponse | undefined;

      http.get(meUrl).subscribe({ error: e => (failed = e) });
      httpMock.expectOne(refreshUrl).flush({}, UNAUTHORIZED);

      expect(failed?.status).toBe(401);
      expect(navigate).toHaveBeenCalledWith(['/login']);
      SESSION_KEYS.forEach(key => expect(localStorage.getItem(key)).withContext(key).toBeNull());
      httpMock.expectNone(meUrl);
    });

    it('a network error or a 500 from refresh fails only this request and keeps the session', () => {
      storeSession(-1_000);
      const before = SESSION_KEYS.map(key => localStorage.getItem(key));
      const failures: number[] = [];

      http.get(meUrl).subscribe({ error: e => failures.push(e.status) });
      httpMock.expectOne(refreshUrl).error(new ProgressEvent('error'));
      http.get(meUrl).subscribe({ error: e => failures.push(e.status) });
      httpMock.expectOne(refreshUrl).flush({}, SERVER_ERROR);

      expect(failures).toEqual([0, 500]);
      expect(navigate).not.toHaveBeenCalled();
      expect(SESSION_KEYS.map(key => localStorage.getItem(key))).toEqual(before);
      httpMock.expectNone(meUrl);
    });
  });
});
