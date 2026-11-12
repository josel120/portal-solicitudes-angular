import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, map, shareReplay, throwError } from 'rxjs';
import { toApiError } from '../models/api-error';
import { CatalogType } from '../models/request';
import { API_BASE_URL } from './api-config';
import { CatalogTypeDto, toCatalogType } from './normalize';

@Injectable({ providedIn: 'root' })
export class CatalogApi {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** The catalog rarely changes: fetched once per app lifetime; errors are not cached (shareReplay resets). */
  private readonly types$ = this.http.get<CatalogTypeDto[]>(`${this.baseUrl}/catalog/types`).pipe(
    map((types) => types.map(toCatalogType)),
    catchError((error: unknown) => throwError(() => toApiError(error))),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  types(): Observable<readonly CatalogType[]> {
    return this.types$;
  }
}
