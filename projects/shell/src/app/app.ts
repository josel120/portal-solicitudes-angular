import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, Injector, afterNextRender, computed, inject, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { AuthApi, SessionStore } from '@portal/shared';
import { filter, skip } from 'rxjs';

@Component({
  selector: 'app-root',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  private readonly router = inject(Router);
  private readonly authApi = inject(AuthApi);
  private readonly injector = inject(Injector);
  protected readonly session = inject(SessionStore);
  protected readonly roleLabel = computed(() => (this.session.isApprover() ? 'Aprobador' : 'Empleado'));
  private readonly main = viewChild.required<ElementRef<HTMLElement>>('main');

  constructor() {
    // Move focus to the new page's heading after each client-side navigation (except the first
    // load) so keyboard and screen-reader users land on the new content.
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        skip(1),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => afterNextRender(() => this.focusMain(), { injector: this.injector }));
  }

  protected logout(): void {
    // Server-side logout is best effort; the local session ends regardless.
    this.authApi.logout().subscribe({ error: () => undefined });
    this.session.end('logout');
    void this.router.navigateByUrl('/login');
  }

  private focusMain(): void {
    const main = this.main().nativeElement;
    const heading = main.querySelector<HTMLElement>('h1');
    if (heading) {
      if (!heading.hasAttribute('tabindex')) heading.setAttribute('tabindex', '-1');
      heading.focus();
    } else {
      main.focus();
    }
  }
}
