import { TestBed } from '@angular/core/testing';
import { CanMatchFn, Route, Router, UrlTree, provideRouter } from '@angular/router';
import { User } from '../models/user';
import { SESSION_STORAGE, SessionStore } from '../session/session-store';
import { authGuard, roleGuard } from './auth.guards';

const approver: User = { id: 3, name: 'Carla Méndez', email: 'carla@demo.com', role: 'approver', department: 'Dirección' };
const employee: User = { ...approver, id: 1, role: 'employee' };

function run(guard: CanMatchFn): ReturnType<CanMatchFn> {
  return TestBed.runInInjectionContext(() => guard({} as Route, [], {} as Parameters<CanMatchFn>[2]));
}

describe('route guards', () => {
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: SESSION_STORAGE, useValue: null }] });
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
  });

  it('authGuard sends anonymous users to login', () => {
    const result = run(authGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect(router.serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('authGuard lets an active session through', () => {
    session.start({ token: 't', expiresAt: Date.now() + 60_000, user: employee });
    expect(run(authGuard)).toBe(true);
  });

  it('authGuard ends a session whose token already expired', () => {
    session.start({ token: 't', expiresAt: Date.now() - 1, user: employee });
    expect(run(authGuard)).toBeInstanceOf(UrlTree);
    expect(session.endReason()).toBe('expired');
  });

  it('roleGuard redirects users without the role to /forbidden', () => {
    session.start({ token: 't', expiresAt: Date.now() + 60_000, user: employee });
    const result = run(roleGuard('approver'));
    expect(router.serializeUrl(result as UrlTree)).toBe('/forbidden');
  });

  it('roleGuard allows users with the role', () => {
    session.start({ token: 't', expiresAt: Date.now() + 60_000, user: approver });
    expect(run(roleGuard('approver'))).toBe(true);
  });
});
