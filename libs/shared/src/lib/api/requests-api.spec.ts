import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';
import { RequestEvents } from '../events/request-events';
import { ApiError } from '../models/api-error';
import { DEFAULT_REQUEST_FILTERS } from '../models/request';
import { RequestDto } from './normalize';
import { RequestsApi, VersionConflictError } from './requests-api';

const API = 'http://localhost:3000';

function dto(overrides: Partial<RequestDto> = {}): RequestDto {
  return {
    id: 1,
    title: 'Laptop para diseño',
    type: 'equipment',
    status: 'pending',
    requesterId: 1,
    requesterName: 'Ana López',
    createdAt: '2026-11-01T10:00:00.000Z',
    updatedAt: '2026-11-01T10:00:00.000Z',
    version: 1,
    details: { model: 'MacBook Air M3' },
    amount: '2500',
    ...overrides,
  };
}

describe('RequestsApi', () => {
  let api: RequestsApi;
  let http: HttpTestingController;
  let events: RequestEvents;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(RequestsApi);
    http = TestBed.inject(HttpTestingController);
    events = TestBed.inject(RequestEvents);
  });

  afterEach(() => http.verify());

  it('sends filters as json-server params and reads the total from X-Total-Count', async () => {
    const result = firstValueFrom(api.list({ ...DEFAULT_REQUEST_FILTERS, page: 2, q: ' laptop ', status: 'pending' }));

    const req = http.expectOne((r) => r.url === `${API}/requests`);
    expect(req.request.params.get('_page')).toBe('2');
    expect(req.request.params.get('_limit')).toBe('10');
    expect(req.request.params.get('q')).toBe('laptop');
    expect(req.request.params.get('status')).toBe('pending');
    expect(req.request.params.has('type')).toBe(false);
    req.flush([dto()], { headers: { 'X-Total-Count': '42' } });

    const page = await result;
    expect(page.total).toBe(42);
    expect(page.items[0].amount).toBe(2500);
  });

  it('serves a repeated query from cache and refetches after a creation invalidates it', async () => {
    const first = firstValueFrom(api.list(DEFAULT_REQUEST_FILTERS));
    http.expectOne((r) => r.url === `${API}/requests`).flush([dto()], { headers: { 'X-Total-Count': '1' } });
    await first;

    await firstValueFrom(api.list(DEFAULT_REQUEST_FILTERS));
    http.expectNone((r) => r.url === `${API}/requests` && r.method === 'GET');

    const created = firstValueFrom(
      api.create({ type: 'equipment', title: 'Monitor 4K', amount: 900, details: { model: 'Dell U2723QE' } }),
    );
    http.expectOne({ method: 'POST', url: `${API}/requests` }).flush(dto({ id: 2, title: 'Monitor 4K' }));
    await created;
    expect(events.last()?.kind).toBe('created');

    void firstValueFrom(api.list(DEFAULT_REQUEST_FILTERS));
    http.expectOne((r) => r.url === `${API}/requests` && r.method === 'GET').flush([], { headers: { 'X-Total-Count': '0' } });
  });

  it('turns a 409 into a VersionConflictError with the normalized current request and publishes it', async () => {
    const decision = firstValueFrom(api.decide(1, { status: 'approved', version: 1 }));
    http.expectOne({ method: 'PATCH', url: `${API}/requests/1` }).flush(
      { code: 'VERSION_CONFLICT', message: 'La solicitud fue modificada por otra persona', current: dto({ status: 'approved', version: 2 }) },
      { status: 409, statusText: 'Conflict' },
    );

    const error: unknown = await decision.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(VersionConflictError);
    const conflict = error as VersionConflictError;
    expect(conflict.latest.status).toBe('approved');
    expect(conflict.latest.version).toBe(2);
    expect(events.last()).toEqual({ kind: 'conflict', request: conflict.latest });
  });

  it('maps 422 field errors into ApiError.fieldErrors', async () => {
    const creation = firstValueFrom(api.create({ type: 'access', title: 'VPN', details: { system: '', justification: '' } }));
    http.expectOne({ method: 'POST', url: `${API}/requests` }).flush(
      { message: 'Validación fallida', errors: { title: ['El título debe tener al menos 5 caracteres'] } },
      { status: 422, statusText: 'Unprocessable Entity' },
    );

    const error = (await creation.catch((e: unknown) => e)) as ApiError;
    expect(error.isValidation).toBe(true);
    expect(error.fieldErrors['title']).toEqual(['El título debe tener al menos 5 caracteres']);
  });

  describe('get', () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it('retries transient 500 errors before succeeding', async () => {
      const result = firstValueFrom(api.get(1));
      http.expectOne(`${API}/requests/1`).flush({ code: 'INTERNAL_ERROR' }, { status: 500, statusText: 'Error' });
      await vi.advanceTimersByTimeAsync(250);
      http.expectOne(`${API}/requests/1`).flush(dto());

      expect((await result).id).toBe(1);
    });

    it('does not retry a 404', async () => {
      const result = firstValueFrom(api.get(999));
      http.expectOne(`${API}/requests/999`).flush({ message: 'No encontrado' }, { status: 404, statusText: 'Not Found' });

      const error = (await result.catch((e: unknown) => e)) as ApiError;
      expect(error.status).toBe(404);
      await vi.advanceTimersByTimeAsync(1000);
      http.expectNone(`${API}/requests/999`);
    });
  });
});
