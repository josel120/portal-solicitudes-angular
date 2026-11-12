import { Routes } from '@angular/router';
import { LoginPage, authGuard, guestGuard } from '@portal/shared';

/** Standalone-only routes: the shell provides its own login/guards when it hosts this remote. */
export const routes: Routes = [
  { path: 'login', canMatch: [guestGuard], component: LoginPage, title: 'Ingresar · mfe-requests' },
  { path: '', canMatch: [authGuard], loadChildren: () => import('./requests.routes') },
  { path: '**', redirectTo: '' },
];
