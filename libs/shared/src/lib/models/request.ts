export const REQUEST_TYPES = ['equipment', 'access', 'travel'] as const;
export type RequestType = (typeof REQUEST_TYPES)[number];

export const REQUEST_STATUSES = ['pending', 'approved', 'rejected'] as const;
export type RequestStatus = (typeof REQUEST_STATUSES)[number];

export interface EquipmentDetails {
  readonly model: string;
}

export interface AccessDetails {
  readonly system: string;
  readonly justification: string;
}

export interface TravelDetails {
  readonly destination: string;
  /** ISO date, YYYY-MM-DD. */
  readonly startDate: string;
  /** ISO date, YYYY-MM-DD. */
  readonly endDate: string;
}

interface RequestBase {
  readonly id: number;
  readonly title: string;
  readonly status: RequestStatus;
  readonly requesterId: number;
  readonly requesterName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly decisionComment: string | null;
  readonly decidedAt: string | null;
}

export type InternalRequest =
  | (RequestBase & { readonly type: 'equipment'; readonly details: EquipmentDetails; readonly amount: number | null })
  | (RequestBase & { readonly type: 'access'; readonly details: AccessDetails; readonly amount: null })
  | (RequestBase & { readonly type: 'travel'; readonly details: TravelDetails; readonly amount: number | null });

export type CreateRequestPayload =
  | { readonly type: 'equipment'; readonly title: string; readonly amount: number; readonly details: EquipmentDetails }
  | { readonly type: 'access'; readonly title: string; readonly details: AccessDetails }
  | { readonly type: 'travel'; readonly title: string; readonly amount: number; readonly details: TravelDetails };

export type DecisionPayload =
  | { readonly status: 'approved'; readonly version: number }
  | { readonly status: 'rejected'; readonly version: number; readonly decisionComment: string };

export interface RequestFilters {
  readonly page: number;
  readonly limit: number;
  readonly q: string;
  readonly status: RequestStatus | null;
  readonly type: RequestType | null;
}

export const DEFAULT_REQUEST_FILTERS: RequestFilters = {
  page: 1,
  limit: 10,
  q: '',
  status: null,
  type: null,
};

export interface Page<T> {
  readonly items: readonly T[];
  readonly total: number;
}

export interface CatalogType {
  readonly id: RequestType;
  readonly name: string;
  readonly description: string;
  /** Upper bound for `amount`; `null` when the type does not take an amount. */
  readonly maxAmount: number | null;
  readonly requiredFields: readonly string[];
}

export function isRequestType(value: unknown): value is RequestType {
  return typeof value === 'string' && (REQUEST_TYPES as readonly string[]).includes(value);
}

export function isRequestStatus(value: unknown): value is RequestStatus {
  return typeof value === 'string' && (REQUEST_STATUSES as readonly string[]).includes(value);
}
