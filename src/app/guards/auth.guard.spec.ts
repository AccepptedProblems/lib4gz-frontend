import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ActivatedRouteSnapshot, GuardResult, MaybeAsync, Router, RouterStateSnapshot, UrlTree } from '@angular/router';
import { isObservable } from 'rxjs';
import { authGuard } from './auth.guard';
import { environment } from '../../environments/environment';
import {
  SERVER_ERROR, UNAUTHORIZED, clearSessionKeys, renewedSession, storeSession,
} from '../interceptors/session.spec-helpers';

describe('authGuard', () => {
  const refreshUrl = `${environment.apiUrl}/v1/auth/refresh-token`;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    clearSessionKeys();
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
    clearSessionKeys();
  });

  /** Runs the guard and returns its answer, flushing the refresh with [reply] when it makes one. */
  function decide(reply?: (req: ReturnType<HttpTestingController['expectOne']>) => void): GuardResult | undefined {
    const result: MaybeAsync<GuardResult> = TestBed.runInInjectionContext(() =>
      authGuard({} as ActivatedRouteSnapshot, {} as RouterStateSnapshot)
    );
    if (!isObservable(result)) return result as GuardResult;
    let answer: GuardResult | undefined;
    result.subscribe(a => (answer = a));
    reply?.(httpMock.expectOne(refreshUrl));
    return answer;
  }

  function isLogin(result: GuardResult | undefined): boolean {
    return result instanceof UrlTree && TestBed.inject(Router).serializeUrl(result) === '/login';
  }

  it('allows an unexpired access token without a request', () => {
    storeSession(60_000);

    expect(decide()).toBeTrue();
  });

  it('renews an expired access token, then allows', () => {
    storeSession(-1_000);

    expect(decide(req => req.flush(renewedSession()))).toBeTrue();
    expect(localStorage.getItem('access_token')).toBe('new-jwt');
  });

  it('sends a refused renewal to /login', () => {
    storeSession(-1_000);

    expect(isLogin(decide(req => req.flush({}, UNAUTHORIZED)))).toBeTrue();
  });

  it('allows when the renewal fails for another reason', () => {
    storeSession(-1_000);

    expect(decide(req => req.flush({}, SERVER_ERROR))).toBeTrue();
    expect(localStorage.getItem('refresh_token')).toBe('old-rt');
  });

  it('sends an expired session with no refresh token to /login', () => {
    storeSession(-1_000, false);

    expect(isLogin(decide())).toBeTrue();
  });
});
