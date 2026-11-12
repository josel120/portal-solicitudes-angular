import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { ErrorState, safeReturnUrl } from '@portal/shared';

const SECTION_NAMES: Readonly<Record<string, string>> = {
  'mfe-requests': 'Solicitudes',
  'mfe-approvals': 'Aprobaciones',
};

@Component({
  selector: 'app-remote-unavailable',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ErrorState],
  template: `
    <h1 tabindex="-1">{{ sectionName() }}</h1>
    <ps-error-state
      [title]="'La sección ' + sectionName() + ' no está disponible en este momento.'"
      [message]="retrying() ? 'Reintentando…' : 'El resto del portal sigue funcionando.'"
      (retry)="retry()"
    />
  `,
})
export class RemoteUnavailablePage {
  private readonly router = inject(Router);

  /** Query params bound via withComponentInputBinding. */
  readonly remote = input<string | null>(null);
  readonly returnUrl = input<string | null>(null);

  protected readonly retrying = signal(false);
  protected readonly sectionName = computed(() => SECTION_NAMES[this.remote() ?? ''] ?? 'solicitada');

  protected retry(): void {
    this.retrying.set(true);
    void this.router.navigateByUrl(safeReturnUrl(this.returnUrl())).finally(() => this.retrying.set(false));
  }
}
