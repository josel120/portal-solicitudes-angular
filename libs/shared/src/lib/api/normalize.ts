import { ApiError } from '../models/api-error';
import { CatalogType, InternalRequest, isRequestStatus, isRequestType } from '../models/request';

/** Raw shapes as the API actually sends them (amount may be number, numeric string or missing). */
export interface RequestDto {
  readonly id: number;
  readonly title: string;
  readonly type: string;
  readonly status: string;
  readonly requesterId: number;
  readonly requesterName: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly version: number;
  readonly details?: Readonly<Record<string, unknown>>;
  readonly amount?: number | string | null;
  readonly decisionComment?: string;
  readonly decidedAt?: string;
}

export interface CatalogTypeDto {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly amount?: number | string | null;
  readonly requiredFields?: readonly string[];
}

/**
 * The single place where `amount` is normalized. Accepts numbers and numeric strings
 * ("8400", "8400.00"); anything else (missing, empty, garbage, NaN) becomes `null`.
 */
export function parseAmount(raw: unknown): number | null {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw === 'string') {
    const trimmed = raw.trim();
    if (!/^-?\d+(\.\d+)?$/.test(trimmed)) return null;
    return Number(trimmed);
  }
  return null;
}

function text(details: Readonly<Record<string, unknown>> | undefined, key: string): string {
  const value = details?.[key];
  return typeof value === 'string' ? value : '';
}

export function toInternalRequest(dto: RequestDto): InternalRequest {
  if (!isRequestType(dto.type) || !isRequestStatus(dto.status)) {
    throw new ApiError(-1, `Solicitud ${dto.id} con tipo o estado desconocido`);
  }
  const base = {
    id: dto.id,
    title: dto.title,
    status: dto.status,
    requesterId: dto.requesterId,
    requesterName: dto.requesterName,
    createdAt: dto.createdAt,
    updatedAt: dto.updatedAt,
    version: dto.version,
    decisionComment: dto.decisionComment ?? null,
    decidedAt: dto.decidedAt ?? null,
  };
  const d = dto.details;
  switch (dto.type) {
    case 'equipment':
      return { ...base, type: 'equipment', amount: parseAmount(dto.amount), details: { model: text(d, 'model') } };
    case 'access':
      return {
        ...base,
        type: 'access',
        amount: null,
        details: { system: text(d, 'system'), justification: text(d, 'justification') },
      };
    case 'travel':
      return {
        ...base,
        type: 'travel',
        amount: parseAmount(dto.amount),
        details: {
          destination: text(d, 'destination'),
          startDate: text(d, 'startDate'),
          endDate: text(d, 'endDate'),
        },
      };
  }
}

export function toCatalogType(dto: CatalogTypeDto): CatalogType {
  if (!isRequestType(dto.id)) {
    throw new ApiError(-1, `Tipo de catálogo desconocido: ${dto.id}`);
  }
  const max = parseAmount(dto.amount);
  return {
    id: dto.id,
    name: dto.name,
    description: dto.description,
    maxAmount: max !== null && max > 0 ? max : null,
    requiredFields: dto.requiredFields ?? [],
  };
}
