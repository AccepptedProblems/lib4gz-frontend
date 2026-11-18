import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { AuthService } from './auth.service';
import { environment } from '../../environments/environment';
import { GoogleSignInResponse, LoginResponse, UserResponse, UserRole } from '../shared/models';
import {
  SERVER_ERROR, SESSION_KEYS, UNAUTHORIZED, clearSessionKeys, renewedSession, storeAnotherTabsPair, storeSession,
} from '../interceptors/session.spec-helpers';

function user(overrides: Partial<UserResponse> = {}): UserResponse {
  return {
    id: 'usr_alice',
    username: 'alice',
    email: 'alice@x.com',
    name: 'Alice B',
    avatarUrl: null,
    role: UserRole.TEACHER,
    emailVerified: false,
    googleConnected: false,
    raceAppearance: null,
    ...overrides,
  };
}

function createService(): AuthService {
  return TestBed.inject(AuthService);
}

describe('AuthService', () => {
  beforeEach(() => {
    clearSessionKeys();
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => clearSessionKeys());

  it('setCurrentUser stores the user and updates the name signals', () => {
    const service = createService();

    service.setCurrentUser(user());

    expect(JSON.parse(localStorage.getItem('user')!).id).toBe('usr_alice');
    expect(localStorage.getItem('user_role')).toBe('TEACHER');
    expect(localStorage.getItem('user_id')).toBe('usr_alice');
    expect(service.userName()).toBe('Alice B');
    expect(service.userInitial()).toBe('A');
    expect(service.getUserRole()).toBe(UserRole.TEACHER);
  });

  it('uses the username when the name is blank', () => {
    const service = createService();

    service.setCurrentUser(user({ name: '', username: 'zed' }));

    expect(service.userName()).toBe('zed');
    expect(service.userInitial()).toBe('Z');
  });

  it('logout clears the user signal and the stored keys', () => {
    const service = createService();
    service.setCurrentUser(user());

    service.logout();

    expect(service.currentUser()).toBeNull();
    expect(service.userName()).toBe('');
    ['user', 'user_role', 'user_id', 'user_name'].forEach(key => expect(localStorage.getItem(key)).toBeNull());
  });

  it('hydrates a stored user on construction', () => {
    localStorage.setItem('user', JSON.stringify(user({ name: 'Stored' })));

    const service = createService();

    expect(service.userName()).toBe('Stored');
  });

  describe('sign-in and sign-up calls', () => {
    const login: LoginResponse = {
      user: user(),
      accessToken: { token: 'jwt', expiredAt: Date.now() + 60_000 },
      refreshToken: { token: 'rt', expiredAt: Date.now() + 86_400_000 },
    };
    let httpMock: HttpTestingController;

    beforeEach(() => (httpMock = TestBed.inject(HttpTestingController)));
    afterEach(() => httpMock.verify());

    it('googleSignIn stores the session when the account is known', () => {
      const service = createService();
      const body: GoogleSignInResponse = { login, registration: null };

      service.googleSignIn('id-token').subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/v1/auth/google:sign-in`);
      expect(req.request.body).toEqual({ idToken: 'id-token' });
      req.flush(body);

      expect(localStorage.getItem('access_token')).toBe('jwt');
      expect(service.userName()).toBe('Alice B');
    });

    it('googleSignIn stores nothing when a registration must be finished first', () => {
      const service = createService();
      const body: GoogleSignInResponse = {
        login: null,
        registration: { registrationId: 'reg_1', email: 'a@x.com', name: 'A', avatarUrl: null, requiresPassword: false },
      };

      service.googleSignIn('id-token').subscribe();
      httpMock.expectOne(`${environment.apiUrl}/v1/auth/google:sign-in`).flush(body);

      expect(localStorage.getItem('access_token')).toBeNull();
      expect(service.currentUser()).toBeNull();
    });

    it('connectGoogle replaces the stored user with the reply', () => {
      const service = createService();
      service.setCurrentUser(user());

      service.connectGoogle('id-token').subscribe();
      const req = httpMock.expectOne(`${environment.apiUrl}/v1/auth/google:connect`);
      expect(req.request.body).toEqual({ idToken: 'id-token' });
      req.flush(user({ email: 'alice@gmail.com', emailVerified: true, googleConnected: true }));

      expect(service.currentUser()?.email).toBe('alice@gmail.com');
      expect(JSON.parse(localStorage.getItem('user')!).googleConnected).toBeTrue();
    });

    it('completeRegistration signs the new user in', () => {
      const service = createService();

      service.completeRegistration({ registrationId: 'reg_1', username: 'alice', password: 'longenough' }).subscribe();
      httpMock.expectOne(`${environment.apiUrl}/v1/auth/register/complete`).flush(login);

      expect(localStorage.getItem('access_token')).toBe('jwt');
      expect(service.currentUser()?.id).toBe('usr_alice');
    });
  });

  describe('tokens and sign-out', () => {
    const refreshUrl = `${environment.apiUrl}/v1/auth/refresh-token`;
    const logoutUrl = `${environment.apiUrl}/v1/auth/logout`;
    let httpMock: HttpTestingController;

    /** A signed-in session with the user stored, so the service starts with it. */
    function signedIn(accessMsLeft = 60_000): void {
      storeSession(accessMsLeft);
      localStorage.setItem('user', JSON.stringify(user()));
    }

    function stored(): (string | null)[] {
      return SESSION_KEYS.map(key => localStorage.getItem(key));
    }

    function expectSignedOut(service: AuthService): void {
      SESSION_KEYS.forEach(key => expect(localStorage.getItem(key)).withContext(key).toBeNull());
      expect(service.currentUser()).toBeNull();
    }

    /** The refresh tokens posted to `/logout` so far, each request answered. */
    function revoked(): string[] {
      return httpMock.match(logoutUrl).map(req => {
        req.flush(null, { status: 204, statusText: 'No Content' });
        return (req.request.body as { refreshToken: string }).refreshToken;
      });
    }

    beforeEach(() => (httpMock = TestBed.inject(HttpTestingController)));
    afterEach(() => httpMock.verify());

    it('sign-in stores both tokens', () => {
      const service = createService();

      service.login({ username: 'alice', password: 'secret123' }).subscribe();
      httpMock.expectOne(`${environment.apiUrl}/v1/auth/login`).flush(renewedSession());

      expect(localStorage.getItem('access_token')).toBe('new-jwt');
      expect(localStorage.getItem('refresh_token')).toBe('new-rt');
      expect(Number(localStorage.getItem('refresh_token_expiry'))).toBeGreaterThan(Date.now());
    });

    it('two refreshes at once make one request and both get the result', () => {
      signedIn();
      const service = createService();
      const got: string[] = [];

      service.refreshSession().subscribe(r => got.push(r.accessToken.token));
      service.refreshSession().subscribe(r => got.push(r.accessToken.token));
      const req = httpMock.expectOne(refreshUrl);
      expect(req.request.body).toEqual({ refreshToken: 'old-rt' });
      req.flush(renewedSession());

      expect(got).toEqual(['new-jwt', 'new-jwt']);
      expect(localStorage.getItem('refresh_token')).toBe('new-rt');
    });

    it('a refresh after the last one settled sends a new request', () => {
      signedIn();
      const service = createService();
      service.refreshSession().subscribe();
      httpMock.expectOne(refreshUrl).flush(renewedSession());

      service.refreshSession().subscribe();

      expect(httpMock.expectOne(refreshUrl).request.body).toEqual({ refreshToken: 'new-rt' });
    });

    it('a refresh still finishes and stores its pair after its caller unsubscribes', () => {
      signedIn();
      const service = createService();

      service.refreshSession().subscribe().unsubscribe();
      httpMock.expectOne(refreshUrl).flush(renewedSession());

      expect(localStorage.getItem('access_token')).toBe('new-jwt');
      expect(localStorage.getItem('refresh_token')).toBe('new-rt');
    });

    describe('a refresh that succeeds', () => {
      it('with the sent token in storage: stores the new pair and the user, revokes nothing', () => {
        signedIn();
        const service = createService();
        let got: LoginResponse | undefined;

        service.refreshSession().subscribe(r => (got = r));
        httpMock.expectOne(refreshUrl).flush(renewedSession());

        expect(got?.accessToken.token).toBe('new-jwt');
        expect(localStorage.getItem('access_token')).toBe('new-jwt');
        expect(localStorage.getItem('refresh_token')).toBe('new-rt');
        expect(service.currentUser()?.role).toBe(UserRole.USER);
        httpMock.expectNone(logoutUrl);
      });

      it('with storage emptied by a sign-out: stores nothing, revokes the new token, fails its callers with a 401', () => {
        signedIn();
        const service = createService();
        let failed: HttpErrorResponse | undefined;

        service.refreshSession().subscribe({ error: e => (failed = e) });
        const refresh = httpMock.expectOne(refreshUrl);
        service.logout();
        expect(revoked()).withContext('the sign-out itself').toEqual([]);
        refresh.flush(renewedSession());

        expect(revoked()).toEqual(['new-rt']);
        expect(failed).toBeInstanceOf(HttpErrorResponse);
        expect(failed?.status).toBe(401);
        expectSignedOut(service);
      });

      it("with another tab's token in storage: stores nothing, revokes the new token, its callers get the reply", () => {
        signedIn();
        const service = createService();
        let got: LoginResponse | undefined;

        service.refreshSession().subscribe(r => (got = r));
        const refresh = httpMock.expectOne(refreshUrl);
        storeAnotherTabsPair();
        refresh.flush(renewedSession());

        expect(revoked()).toEqual(['new-rt']);
        expect(got?.refreshToken.token).toBe('new-rt');
        expect(localStorage.getItem('access_token')).toBe('other-jwt');
        expect(localStorage.getItem('refresh_token')).toBe('other-rt');
      });

      it('with the refresh token expired in flight: clears every key, revokes the new token, fails its callers with a 401', () => {
        signedIn();
        const service = createService();
        let failed: HttpErrorResponse | undefined;

        service.refreshSession().subscribe({ error: e => (failed = e) });
        const refresh = httpMock.expectOne(refreshUrl);
        localStorage.setItem('refresh_token_expiry', String(Date.now() - 1));
        refresh.flush(renewedSession());

        expect(revoked()).toEqual(['new-rt']);
        expect(failed?.status).toBe(401);
        expectSignedOut(service);
      });
    });

    describe("after a 500, a refresh asked for in a caller's error callback", () => {
      it('makes exactly one new request, with the token storage holds then, and stores its pair', () => {
        signedIn();
        const service = createService();
        let got: LoginResponse | undefined;

        service.refreshSession().subscribe({ error: () => service.refreshSession().subscribe(r => (got = r)) });
        const first = httpMock.expectOne(refreshUrl);
        storeAnotherTabsPair();
        first.flush({}, SERVER_ERROR);

        const second = httpMock.expectOne(refreshUrl);
        expect(second.request.body).toEqual({ refreshToken: 'other-rt' });
        second.flush(renewedSession());

        expect(got?.accessToken.token).toBe('new-jwt');
        expect(localStorage.getItem('refresh_token')).toBe('new-rt');
        httpMock.expectNone(logoutUrl);
      });

      it('a third caller during that new refresh shares it: still one request', () => {
        signedIn();
        const service = createService();
        const got: string[] = [];

        service.refreshSession().subscribe({
          error: () => service.refreshSession().subscribe(r => got.push(r.accessToken.token)),
        });
        httpMock.expectOne(refreshUrl).flush({}, SERVER_ERROR);
        service.refreshSession().subscribe(r => got.push(r.accessToken.token));

        const second = httpMock.expectOne(refreshUrl);
        expect(second.request.body).toEqual({ refreshToken: 'old-rt' });
        second.flush(renewedSession());

        expect(got).toEqual(['new-jwt', 'new-jwt']);
        expect(localStorage.getItem('refresh_token')).toBe('new-rt');
      });

      it('a sign-out during that new refresh posts nothing to /logout', () => {
        signedIn();
        const service = createService();
        let failed: HttpErrorResponse | undefined;

        service.refreshSession().subscribe({
          error: () => service.refreshSession().subscribe({ error: e => (failed = e) }),
        });
        httpMock.expectOne(refreshUrl).flush({}, SERVER_ERROR);
        const second = httpMock.expectOne(refreshUrl);
        service.logout();
        expect(revoked()).withContext('the sign-out itself').toEqual([]);
        second.flush(renewedSession());

        expect(revoked()).toEqual(['new-rt']);
        expect(failed?.status).toBe(401);
        expectSignedOut(service);
      });
    });

    describe('a refresh that fails', () => {
      it('with a 401: clears every key and revokes nothing', () => {
        signedIn();
        const service = createService();
        let failed: HttpErrorResponse | undefined;

        service.refreshSession().subscribe({ error: e => (failed = e) });
        httpMock.expectOne(refreshUrl).flush({}, UNAUTHORIZED);

        expect(failed?.status).toBe(401);
        expectSignedOut(service);
        httpMock.expectNone(logoutUrl);
      });

      it("with a 401 and another tab's token in storage: still clears every key and revokes nothing", () => {
        signedIn();
        const service = createService();

        service.refreshSession().subscribe({ error: () => {} });
        const refresh = httpMock.expectOne(refreshUrl);
        storeAnotherTabsPair();
        refresh.flush({}, UNAUTHORIZED);

        expectSignedOut(service);
        httpMock.expectNone(logoutUrl);
      });

      it('with a network error or a 500 and a token in storage: keeps every key and revokes nothing', () => {
        signedIn();
        const service = createService();
        const before = stored();

        service.refreshSession().subscribe({ error: () => {} });
        httpMock.expectOne(refreshUrl).error(new ProgressEvent('error'));
        service.refreshSession().subscribe({ error: () => {} });
        httpMock.expectOne(refreshUrl).flush({}, SERVER_ERROR);

        expect(stored()).toEqual(before);
        expect(service.currentUser()?.id).toBe('usr_alice');
        httpMock.expectNone(logoutUrl);
      });

      it('with a network error or a 500 after a sign-out: revokes the sent token', () => {
        signedIn();
        const service = createService();
        const failures: number[] = [];

        service.refreshSession().subscribe({ error: e => failures.push(e.status) });
        const offline = httpMock.expectOne(refreshUrl);
        service.logout();
        offline.error(new ProgressEvent('error'));
        expect(revoked()).toEqual(['old-rt']);

        signedIn();
        service.refreshSession().subscribe({ error: e => failures.push(e.status) });
        const down = httpMock.expectOne(refreshUrl);
        service.logout();
        down.flush({}, SERVER_ERROR);
        expect(revoked()).toEqual(['old-rt']);

        expect(failures).toEqual([0, 500]);
        expectSignedOut(service);
      });
    });

    it('logout clears storage at once and still does when the call answers 500', () => {
      signedIn();
      const service = createService();

      service.logout();
      SESSION_KEYS.forEach(key => expect(localStorage.getItem(key)).withContext(key).toBeNull());
      const req = httpMock.expectOne(logoutUrl);
      expect(req.request.body).toEqual({ refreshToken: 'old-rt' });
      req.flush({}, SERVER_ERROR);

      SESSION_KEYS.forEach(key => expect(localStorage.getItem(key)).withContext(key).toBeNull());
    });

    it('logout without a refresh token sends nothing', () => {
      storeSession(60_000, false);
      const service = createService();

      service.logout();

      httpMock.expectNone(logoutUrl);
      expect(localStorage.getItem('access_token')).toBeNull();
    });

    it('logout during a refresh with the sent token still in storage revokes nothing itself', () => {
      signedIn();
      const service = createService();

      service.refreshSession().subscribe({ error: () => {} });
      const refresh = httpMock.expectOne(refreshUrl);
      service.logout();

      expectSignedOut(service);
      httpMock.expectNone(logoutUrl);
      refresh.flush({}, UNAUTHORIZED);
    });

    it("logout during a refresh with another tab's token in storage revokes that token and never the sent one", () => {
      signedIn();
      const service = createService();

      service.refreshSession().subscribe({ error: () => {} });
      const refresh = httpMock.expectOne(refreshUrl);
      storeAnotherTabsPair();
      service.logout();
      expect(revoked()).toEqual(['other-rt']);
      refresh.flush(renewedSession());

      expect(revoked()).toEqual(['new-rt']);
      expectSignedOut(service);
    });

    it('logout in a caller\'s own error callback, once the refresh failed, revokes the stored token', () => {
      signedIn();
      const service = createService();

      service.refreshSession().subscribe({ error: () => service.logout() });
      httpMock.expectOne(refreshUrl).flush({}, SERVER_ERROR);

      expect(revoked()).toEqual(['old-rt']);
      expectSignedOut(service);
    });

    it('isAuthenticated is true with an expired access token and a live refresh token', () => {
      signedIn(-1_000);

      expect(createService().isAuthenticated()).toBeTrue();
    });

    it('isAuthenticated is false with an expired access token and an expired refresh token', () => {
      signedIn(-1_000);
      localStorage.setItem('refresh_token_expiry', String(Date.now() - 1));

      expect(createService().isAuthenticated()).toBeFalse();
    });
  });
});
