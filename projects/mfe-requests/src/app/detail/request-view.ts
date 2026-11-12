import { InternalRequest } from '@portal/shared';

export interface DetailRow {
  readonly label: string;
  readonly value: string;
}

/** Type-specific fields as label/value pairs, so the template has no per-type branching. */
export function detailRows(request: InternalRequest): readonly DetailRow[] {
  switch (request.type) {
    case 'equipment':
      return [{ label: 'Modelo', value: request.details.model }];
    case 'access':
      return [
        { label: 'Sistema', value: request.details.system },
        { label: 'Justificación', value: request.details.justification },
      ];
    case 'travel':
      return [
        { label: 'Destino', value: request.details.destination },
        { label: 'Fecha de inicio', value: request.details.startDate },
        { label: 'Fecha de fin', value: request.details.endDate },
      ];
  }
}
