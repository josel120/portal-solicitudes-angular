import { TestBed } from '@angular/core/testing';
import { Session } from '../models/user';
import { SESSION_STORAGE, SessionStore } from './session-store';

class MemoryStorage implements Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> {
  private readonly data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.get(key) ?? null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  removeItem(key: string): void {
    this.data.delete(key);
  }
}

const session = (expiresInMs: number): Session => ({
  token: 'tok',
  expiresAt: Date.now() + expiresInMs,
  user: { id: 3, name: 'Carla Méndez', email: 'carla@demo.com', role: 'approver', department: 'Dirección' },
});

function createStore(storage: MemoryStorage): SessionStore {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({ providers: [{ provide: SESSION_STORAGE, useValue: storage }] });
  return TestBed.inject(SessionStore);
}

describe('SessionStore', () => {
  afterEach(() => vi.useRealTimers());

  it('persists the session so a refresh restores it', () => {
    const storage = new MemoryStorage();
    createStore(storage).start(session(60_000));

    const restored = createStore(storage);
    expect(restored.isAuthenticated()).toBe(true);
    expect(restored.isApprover()).toBe(true);
  });

  it('discards an expired session on restore', () => {
    const storage = new MemoryStorage();
    storage.setItem('portal.session', JSON.stringify(session(-1)));
    expect(createStore(storage).isAuthenticated()).toBe(false);
  });

  it('ends the session with reason "expired" when the token lifetime runs out', () => {
    vi.useFakeTimers();
    const store = createStore(new MemoryStorage());
    store.start(session(15 * 60_000));

    vi.advanceTimersByTime(15 * 60_000);

    expect(store.isAuthenticated()).toBe(false);
    expect(store.endReason()).toBe('expired');
  });
});
