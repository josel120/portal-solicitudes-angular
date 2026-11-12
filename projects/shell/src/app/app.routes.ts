import { inject } from '@angular/core';
import { NavigationError, RedirectCommand, Router, Routes } from '@angular/router';
import { ForbiddenPage, LoginPage, authGuard, guestGuard, roleGuard } from '@portal/shared';
import { RemoteUnavailableError, loadRemoteRoutes } from './remotes/remote-registry';
import { RemoteUnavailablePage } from './remotes/remote-unavailable.page';

export const routes: Routes = [
  { path: 'login', canMatch: [guestGuard], component: LoginPage, title: 'Ingresar · Portal' },
  { path: 'forbidden', component: ForbiddenPage, title: 'Acceso restringido · Portal' },
  { path: 'unavailable', component: RemoteUnavailablePage, title: 'Sección no disponible · Portal' },
  {
    path: '',
    canMatch: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'requests' },
      { path: 'requests', loadChildren: loadRemoteRoutes('mfe-requests') },
      {
        path: 'approvals',
        canMatch: [roleGuard('approver')],
        loadChildren: loadRemoteRoutes('mfe-approvals'),
      },
    ],
  },
  { path: '**', redirectTo: '' },
];

/**
 * A remote that fails to load must not break the shell: redirect to an error page that remembers
 * where the user was going so "Reintentar" can try the same navigation again. The router does not
 * cache failed `loadChildren` calls, so the retry really re-fetches the remote.
 */
export function handleNavigationError(event: NavigationError): RedirectCommand | undefined {
  if (event.error instanceof RemoteUnavailableError) {
    const router = inject(Router);
    console.error(event.error, event.error.cause);
    return new RedirectCommand(
      router.createUrlTree(['/unavailable'], {
        queryParams: { remote: event.error.remoteName, returnUrl: event.url },
      }),
    );
  }
  return undefined;
}
