import { RequestStatus, RequestType } from './request';

/** UI copy for domain enums. Centralized so a future i18n step only has to swap this file. */
export const STATUS_LABELS: Readonly<Record<RequestStatus, string>> = {
  pending: 'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

export const TYPE_LABELS: Readonly<Record<RequestType, string>> = {
  equipment: 'Equipo',
  access: 'Acceso',
  travel: 'Viaje',
};
