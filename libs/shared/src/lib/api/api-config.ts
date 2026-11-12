import { InjectionToken } from '@angular/core';

/** Base URL of the backend. Each app can override it with its own provider. */
export const API_BASE_URL = new InjectionToken<string>('API_BASE_URL', {
  providedIn: 'root',
  factory: () => 'http://localhost:3000',
});
