import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { ApiError, CatalogApi, CatalogType, CreateRequestPayload, InternalRequest, RequestsApi } from '@portal/shared';
import { Observable, of, throwError } from 'rxjs';
import { RequestCreatePage } from './request-create.page';

const CATALOG: readonly CatalogType[] = [
  { id: 'equipment', name: 'Equipo', description: '', maxAmount: 3000, requiredFields: ['model', 'amount'] },
  { id: 'access', name: 'Acceso', description: '', maxAmount: null, requiredFields: ['system', 'justification'] },
  {
    id: 'travel',
    name: 'Viaje',
    description: '',
    maxAmount: 15000,
    requiredFields: ['destination', 'startDate', 'endDate', 'amount'],
  },
];

class RequestsApiStub {
  response: Observable<InternalRequest> = of({ id: 121 } as InternalRequest);
  readonly create = vi.fn((_payload: CreateRequestPayload) => this.response);
}

describe('RequestCreatePage', () => {
  let fixture: ComponentFixture<RequestCreatePage>;
  let api: RequestsApiStub;
  let el: HTMLElement;

  const field = <T extends HTMLElement>(id: string) => el.querySelector<T>(`#${id}`);
  const fill = (id: string, value: string) => {
    const input = field<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(id);
    if (!input) throw new Error(`#${id} not rendered`);
    input.value = value;
    input.dispatchEvent(new Event(input instanceof HTMLSelectElement ? 'change' : 'input'));
  };
  const submit = async () => {
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
  };
  const fillValidTravel = async () => {
    fill('type', 'travel');
    await fixture.whenStable();
    fill('title', 'Visita a cliente');
    fill('destination', 'Bogotá');
    fill('startDate', '2026-12-15');
    fill('endDate', '2026-12-18');
    fill('amount', '8400');
  };

  beforeEach(async () => {
    api = new RequestsApiStub();
    TestBed.configureTestingModule({
      imports: [RequestCreatePage],
      providers: [
        provideRouter([]),
        { provide: RequestsApi, useValue: api },
        { provide: CatalogApi, useValue: { types: () => of(CATALOG) } },
      ],
    });
    fixture = TestBed.createComponent(RequestCreatePage);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('shows only the fields the selected type requires', async () => {
    expect(field('model')).not.toBeNull();
    expect(field('destination')).toBeNull();

    fill('type', 'travel');
    await fixture.whenStable();

    expect(field('model')).toBeNull();
    expect(field('destination')).not.toBeNull();
    expect(field('startDate')).not.toBeNull();
    expect(field('amount')).not.toBeNull();

    fill('type', 'access');
    await fixture.whenStable();
    expect(field('amount')).toBeNull();
    expect(field('justification')).not.toBeNull();
  });

  it('blocks submission when the end date is before the start date', async () => {
    await fillValidTravel();
    fill('endDate', '2026-12-10');
    await submit();

    expect(api.create).not.toHaveBeenCalled();
    expect(el.querySelector('#endDate-error')?.textContent).toContain('posterior a la de inicio');
  });

  it('sends a typed payload with only the fields of the selected type', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);
    await fillValidTravel();
    await submit();

    expect(api.create).toHaveBeenCalledWith({
      type: 'travel',
      title: 'Visita a cliente',
      amount: 8400,
      details: { destination: 'Bogotá', startDate: '2026-12-15', endDate: '2026-12-18' },
    });
    expect(navigate).toHaveBeenCalledWith(['..', 121], expect.anything());
  });

  it('shows 422 server errors under the matching field, including nested detail fields', async () => {
    api.response = throwError(
      () =>
        new ApiError(422, 'Validación fallida', null, {
          startDate: ['Los viajes se solicitan con al menos 3 días de anticipación'],
        }),
    );
    await fillValidTravel();
    await submit();

    expect(el.querySelector('#startDate-error')?.textContent).toContain('3 días de anticipación');
    expect(el.querySelector('[role="alert"]')?.textContent).toContain('Revisa los campos marcados');
  });
});
