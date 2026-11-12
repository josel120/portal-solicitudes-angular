import { Injectable, signal } from '@angular/core';
import { InternalRequest } from '../models/request';

export type RequestChange =
  | { readonly kind: 'created'; readonly request: InternalRequest }
  | { readonly kind: 'decided'; readonly request: InternalRequest }
  /** Someone else changed the request first; `request` is the server's current state. */
  | { readonly kind: 'conflict'; readonly request: InternalRequest };

/**
 * Typed communication contract between remotes. It lives in the shared singleton library, so
 * mfe-approvals publishes and mfe-requests reacts without importing each other.
 */
@Injectable({ providedIn: 'root' })
export class RequestEvents {
  private readonly lastChange = signal<RequestChange | null>(null);
  private readonly revisionCounter = signal(0);

  /** Most recent change, for consumers that need the payload (e.g. announcements). */
  readonly last = this.lastChange.asReadonly();
  /** Increments on every change; read it inside resource params to refetch. */
  readonly revision = this.revisionCounter.asReadonly();

  publish(change: RequestChange): void {
    this.lastChange.set(change);
    this.revisionCounter.update((value) => value + 1);
  }
}
