import { Injectable, InjectionToken, computed, inject, signal } from '@angular/core';
import { Session, User } from '../models/user';

export type SessionEndReason = 'logout' | 'expired' | 'unauthorized';

const STORAGE_KEY = 'portal.session';

/** Storage used to persist the session across refreshes; replaceable in tests. */
export const SESSION_STORAGE = new InjectionToken<Storage | null>('SESSION_STORAGE', {
  providedIn: 'root',
  factory: () => (typeof localStorage === 'undefined' ? null : localStorage),
});

function isSession(value: unknown): value is Session {
  if (typeof value !== 'object' || value === null) return false;
  const candidate = value as Partial<Session>;
  return (
    typeof candidate.token === 'string' &&
    typeof candidate.expiresAt === 'number' &&
    typeof candidate.user === 'object' &&
    candidate.user !== null
  );
}

/**
 * Single source of truth for the user session. `providedIn: 'root'` + the shared library being a
 * federation singleton means the shell and every remote read the same instance.
 */
@Injectable({ providedIn: 'root' })
export class SessionStore {
  private readonly storage = inject(SESSION_STORAGE);
  private readonly state = signal<Session | null>(this.restore());
  private readonly lastEndReason = signal<SessionEndReason | null>(null);
  private expiryTimer: ReturnType<typeof setTimeout> | null = null;

  readonly session = this.state.asReadonly();
  readonly user = computed<User | null>(() => this.state()?.user ?? null);
  readonly token = computed(() => this.state()?.token ?? null);
  readonly isAuthenticated = computed(() => this.state() !== null);
  readonly isApprover = computed(() => this.user()?.role === 'approver');
  /** Why the last session ended; lets the login page explain an expiry. */
  readonly endReason = this.lastEndReason.asReadonly();

  constructor() {
    const current = this.state();
    if (current) this.scheduleExpiry(current);
  }

  start(session: Session): void {
    this.state.set(session);
    this.lastEndReason.set(null);
    this.storage?.setItem(STORAGE_KEY, JSON.stringify(session));
    this.scheduleExpiry(session);
  }

  end(reason: SessionEndReason): void {
    if (this.expiryTimer !== null) clearTimeout(this.expiryTimer);
    this.expiryTimer = null;
    this.storage?.removeItem(STORAGE_KEY);
    this.state.set(null);
    this.lastEndReason.set(reason);
  }

  hasExpired(now: number = Date.now()): boolean {
    const current = this.state();
    return current !== null && current.expiresAt <= now;
  }

  private scheduleExpiry(session: Session): void {
    if (this.expiryTimer !== null) clearTimeout(this.expiryTimer);
    const remaining = session.expiresAt - Date.now();
    this.expiryTimer = setTimeout(() => this.end('expired'), Math.max(remaining, 0));
  }

  private restore(): Session | null {
    try {
      const raw = this.storage?.getItem(STORAGE_KEY);
      if (!raw) return null;
      const parsed: unknown = JSON.parse(raw);
      if (!isSession(parsed) || parsed.expiresAt <= Date.now()) {
        this.storage?.removeItem(STORAGE_KEY);
        return null;
      }
      return parsed;
    } catch {
      return null;
    }
  }
}
