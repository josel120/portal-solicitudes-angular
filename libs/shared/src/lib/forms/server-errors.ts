import { AbstractControl, FormArray, FormGroup, ValidationErrors, ValidatorFn } from '@angular/forms';
import { FieldErrors } from '../models/api-error';

/** Depth-first search of a control by its key, so `details.endDate` is found as `endDate`. */
function findControl(root: AbstractControl, key: string): AbstractControl | null {
  if (!(root instanceof FormGroup || root instanceof FormArray)) return null;
  const direct = root.get(key);
  if (direct) return direct;
  for (const child of Object.values(root.controls)) {
    const found = findControl(child, key);
    if (found) return found;
  }
  return null;
}

/**
 * Attaches 422 messages to the matching controls under the `server` error key and returns the
 * messages whose field has no control (so the form can still show them in a general alert).
 */
export function applyServerErrors(form: AbstractControl, errors: FieldErrors): string[] {
  const unmatched: string[] = [];
  for (const [field, messages] of Object.entries(errors)) {
    const control = findControl(form, field);
    if (control && control.enabled) {
      control.setErrors({ ...control.errors, server: messages });
      control.markAsTouched();
    } else {
      unmatched.push(...messages);
    }
  }
  return unmatched;
}

/** Group validator: `endKey` must be the same day or after `startKey` (ISO YYYY-MM-DD strings). */
export function dateRangeValidator(startKey: string, endKey: string): ValidatorFn {
  return (group: AbstractControl): ValidationErrors | null => {
    const start: unknown = group.get(startKey)?.value;
    const end: unknown = group.get(endKey)?.value;
    if (typeof start !== 'string' || typeof end !== 'string' || !start || !end) return null;
    return end < start ? { dateRange: true } : null;
  };
}
