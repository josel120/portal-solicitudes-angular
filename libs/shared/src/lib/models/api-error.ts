import { HttpErrorResponse } from '@angular/common/http';

export type FieldErrors = Readonly<Record<string, readonly string[]>>;

/**
 * Normalized error for every failed API call, so views never inspect raw HttpErrorResponse.
 * `status` 0 means the request never reached the server (network / CORS).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly code: string | null = null,
    readonly fieldErrors: FieldErrors = {},
    /** Raw `current` payload sent with a 409 VERSION_CONFLICT. */
    readonly current: unknown = null,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isValidation(): boolean {
    return this.status === 422;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFieldErrors(value: unknown): FieldErrors {
  if (!isRecord(value)) return {};
  const result: Record<string, readonly string[]> = {};
  for (const [field, messages] of Object.entries(value)) {
    if (Array.isArray(messages)) {
      result[field] = messages.filter((m): m is string => typeof m === 'string');
    }
  }
  return result;
}

const DEFAULT_MESSAGES: Readonly<Record<number, string>> = {
  0: 'No se pudo contactar al servidor. Revisa tu conexión.',
  401: 'Tu sesión no es válida.',
  403: 'No tienes permisos para esta acción.',
  404: 'El recurso no existe.',
  409: 'El recurso fue modificado por otra persona.',
  422: 'Revisa los datos del formulario.',
};

export function toApiError(error: unknown): ApiError {
  if (error instanceof ApiError) return error;
  if (error instanceof HttpErrorResponse) {
    const body: unknown = error.error;
    const fallback = DEFAULT_MESSAGES[error.status] ?? 'Ocurrió un error inesperado. Intenta de nuevo.';
    if (isRecord(body)) {
      return new ApiError(
        error.status,
        typeof body['message'] === 'string' ? body['message'] : fallback,
        typeof body['code'] === 'string' ? body['code'] : null,
        readFieldErrors(body['errors']),
        body['current'] ?? null,
      );
    }
    return new ApiError(error.status, fallback);
  }
  return new ApiError(-1, error instanceof Error ? error.message : 'Error desconocido');
}
