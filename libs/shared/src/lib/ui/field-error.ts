import { ChangeDetectionStrategy, Component, DestroyRef, computed, inject, input, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { AbstractControl } from '@angular/forms';
import { merge, switchMap } from 'rxjs';

/** Client-side messages per validator key; `server` messages come from the API as-is. */
const MESSAGES: Readonly<Record<string, (error: unknown) => string>> = {
  required: () => 'Este campo es obligatorio.',
  email: () => 'Ingresa un email válido.',
  minlength: (e) => `Debe tener al menos ${requiredLength(e)} caracteres.`,
  maxlength: (e) => `No puede superar ${requiredLength(e)} caracteres.`,
  min: () => 'El valor debe ser mayor a 0.',
  max: (e) => `El valor máximo es ${maxValue(e)}.`,
  dateRange: () => 'La fecha de fin debe ser igual o posterior a la de inicio.',
};

function requiredLength(error: unknown): string {
  return typeof error === 'object' && error !== null && 'requiredLength' in error ? String(error.requiredLength) : '';
}

function maxValue(error: unknown): string {
  return typeof error === 'object' && error !== null && 'max' in error ? String(error.max) : '';
}

function messagesFor(control: AbstractControl | null, extraErrorKeys: readonly string[]): string[] {
  if (!control || !control.touched) return [];
  const errors = { ...control.errors };
  const result: string[] = [];
  for (const [key, value] of Object.entries(errors)) {
    if (key === 'server' && Array.isArray(value)) {
      result.push(...value.filter((m): m is string => typeof m === 'string'));
    } else if (!extraErrorKeys.includes(key)) {
      result.push(MESSAGES[key]?.(value) ?? 'Valor inválido.');
    }
  }
  return result;
}

/**
 * Renders validation messages for a control. Bridges the form's event stream into a signal so it
 * works with OnPush/zoneless without the template calling methods. Give the host an `id` and point
 * the input's `aria-describedby` at it.
 */
@Component({
  selector: 'ps-field-error',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @for (message of messages(); track message) {
      <p class="ps-field-error">{{ message }}</p>
    }
  `,
})
export class FieldError {
  readonly control = input.required<AbstractControl | null>();
  /** Group-level error keys to also show on this control (e.g. `dateRange`). */
  readonly groupErrors = input<readonly string[]>([]);
  readonly group = input<AbstractControl | null>(null);

  private readonly tick = signal(0);
  protected readonly messages = computed(() => {
    this.tick();
    const own = messagesFor(this.control(), []);
    const group = this.group();
    const control = this.control();
    if (!group || !control?.touched) return own;
    const fromGroup = this.groupErrors()
      .filter((key) => group.hasError(key))
      .map((key) => MESSAGES[key]?.(group.getError(key)) ?? 'Valor inválido.');
    return [...own, ...fromGroup];
  });

  constructor() {
    toObservable(computed(() => [this.control(), this.group()] as const))
      .pipe(
        switchMap(([control, group]) => merge(...[control, group].filter((c) => c !== null).map((c) => c.events))),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.tick.update((v) => v + 1));
  }
}
