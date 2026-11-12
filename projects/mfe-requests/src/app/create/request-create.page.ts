import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { rxResource, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ApiError, CatalogApi, ErrorState, FieldError, LoadingState, applyServerErrors, RequestsApi } from '@portal/shared';
import { finalize } from 'rxjs';
import { applyCatalogType, buildRequestForm, toCreatePayload } from './request-form';

@Component({
  selector: 'app-request-create',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, FieldError, LoadingState, ErrorState],
  templateUrl: './request-create.page.html',
  styleUrl: './request-create.page.css',
})
export class RequestCreatePage {
  private readonly api = inject(RequestsApi);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly form = buildRequestForm(inject(NonNullableFormBuilder));
  private readonly catalogApi = inject(CatalogApi);
  protected readonly catalog = rxResource({ stream: () => this.catalogApi.types() });

  private readonly selectedTypeId = toSignal(this.form.controls.type.valueChanges, {
    initialValue: this.form.controls.type.value,
  });
  protected readonly selectedType = computed(() =>
    this.catalog.hasValue() ? this.catalog.value().find((t) => t.id === this.selectedTypeId()) : undefined,
  );
  /** Fields shown for the current type, driven by the catalog's `requiredFields`. */
  protected readonly visibleFields = computed(() => new Set(this.selectedType()?.requiredFields ?? []));

  protected readonly submitting = signal(false);
  protected readonly formError = signal<string | null>(null);

  constructor() {
    effect(() => {
      const type = this.selectedType();
      if (type) applyCatalogType(this.form, type);
    });
  }

  protected submit(): void {
    this.formError.set(null);
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      this.focusFirstInvalid();
      return;
    }
    this.submitting.set(true);
    this.api
      .create(toCreatePayload(this.form))
      .pipe(finalize(() => this.submitting.set(false)))
      .subscribe({
        next: (created) => void this.router.navigate(['..', created.id], { relativeTo: this.route }),
        error: (error: ApiError) => {
          if (error.isValidation) {
            const unmatched = applyServerErrors(this.form, error.fieldErrors);
            this.formError.set(unmatched.length ? unmatched.join(' ') : 'Revisa los campos marcados.');
            this.focusFirstInvalid();
          } else {
            this.formError.set(error.message);
          }
        },
      });
  }

  private focusFirstInvalid(): void {
    afterNextRender(
      () => {
        const field = this.host.nativeElement.querySelector<HTMLElement>(
          'input.ng-invalid, select.ng-invalid, textarea.ng-invalid',
        );
        field?.focus();
      },
      { injector: this.injector },
    );
  }
}
