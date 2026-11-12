import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { Router, RouterOutlet } from '@angular/router';
import { SessionStore } from '@portal/shared';

/** Minimal frame used only when the remote runs standalone (`ng serve mfe-requests`). */
@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet],
  template: `
    <header class="standalone-bar">
      <strong>mfe-requests</strong> <span>· modo standalone</span>
      @if (session.user(); as user) {
        <span class="spacer"></span>
        <span>{{ user.name }}</span>
        <button type="button" class="ps-btn" (click)="logout()">Salir</button>
      }
    </header>
    <main id="main" tabindex="-1"><router-outlet /></main>
  `,
  styles: `
    .standalone-bar { display: flex; gap: 0.75rem; align-items: center; padding: 0.75rem 1.5rem; background: #fff4e0; }
    .spacer { flex: 1; }
    main { max-width: 1100px; margin: 0 auto; padding: 1.5rem; }
  `,
})
export class App {
  protected readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  protected logout(): void {
    this.session.end('logout');
    void this.router.navigateByUrl('/login');
  }
}
