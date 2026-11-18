import { HttpErrorResponse, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { accessTokenMsLeft, getAccessToken, getRefreshToken } from '../services/token-store';

/** An access token this close to expiry is renewed before the request, not after a 401. */
const RENEW_WITHIN_MS = 5 * 60_000;

// '/auth/register' also covers '/auth/register/email', '/verify', and '/complete'.
// '/auth/google:sign-in' is spelled in full on purpose: '/auth/google' would also match
// '/auth/google:connect', the one call here that needs the token.
// Refresh and logout carry their refresh token in the body and work with an expired access token.
const publicEndpoints = ['/auth/login', '/auth/register', '/auth/google:sign-in', '/auth/refresh-token', '/auth/logout'];

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  if (publicEndpoints.some(endpoint => req.url.includes(endpoint))) {
    return next(req);
  }

  const withToken = (token: string | null): HttpRequest<unknown> =>
    token ? req.clone({ setHeaders: { access_token: token } }) : req;

  // A session from before refresh tokens has none: it is sent as it is until its token runs out.
  if (!getRefreshToken() || accessTokenMsLeft() > RENEW_WITHIN_MS) {
    return next(withToken(getAccessToken()));
  }

  const router = inject(Router);
  return inject(AuthService).refreshSession().pipe(
    // Only the refresh's own failure is handled here; the request's errors pass by untouched.
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) router.navigate(['/login']);
      return throwError(() => error);
    }),
    // Another tab may have renewed first, so the token comes from storage, never from the reply.
    switchMap(() => next(withToken(getAccessToken())))
  );
};
