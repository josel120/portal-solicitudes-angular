import { FormControl, NonNullableFormBuilder, Validators } from '@angular/forms';
import { CatalogType, CreateRequestPayload, RequestType, dateRangeValidator } from '@portal/shared';

export function buildRequestForm(fb: NonNullableFormBuilder) {
  return fb.group({
    type: fb.control<RequestType>('equipment', Validators.required),
    title: fb.control('', [Validators.required, Validators.minLength(5), Validators.maxLength(80)]),
    amount: new FormControl<number | null>(null),
    details: fb.group(
      {
        model: fb.control('', Validators.required),
        system: fb.control('', Validators.required),
        justification: fb.control('', [Validators.required, Validators.minLength(20)]),
        destination: fb.control('', Validators.required),
        startDate: fb.control('', Validators.required),
        endDate: fb.control('', Validators.required),
      },
      { validators: dateRangeValidator('startDate', 'endDate') },
    ),
  });
}

export type RequestForm = ReturnType<typeof buildRequestForm>;
export type DetailField = keyof RequestForm['controls']['details']['controls'];

/**
 * Enables exactly the controls the catalog lists as required for the type (disabled controls skip
 * validation and are hidden), and applies the catalog's max amount.
 */
export function applyCatalogType(form: RequestForm, type: CatalogType): void {
  const required = new Set(type.requiredFields);
  const details = form.controls.details.controls;
  for (const [name, control] of Object.entries(details)) {
    if (required.has(name)) control.enable({ emitEvent: false });
    else control.disable({ emitEvent: false });
  }

  const amount = form.controls.amount;
  if (required.has('amount')) {
    const validators = [Validators.required, Validators.min(0.01)];
    if (type.maxAmount !== null) validators.push(Validators.max(type.maxAmount));
    amount.setValidators(validators);
    amount.enable({ emitEvent: false });
  } else {
    amount.disable({ emitEvent: false });
  }
  form.updateValueAndValidity();
}

export function toCreatePayload(form: RequestForm): CreateRequestPayload {
  const value = form.getRawValue();
  const title = value.title.trim();
  const amount = value.amount ?? 0;
  const d = value.details;
  switch (value.type) {
    case 'equipment':
      return { type: 'equipment', title, amount, details: { model: d.model.trim() } };
    case 'access':
      return { type: 'access', title, details: { system: d.system.trim(), justification: d.justification.trim() } };
    case 'travel':
      return {
        type: 'travel',
        title,
        amount,
        details: { destination: d.destination.trim(), startDate: d.startDate, endDate: d.endDate },
      };
  }
}
