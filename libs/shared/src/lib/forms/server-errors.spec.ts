import { FormControl, FormGroup } from '@angular/forms';
import { applyServerErrors, dateRangeValidator } from './server-errors';

function travelForm(start = '', end = '') {
  return new FormGroup({
    title: new FormControl(''),
    details: new FormGroup(
      { startDate: new FormControl(start), endDate: new FormControl(end), model: new FormControl({ value: '', disabled: true }) },
      { validators: dateRangeValidator('startDate', 'endDate') },
    ),
  });
}

describe('applyServerErrors', () => {
  it('puts each message on the matching control, including nested detail fields', () => {
    const form = travelForm();
    const unmatched = applyServerErrors(form, {
      title: ['Ya tienes una solicitud pendiente con este título'],
      startDate: ['Los viajes se solicitan con al menos 3 días de anticipación'],
    });

    expect(unmatched).toEqual([]);
    expect(form.get('title')?.getError('server')).toEqual(['Ya tienes una solicitud pendiente con este título']);
    expect(form.get('details.startDate')?.getError('server')).toEqual([
      'Los viajes se solicitan con al menos 3 días de anticipación',
    ]);
    expect(form.get('details.startDate')?.touched).toBe(true);
  });

  it('returns messages for unknown or disabled fields so they can be shown globally', () => {
    const form = travelForm();
    const unmatched = applyServerErrors(form, { model: ['El modelo es obligatorio'], foo: ['Campo raro'] });
    expect(unmatched).toEqual(['El modelo es obligatorio', 'Campo raro']);
  });
});

describe('dateRangeValidator', () => {
  it('flags an end date before the start date', () => {
    expect(travelForm('2026-12-18', '2026-12-15').get('details')?.hasError('dateRange')).toBe(true);
  });

  it('accepts the same day and incomplete ranges', () => {
    expect(travelForm('2026-12-15', '2026-12-15').get('details')?.hasError('dateRange')).toBe(false);
    expect(travelForm('2026-12-15', '').get('details')?.hasError('dateRange')).toBe(false);
  });
});
