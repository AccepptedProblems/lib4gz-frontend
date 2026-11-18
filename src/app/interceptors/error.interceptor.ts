import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, switchMap, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { getAccessToken, getRefreshToken } from '../services/token-store';

/**
 * A 401 on a signed-in call renews the session once and retries once. Runs after `jwtInterceptor`,
 * so the retry goes straight out with the new token. The refresh's single flight lives in
 * `AuthService.refreshSession`.
 */
export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      // A 401 from sign-in, sign-up, refresh or logout is the answer itself, not an expired session.
      // Connecting a Google account is the one authenticated call under /v1/auth/.
      if (req.url.includes('/v1/auth/') && !req.url.includes('/v1/auth/google:connect')) {
        return throwError(() => error);
      }

      if (!getRefreshToken()) {
        authService.logout();
        router.navigate(['/login']);
        return throwError(() => error);
      }

      return authService.refreshSession().pipe(
        catchError((refreshError: HttpErrorResponse) => {
          // Refresh cleared the session on a 401. Anything else fails this request and keeps it.
          if (refreshError.status === 401) router.navigate(['/login']);
          return throwError(() => refreshError);
        }),
        // Another tab may have renewed first, so the token comes from storage, never from the reply.
        switchMap(() => {
          const token = getAccessToken();
          return next(token ? req.clone({ setHeaders: { access_token: token } }) : req);
        })
      );
    })
  );
};
