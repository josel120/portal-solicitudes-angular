import { Routes } from '@angular/router';

/**
 * Exposed to the shell as `./routes` (see federation.config.mjs). All links inside this remote are
 * relative, so the same routes work under `/requests` in the shell and at `/` when standalone.
 */
const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./list/requests-list.page').then((m) => m.RequestsListPage),
    title: 'Solicitudes · Portal',
  },
  {
    path: 'new',
    loadComponent: () => import('./create/request-create.page').then((m) => m.RequestCreatePage),
    title: 'Nueva solicitud · Portal',
  },
  {
    path: ':id',
    loadComponent: () => import('./detail/request-detail.page').then((m) => m.RequestDetailPage),
    title: 'Detalle de solicitud · Portal',
  },
];

export default routes;
