import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { STATUS_LABELS } from '../models/labels';
import { RequestStatus } from '../models/request';

@Component({
  selector: 'ps-status-badge',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `<span class="ps-badge" [class]="'ps-badge ps-badge--' + status()">{{ label() }}</span>`,
})
export class StatusBadge {
  readonly status = input.required<RequestStatus>();
  protected readonly label = computed(() => STATUS_LABELS[this.status()]);
}
