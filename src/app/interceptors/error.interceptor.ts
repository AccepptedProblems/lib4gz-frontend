import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, catchError, filter, switchMap, take, throwError } from 'rxjs';
import { AuthService } from '../services/auth.service';

let isRefreshing = false;
const refreshToken$ = new BehaviorSubject<string | null>(null);

export const errorInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);
  const authService = inject(AuthService);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status !== 401) {
        return throwError(() => error);
      }

      if (req.url.includes('/auth/refresh-token')) {
        authService.logout();
        router.navigate(['/login']);
        return throwError(() => error);
      }

      // A 401 from sign-in or sign-up means bad credentials, not an expired session. Connecting a
      // Google account is the one authenticated call under /v1/auth/, so it takes the normal path.
      if (req.url.includes('/v1/auth/') && !req.url.includes('/v1/auth/google:connect')) {
        return throwError(() => error);
      }

      if (!isRefreshing) {
        isRefreshing = true;
        refreshToken$.next(null);

        return authService.refreshToken().pipe(
          switchMap((token) => {
            isRefreshing = false;
            refreshToken$.next(token.token);
            return next(req.clone({ setHeaders: { access_token: token.token } }));
          }),
          catchError((refreshError) => {
            isRefreshing = false;
            authService.logout();
            router.navigate(['/login']);
            return throwError(() => refreshError);
          })
        );
      }

      return refreshToken$.pipe(
        filter((token) => token !== null),
        take(1),
        switchMap((token) => next(req.clone({ setHeaders: { access_token: token! } })))
      );
    })
  );
};
