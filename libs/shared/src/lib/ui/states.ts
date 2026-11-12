import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';

@Component({
  selector: 'ps-loading-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ps-state" role="status" aria-live="polite">
      <span class="ps-spinner" aria-hidden="true"></span>
      <span>{{ label() }}</span>
    </div>
  `,
})
export class LoadingState {
  readonly label = input('Cargando…');
}

@Component({
  selector: 'ps-error-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ps-state ps-state--error" role="alert">
      <p class="ps-state__title">{{ title() }}</p>
      @if (message()) {
        <p class="ps-state__message">{{ message() }}</p>
      }
      @if (retryable()) {
        <button type="button" class="ps-btn" (click)="retry.emit()">Reintentar</button>
      }
    </div>
  `,
})
export class ErrorState {
  readonly title = input('No pudimos cargar la información.');
  readonly message = input<string | null>(null);
  readonly retryable = input(true);
  readonly retry = output<void>();
}

@Component({
  selector: 'ps-empty-state',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="ps-state" role="status">
      <p class="ps-state__title">{{ title() }}</p>
      <ng-content />
    </div>
  `,
})
export class EmptyState {
  readonly title = input('No hay resultados.');
}
