import { HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { catchError, map, of } from 'rxjs';
import { AuthService } from '../services/auth.service';
import { accessTokenMsLeft, getRefreshToken } from '../services/token-store';

/** Renews an expired session before sending the person to `/login`. */
export const authGuard: CanActivateFn = () => {
  const router = inject(Router);

  if (accessTokenMsLeft() > 0) {
    return true;
  }
  if (!getRefreshToken()) {
    return router.createUrlTree(['/login']);
  }

  return inject(AuthService).refreshSession().pipe(
    map(() => true),
    // No network or server down: let the page in; its own requests try the refresh again.
    catchError((error: HttpErrorResponse) => of(error.status === 401 ? router.createUrlTree(['/login']) : true))
  );
};
