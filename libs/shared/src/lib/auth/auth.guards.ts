import { inject } from '@angular/core';
import { CanMatchFn, Router } from '@angular/router';
import { Role } from '../models/user';
import { SessionStore } from '../session/session-store';
import { loginUrlTree } from './return-url';

/**
 * `canMatch` (not `canActivate`) so an anonymous user never downloads a remote's code: the router
 * only fetches `loadChildren` after the route matches.
 */
export const authGuard: CanMatchFn = () => {
  const session = inject(SessionStore);
  const router = inject(Router);
  if (session.isAuthenticated() && !session.hasExpired()) return true;
  if (session.isAuthenticated()) session.end('expired');
  return loginUrlTree(router);
};

export function roleGuard(role: Role): CanMatchFn {
  return () => {
    const session = inject(SessionStore);
    return session.user()?.role === role ? true : inject(Router).createUrlTree(['/forbidden']);
  };
}

/** Keeps signed-in users away from the login page. */
export const guestGuard: CanMatchFn = () => {
  const session = inject(SessionStore);
  return session.isAuthenticated() && !session.hasExpired() ? inject(Router).createUrlTree(['/']) : true;
};
