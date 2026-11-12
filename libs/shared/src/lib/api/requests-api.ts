import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, of, retry, tap, throwError, timer } from 'rxjs';
import { ApiError, toApiError } from '../models/api-error';
import { CreateRequestPayload, DecisionPayload, InternalRequest, Page, RequestFilters } from '../models/request';
import { RequestEvents } from '../events/request-events';
import { API_BASE_URL } from './api-config';
import { RequestDto, toInternalRequest } from './normalize';
import { RequestsListCache } from './requests-list-cache';

export interface RequestSort {
  readonly field: 'createdAt' | 'updatedAt' | 'title';
  readonly order: 'asc' | 'desc';
}

export const DEFAULT_REQUEST_SORT: RequestSort = { field: 'createdAt', order: 'desc' };

/** Thrown by `decide` on 409; carries the server's current version of the request. */
export class VersionConflictError extends ApiError {
  constructor(
    source: ApiError,
    readonly latest: InternalRequest,
  ) {
    super(source.status, source.message, source.code, source.fieldErrors, source.current);
    this.name = 'VersionConflictError';
  }
}

const LIST_CACHE_TTL_MS = 30_000;
const DETAIL_RETRIES = 2;

function toParams(filters: RequestFilters, sort: RequestSort): HttpParams {
  let params = new HttpParams()
    .set('_page', filters.page)
    .set('_limit', filters.limit)
    .set('_sort', sort.field)
    .set('_order', sort.order);
  const q = filters.q.trim();
  if (q) params = params.set('q', q);
  if (filters.status) params = params.set('status', filters.status);
  if (filters.type) params = params.set('type', filters.type);
  return params;
}

function isRetryable(error: unknown): boolean {
  return error instanceof ApiError ? error.status >= 500 : false;
}

@Injectable({ providedIn: 'root' })
export class RequestsApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);
  private readonly events = inject(RequestEvents);
  private readonly cache = new RequestsListCache(LIST_CACHE_TTL_MS);

  list(filters: RequestFilters, sort: RequestSort = DEFAULT_REQUEST_SORT): Observable<Page<InternalRequest>> {
    const params = toParams(filters, sort);
    const key = params.toString();
    const cached = this.cache.get(key);
    if (cached) return of(cached);

    return this.http.get<RequestDto[]>(`${this.baseUrl}/requests`, { params, observe: 'response' }).pipe(
      map((response) => ({
        items: (response.body ?? []).map(toInternalRequest),
        total: Number(response.headers.get('X-Total-Count') ?? 0),
      })),
      tap((page) => this.cache.set(key, page)),
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  /** GET is idempotent, so transient 5xx errors are retried with a short backoff before surfacing. */
  get(id: number): Observable<InternalRequest> {
    return this.http.get<RequestDto>(`${this.baseUrl}/requests/${id}`).pipe(
      map(toInternalRequest),
      catchError((error: unknown) => throwError(() => toApiError(error))),
      retry({
        count: DETAIL_RETRIES,
        delay: (error: unknown, attempt: number) =>
          isRetryable(error) ? timer(250 * attempt) : throwError(() => error),
      }),
    );
  }

  create(payload: CreateRequestPayload): Observable<InternalRequest> {
    return this.http.post<RequestDto>(`${this.baseUrl}/requests`, payload).pipe(
      map(toInternalRequest),
      tap((request) => {
        this.cache.clear();
        this.events.publish({ kind: 'created', request });
      }),
      catchError((error: unknown) => throwError(() => toApiError(error))),
    );
  }

  decide(id: number, payload: DecisionPayload): Observable<InternalRequest> {
    return this.http.patch<RequestDto>(`${this.baseUrl}/requests/${id}`, payload).pipe(
      map(toInternalRequest),
      tap((request) => {
        this.cache.clear();
        this.events.publish({ kind: 'decided', request });
      }),
      catchError((error: unknown) => throwError(() => this.toDecisionError(error))),
    );
  }

  private toDecisionError(error: unknown): ApiError {
    const apiError = toApiError(error);
    if (!apiError.isConflict || apiError.current === null) return apiError;
    // Our cached pages are stale too: drop them and tell every listener about the real state.
    const latest = toInternalRequest(apiError.current as RequestDto);
    this.cache.clear();
    this.events.publish({ kind: 'conflict', request: latest });
    return new VersionConflictError(apiError, latest);
  }
}
