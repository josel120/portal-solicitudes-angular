import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { ApiError, DecisionPayload, InternalRequest, Page, RequestsApi, VersionConflictError } from '@portal/shared';
import { Observable, of, throwError } from 'rxjs';
import { ApprovalsInboxPage } from './approvals-inbox.page';

const pending: InternalRequest = {
  id: 7,
  title: 'Visita a cliente',
  type: 'travel',
  status: 'pending',
  requesterId: 2,
  requesterName: 'Bruno Díaz',
  createdAt: '2026-10-01T04:17:13.000Z',
  updatedAt: '2026-10-01T04:17:13.000Z',
  version: 1,
  decisionComment: null,
  decidedAt: null,
  details: { destination: 'Lima', startDate: '2026-12-05', endDate: '2026-12-10' },
  amount: 4000,
};

class RequestsApiStub {
  page: Page<InternalRequest> = { items: [pending], total: 1 };
  decision: Observable<InternalRequest> = of({ ...pending, status: 'approved', version: 2 });
  readonly list = vi.fn(() => of(this.page));
  readonly decide = vi.fn((_id: number, _payload: DecisionPayload) => this.decision);
}

describe('ApprovalsInboxPage', () => {
  let fixture: ComponentFixture<ApprovalsInboxPage>;
  let api: RequestsApiStub;
  let el: HTMLElement;

  const button = (label: string) => el.querySelector<HTMLButtonElement>(`button[aria-label="${label}"]`);

  beforeEach(async () => {
    api = new RequestsApiStub();
    TestBed.configureTestingModule({
      imports: [ApprovalsInboxPage],
      providers: [provideRouter([]), { provide: RequestsApi, useValue: api }],
    });
    fixture = TestBed.createComponent(ApprovalsInboxPage);
    el = fixture.nativeElement;
    await fixture.whenStable();
  });

  it('lists pending requests oldest first', () => {
    expect(api.list).toHaveBeenCalledWith(expect.objectContaining({ status: 'pending' }), {
      field: 'createdAt',
      order: 'asc',
    });
    expect(el.textContent).toContain('Visita a cliente');
  });

  it('approves with the version it has and confirms to the user', async () => {
    button('Aprobar solicitud 7')?.click();
    await fixture.whenStable();

    expect(api.decide).toHaveBeenCalledWith(7, { status: 'approved', version: 1 });
    expect(el.querySelector('.ps-alert--success')?.textContent).toContain('#7 aprobada');
  });

  it('explains a 409 conflict with the state another approver left', async () => {
    const latest: InternalRequest = { ...pending, status: 'rejected', version: 2 };
    api.decision = throwError(
      () => new VersionConflictError(new ApiError(409, 'La solicitud fue modificada', 'VERSION_CONFLICT'), latest),
    );

    button('Aprobar solicitud 7')?.click();
    await fixture.whenStable();

    expect(el.querySelector('.ps-alert--warning')?.textContent).toContain('Otra persona ya dejó la solicitud #7 como rechazada');
  });

  it('requires a comment before rejecting', async () => {
    button('Rechazar solicitud 7')?.click();
    await fixture.whenStable();

    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();
    expect(api.decide).not.toHaveBeenCalled();
    expect(el.querySelector('#reject-comment-error')?.textContent).toContain('obligatorio');

    const textarea = el.querySelector<HTMLTextAreaElement>('#reject-comment');
    if (!textarea) throw new Error('comment box not rendered');
    textarea.value = 'Sin presupuesto';
    textarea.dispatchEvent(new Event('input'));
    el.querySelector('form')?.dispatchEvent(new Event('submit'));
    await fixture.whenStable();

    expect(api.decide).toHaveBeenCalledWith(7, { status: 'rejected', version: 1, decisionComment: 'Sin presupuesto' });
  });
});
