import { Routes } from '@angular/router';
import { roleGuard } from '@portal/shared';

/**
 * Exposed to the shell as `./routes`. The role check is repeated here (the shell also guards the
 * route) so the remote is safe on its own: it never trusts its host to have done it.
 */
const routes: Routes = [
  {
    path: '',
    canMatch: [roleGuard('approver')],
    loadComponent: () => import('./inbox/approvals-inbox.page').then((m) => m.ApprovalsInboxPage),
    title: 'Aprobaciones · Portal',
  },
];

export default routes;
