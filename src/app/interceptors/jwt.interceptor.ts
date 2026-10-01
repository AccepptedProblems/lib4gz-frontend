import { HttpInterceptorFn } from '@angular/common/http';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('access_token');

  // '/auth/register' also covers '/auth/register/email', '/verify', and '/complete'.
  // '/auth/google:sign-in' is spelled in full on purpose: '/auth/google' would also match
  // '/auth/google:connect', the one call here that needs the token.
  const publicEndpoints = ['/auth/login', '/auth/register', '/auth/google:sign-in'];
  const isPublic = publicEndpoints.some(endpoint => req.url.includes(endpoint));

  if (token && !isPublic) {
    const clonedReq = req.clone({
      setHeaders: {
        'access_token': token
      }
    });
    return next(clonedReq);
  }

  return next(req);
};
