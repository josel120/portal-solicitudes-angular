import { DatePipe, DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { ApiError, ErrorState, LoadingState, RequestEvents, RequestsApi, StatusBadge, TYPE_LABELS } from '@portal/shared';
import { throwError } from 'rxjs';
import { detailRows } from './request-view';

@Component({
  selector: 'app-request-detail',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, StatusBadge, LoadingState, ErrorState],
  templateUrl: './request-detail.page.html',
  styleUrl: './request-detail.page.css',
})
export class RequestDetailPage {
  private readonly api = inject(RequestsApi);
  private readonly events = inject(RequestEvents);

  /** Route param, bound with withComponentInputBinding. */
  readonly id = input.required<string>();

  protected readonly typeLabels = TYPE_LABELS;

  protected readonly request = rxResource({
    params: () => ({ id: Number(this.id()), revision: this.events.revision() }),
    stream: ({ params }) =>
      Number.isInteger(params.id) && params.id > 0
        ? this.api.get(params.id)
        : throwError(() => new ApiError(404, 'La solicitud no existe.')),
  });

  protected readonly rows = computed(() => (this.request.hasValue() ? detailRows(this.request.value()) : []));
  protected readonly notFound = computed(() => {
    const error = this.request.error();
    return error instanceof ApiError && error.status === 404;
  });
}
