import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  Injector,
  afterNextRender,
  computed,
  effect,
  inject,
  linkedSignal,
  signal,
} from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ApiError,
  DEFAULT_REQUEST_FILTERS,
  DecisionPayload,
  EmptyState,
  ErrorState,
  FieldError,
  InternalRequest,
  LoadingState,
  Page,
  RequestEvents,
  RequestSort,
  RequestsApi,
  STATUS_LABELS,
  TYPE_LABELS,
  VersionConflictError,
} from '@portal/shared';
import { finalize } from 'rxjs';

const PAGE_SIZE = 10;
/** Oldest first: the inbox is a work queue. */
const INBOX_SORT: RequestSort = { field: 'createdAt', order: 'asc' };

export interface InboxNotice {
  readonly kind: 'success' | 'warning' | 'error';
  readonly text: string;
}

@Component({
  selector: 'app-approvals-inbox',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, ReactiveFormsModule, FieldError, LoadingState, ErrorState, EmptyState],
  templateUrl: './approvals-inbox.page.html',
  styleUrl: './approvals-inbox.page.css',
})
export class ApprovalsInboxPage {
  private readonly api = inject(RequestsApi);
  private readonly events = inject(RequestEvents);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  protected readonly typeLabels = TYPE_LABELS;
  protected readonly page = signal(1);

  /** Refetches on every published change (ours, a conflict, or a creation in mfe-requests). */
  protected readonly inbox = rxResource({
    params: () => ({ page: this.page(), revision: this.events.revision() }),
    stream: ({ params }) =>
      this.api.list({ ...DEFAULT_REQUEST_FILTERS, status: 'pending', page: params.page, limit: PAGE_SIZE }, INBOX_SORT),
  });
  protected readonly current = linkedSignal<Page<InternalRequest> | undefined, Page<InternalRequest> | undefined>({
    source: () => (this.inbox.hasValue() ? this.inbox.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });
  protected readonly totalPages = computed(() => Math.max(1, Math.ceil((this.current()?.total ?? 0) / PAGE_SIZE)));

  /** Id of the request whose reject form is open, and the request being sent right now. */
  protected readonly rejectingId = signal<number | null>(null);
  protected readonly busyId = signal<number | null>(null);
  protected readonly notice = signal<InboxNotice | null>(null);
  protected readonly comment = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(5)],
  });

  constructor() {
    // Deciding the last item of the last page leaves it empty: step back one page.
    effect(() => {
      const page = this.current();
      if (page && page.items.length === 0 && this.page() > 1) this.page.update((p) => p - 1);
    });
  }

  protected approve(request: InternalRequest): void {
    this.decide(request, { status: 'approved', version: request.version });
  }

  protected startReject(request: InternalRequest): void {
    this.comment.reset();
    this.rejectingId.set(request.id);
    afterNextRender(() => this.host.nativeElement.querySelector<HTMLElement>('#reject-comment')?.focus(), {
      injector: this.injector,
    });
  }

  protected cancelReject(): void {
    this.rejectingId.set(null);
  }

  protected confirmReject(request: InternalRequest): void {
    if (this.comment.invalid) {
      this.comment.markAsTouched();
      return;
    }
    this.decide(request, { status: 'rejected', version: request.version, decisionComment: this.comment.value.trim() });
  }

  private decide(request: InternalRequest, payload: DecisionPayload): void {
    this.busyId.set(request.id);
    this.notice.set(null);
    this.api
      .decide(request.id, payload)
      .pipe(finalize(() => this.busyId.set(null)))
      .subscribe({
        next: (updated) => {
          this.rejectingId.set(null);
          this.notice.set({
            kind: 'success',
            text: `Solicitud #${updated.id} ${STATUS_LABELS[updated.status].toLowerCase()}.`,
          });
        },
        error: (error: ApiError) => this.handleError(request, error),
      });
  }

  private handleError(request: InternalRequest, error: ApiError): void {
    if (error instanceof VersionConflictError) {
      // The inbox refetches by itself (RequestsApi published a `conflict` event).
      this.rejectingId.set(null);
      const status = STATUS_LABELS[error.latest.status].toLowerCase();
      this.notice.set({
        kind: 'warning',
        text:
          error.latest.status === 'pending'
            ? `La solicitud #${request.id} cambió mientras la revisabas. Actualizamos la bandeja; revísala de nuevo.`
            : `Otra persona ya dejó la solicitud #${request.id} como ${status}. Actualizamos la bandeja.`,
      });
      return;
    }
    const commentErrors = error.fieldErrors['decisionComment'];
    if (error.isValidation && commentErrors) {
      this.comment.setErrors({ server: commentErrors });
      this.comment.markAsTouched();
      return;
    }
    this.notice.set({ kind: 'error', text: error.message });
  }
}
