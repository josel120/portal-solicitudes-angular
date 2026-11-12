import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApi } from '../api/auth-api';
import { safeReturnUrl } from '../auth/return-url';
import { applyServerErrors } from '../forms/server-errors';
import { ApiError } from '../models/api-error';
import { SessionStore } from '../session/session-store';
import { FieldError } from './field-error';

/**
 * Login screen. Lives in the shared library so the shell and each remote (in standalone mode)
 * render the same page; inside the federated app only the shell routes to it.
 */
@Component({
  selector: 'ps-login-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, FieldError],
  template: `
    <section class="ps-login" aria-labelledby="login-title">
      <h1 id="login-title" tabindex="-1">Iniciar sesión</h1>
      @if (notice()) {
        <p class="ps-alert ps-alert--info" role="status">{{ notice() }}</p>
      }
      @if (formError()) {
        <p class="ps-alert ps-alert--error" role="alert">{{ formError() }}</p>
      }
      <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
        <div class="ps-field">
          <label for="login-email">Email</label>
          <input
            id="login-email"
            type="email"
            autocomplete="username"
            formControlName="email"
            aria-describedby="login-email-error"
          />
          <ps-field-error [control]="form.controls.email" id="login-email-error" />
        </div>
        <div class="ps-field">
          <label for="login-password">Contraseña</label>
          <input
            id="login-password"
            type="password"
            autocomplete="current-password"
            formControlName="password"
            aria-describedby="login-password-error"
          />
          <ps-field-error [control]="form.controls.password" id="login-password-error" />
        </div>
        <button type="submit" class="ps-btn ps-btn--primary" [disabled]="submitting()">
          {{ submitting() ? 'Ingresando…' : 'Ingresar' }}
        </button>
      </form>
    </section>
  `,
})
export class LoginPage {
  private readonly authApi = inject(AuthApi);
  private readonly session = inject(SessionStore);
  private readonly router = inject(Router);

  /** Bound from the `returnUrl` query param (withComponentInputBinding). */
  readonly returnUrl = input<string | null>(null);

  protected readonly form = inject(FormBuilder).nonNullable.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', Validators.required],
  });
  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);
  protected readonly notice = computed(() => {
    switch (this.session.endReason()) {
      case 'expired':
        return 'Tu sesión expiró. Vuelve a ingresar para continuar.';
      case 'unauthorized':
        return 'Necesitas iniciar sesión para continuar.';
      default:
        return null;
    }
  });

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.submitting.set(true);
    this.formError.set(null);
    this.authApi
      .login(this.form.getRawValue())
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (session) => {
          this.session.start(session);
          void this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
        },
        error: (error: ApiError) => {
          const unmatched = error.isValidation ? applyServerErrors(this.form, error.fieldErrors) : [];
          this.formError.set(error.isValidation ? (unmatched[0] ?? null) : error.message);
        },
      });
  }
}

@Component({
  selector: 'ps-forbidden-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <section class="ps-state ps-state--error" role="alert">
      <h1 tabindex="-1">Acceso restringido</h1>
      <p>Esta sección es solo para aprobadores.</p>
    </section>
  `,
})
export class ForbiddenPage {}
