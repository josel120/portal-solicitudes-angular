import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { SESSION_STORAGE, SessionStore } from '../session/session-store';
import { authInterceptor } from './auth.interceptor';

const API = 'http://localhost:3000';

describe('authInterceptor', () => {
  let http: HttpClient;
  let controller: HttpTestingController;
  let session: SessionStore;
  let router: Router;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter([{ path: '**', children: [] }]),
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        { provide: SESSION_STORAGE, useValue: null },
      ],
    });
    http = TestBed.inject(HttpClient);
    controller = TestBed.inject(HttpTestingController);
    session = TestBed.inject(SessionStore);
    router = TestBed.inject(Router);
    session.start({
      token: 'abc123',
      expiresAt: Date.now() + 60_000,
      user: { id: 1, name: 'Ana López', email: 'ana@demo.com', role: 'employee', department: 'Finanzas' },
    });
  });

  afterEach(() => controller.verify());

  it('adds the bearer token to API requests', () => {
    void firstValueFrom(http.get(`${API}/requests`));
    const req = controller.expectOne(`${API}/requests`);
    expect(req.request.headers.get('Authorization')).toBe('Bearer abc123');
    req.flush([]);
  });

  it('never sends the token to other origins', () => {
    void firstValueFrom(http.get('https://cdn.example.com/data.json'));
    const req = controller.expectOne('https://cdn.example.com/data.json');
    expect(req.request.headers.has('Authorization')).toBe(false);
    req.flush({});
  });

  it('on 401 TOKEN_EXPIRED ends the session and redirects to login keeping the current URL', async () => {
    await router.navigateByUrl('/requests?status=pending');
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);

    const call = firstValueFrom(http.get(`${API}/requests`)).catch((e: unknown) => e);
    controller
      .expectOne(`${API}/requests`)
      .flush({ code: 'TOKEN_EXPIRED', message: 'La sesión expiró' }, { status: 401, statusText: 'Unauthorized' });
    await call;

    expect(session.isAuthenticated()).toBe(false);
    expect(session.endReason()).toBe('expired');
    const target = router.serializeUrl(navigate.mock.calls[0][0] as ReturnType<Router['parseUrl']>);
    expect(target).toBe('/login?returnUrl=%2Frequests%3Fstatus%3Dpending');
  });

  it('does not treat a failed login (401) as an expired session', async () => {
    const navigate = vi.spyOn(router, 'navigateByUrl');
    const call = firstValueFrom(http.post(`${API}/auth/login`, {})).catch((e: unknown) => e);
    controller.expectOne(`${API}/auth/login`).flush({ code: 'INVALID_CREDENTIALS' }, { status: 401, statusText: 'Unauthorized' });
    await call;

    expect(session.isAuthenticated()).toBe(true);
    expect(navigate).not.toHaveBeenCalled();
  });
});
