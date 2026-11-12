import { ParamMap, Params } from '@angular/router';
import { DEFAULT_REQUEST_FILTERS, RequestFilters, isRequestStatus, isRequestType } from '@portal/shared';

export const PAGE_SIZES: readonly number[] = [10, 20, 50];

function positiveInt(raw: string | null, fallback: number): number {
  const value = Number(raw);
  return Number.isInteger(value) && value > 0 ? value : fallback;
}

/** The URL is the source of truth for the list state; invalid values fall back to defaults. */
export function filtersFromParams(params: ParamMap): RequestFilters {
  const limit = positiveInt(params.get('limit'), DEFAULT_REQUEST_FILTERS.limit);
  const status = params.get('status');
  const type = params.get('type');
  return {
    page: positiveInt(params.get('page'), DEFAULT_REQUEST_FILTERS.page),
    limit: PAGE_SIZES.includes(limit) ? limit : DEFAULT_REQUEST_FILTERS.limit,
    q: params.get('q')?.trim() ?? '',
    status: isRequestStatus(status) ? status : null,
    type: isRequestType(type) ? type : null,
  };
}

/** Inverse of `filtersFromParams`; defaults are omitted to keep URLs short (null params are dropped). */
export function filtersToParams(filters: RequestFilters): Params {
  return {
    page: filters.page === DEFAULT_REQUEST_FILTERS.page ? null : filters.page,
    limit: filters.limit === DEFAULT_REQUEST_FILTERS.limit ? null : filters.limit,
    q: filters.q || null,
    status: filters.status,
    type: filters.type,
  };
}
