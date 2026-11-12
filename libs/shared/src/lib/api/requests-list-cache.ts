import { InternalRequest, Page } from '../models/request';

interface Entry {
  readonly page: Page<InternalRequest>;
  readonly storedAt: number;
}

/** In-memory TTL cache for list pages, keyed by the serialized query string. */
export class RequestsListCache {
  private readonly entries = new Map<string, Entry>();

  constructor(
    private readonly ttlMs: number,
    private readonly now: () => number = Date.now,
  ) {}

  get(key: string): Page<InternalRequest> | null {
    const entry = this.entries.get(key);
    if (!entry) return null;
    if (this.now() - entry.storedAt > this.ttlMs) {
      this.entries.delete(key);
      return null;
    }
    return entry.page;
  }

  set(key: string, page: Page<InternalRequest>): void {
    this.entries.set(key, { page, storedAt: this.now() });
  }

  clear(): void {
    this.entries.clear();
  }
}
