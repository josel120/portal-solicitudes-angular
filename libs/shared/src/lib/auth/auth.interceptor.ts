import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { API_BASE_URL } from '../api/api-config';
import { SessionStore } from '../session/session-store';
import { loginUrlTree } from './return-url';

function errorCode(error: HttpErrorResponse): string | null {
  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null && 'code' in body && typeof body.code === 'string') {
    return body.code;
  }
  return null;
}

/**
 * Adds the bearer token to API calls (only to our API, never to third-party URLs) and, on a 401
 * from anything other than the login endpoint, ends the session and sends the user to login
 * keeping the URL they were on.
 */
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const baseUrl = inject(API_BASE_URL);
  if (!req.url.startsWith(baseUrl)) return next(req);

  const session = inject(SessionStore);
  const router = inject(Router);
  const token = session.token();
  const authorized = token ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(authorized).pipe(
    catchError((error: unknown) => {
      const isLogin = req.url === `${baseUrl}/auth/login`;
      if (error instanceof HttpErrorResponse && error.status === 401 && !isLogin) {
        const loginTarget = loginUrlTree(router);
        session.end(errorCode(error) === 'TOKEN_EXPIRED' ? 'expired' : 'unauthorized');
        void router.navigateByUrl(loginTarget);
      }
      return throwError(() => error);
    }),
  );
};
