import { HttpInterceptorFn } from '@angular/common/http';

export const jwtInterceptor: HttpInterceptorFn = (req, next) => {
  const token = localStorage.getItem('access_token');

  const publicEndpoints = ['/auth/login', '/auth/register'];
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
