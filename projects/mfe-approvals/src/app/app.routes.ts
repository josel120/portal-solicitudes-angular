import { Routes } from '@angular/router';
import { ForbiddenPage, LoginPage, authGuard, guestGuard } from '@portal/shared';

/** Standalone-only routes: the shell provides its own login/guards when it hosts this remote. */
export const routes: Routes = [
  { path: 'login', canMatch: [guestGuard], component: LoginPage, title: 'Ingresar · mfe-approvals' },
  { path: 'forbidden', component: ForbiddenPage, title: 'Acceso restringido · mfe-approvals' },
  { path: '', canMatch: [authGuard], loadChildren: () => import('./approvals.routes') },
  { path: '**', redirectTo: '' },
];
