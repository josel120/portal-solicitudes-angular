import { DatePipe, DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  ElementRef,
  computed,
  inject,
  linkedSignal,
  signal,
  viewChildren,
} from '@angular/core';
import { rxResource, takeUntilDestroyed, toObservable, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import {
  EmptyState,
  ErrorState,
  InternalRequest,
  LoadingState,
  Page,
  REQUEST_STATUSES,
  REQUEST_TYPES,
  RequestEvents,
  RequestFilters,
  RequestsApi,
  STATUS_LABELS,
  StatusBadge,
  TYPE_LABELS,
  isRequestStatus,
  isRequestType,
} from '@portal/shared';
import { debounceTime, distinctUntilChanged, filter, map } from 'rxjs';
import { PAGE_SIZES, filtersFromParams, filtersToParams } from './requests-query';

const SEARCH_DEBOUNCE_MS = 350;

@Component({
  selector: 'app-requests-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, DatePipe, DecimalPipe, StatusBadge, LoadingState, ErrorState, EmptyState],
  templateUrl: './requests-list.page.html',
  styleUrl: './requests-list.page.css',
})
export class RequestsListPage {
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(RequestsApi);
  private readonly events = inject(RequestEvents);
  private readonly rows = viewChildren<ElementRef<HTMLTableRowElement>>('row');

  protected readonly statuses = REQUEST_STATUSES;
  protected readonly types = REQUEST_TYPES;
  protected readonly statusLabels = STATUS_LABELS;
  protected readonly typeLabels = TYPE_LABELS;
  protected readonly pageSizes = PAGE_SIZES;

  private readonly queryParams = toSignal(this.route.queryParamMap, { requireSync: true });
  protected readonly filters = computed(() => filtersFromParams(this.queryParams()));

  /** Writable while typing, but resets whenever the URL changes (back/forward, clear filters). */
  protected readonly searchText = linkedSignal(() => this.filters().q);

  /**
   * rxResource unsubscribes from the previous request when params change (switchMap semantics),
   * so a slow, stale response can never overwrite a newer one. `revision` refetches after
   * another remote creates/approves a request.
   */
  protected readonly requests = rxResource({
    params: () => ({ filters: this.filters(), revision: this.events.revision() }),
    stream: ({ params }) => this.api.list(params.filters),
  });

  /** Last successful page, kept on screen while the next one loads to avoid layout flashes. */
  protected readonly page = linkedSignal<Page<InternalRequest> | undefined, Page<InternalRequest> | undefined>({
    source: () => (this.requests.hasValue() ? this.requests.value() : undefined),
    computation: (next, previous) => next ?? previous?.value,
  });

  protected readonly totalPages = computed(() =>
    Math.max(1, Math.ceil((this.page()?.total ?? 0) / this.filters().limit)),
  );
  protected readonly hasActiveFilters = computed(() => {
    const { q, status, type } = this.filters();
    return q !== '' || status !== null || type !== null;
  });
  protected readonly activeRow = signal(0);

  constructor() {
    toObservable(this.searchText)
      .pipe(
        debounceTime(SEARCH_DEBOUNCE_MS),
        map((text) => text.trim()),
        distinctUntilChanged(),
        filter((q) => q !== this.filters().q),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe((q) => this.updateFilters({ q, page: 1 }, true));
  }

  protected setStatus(value: string): void {
    this.updateFilters({ status: isRequestStatus(value) ? value : null, page: 1 });
  }

  protected setType(value: string): void {
    this.updateFilters({ type: isRequestType(value) ? value : null, page: 1 });
  }

  protected setPageSize(value: string): void {
    this.updateFilters({ limit: Number(value), page: 1 });
  }

  protected goToPage(page: number): void {
    this.updateFilters({ page: Math.min(Math.max(page, 1), this.totalPages()) });
  }

  protected clearFilters(): void {
    this.updateFilters({ q: '', status: null, type: null, page: 1 });
  }

  protected open(id: number): void {
    void this.router.navigate([id], { relativeTo: this.route });
  }

  /** Roving tabindex: one tab stop for the table, arrows move between rows, Enter opens. */
  protected onRowKeydown(event: KeyboardEvent, index: number, id: number): void {
    const last = this.rows().length - 1;
    const next: Readonly<Record<string, number>> = {
      ArrowDown: Math.min(index + 1, last),
      ArrowUp: Math.max(index - 1, 0),
      Home: 0,
      End: last,
    };
    if (event.key === 'Enter') {
      this.open(id);
    } else if (event.key in next) {
      event.preventDefault();
      this.activeRow.set(next[event.key]);
      this.rows()[next[event.key]]?.nativeElement.focus();
    }
  }

  private updateFilters(patch: Partial<RequestFilters>, replaceUrl = false): void {
    this.activeRow.set(0);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: filtersToParams({ ...this.filters(), ...patch }),
      replaceUrl,
    });
  }
}
