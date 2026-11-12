import { FederationManifest, NativeFederationResult } from '@angular-architects/native-federation';
import { Injectable, InjectionToken, inject } from '@angular/core';
import { Routes } from '@angular/router';

export interface RemoteFederation {
  readonly manifest: FederationManifest;
  /** `null` when federation could not be initialized at all. */
  readonly federation: NativeFederationResult | null;
}

export const REMOTE_FEDERATION = new InjectionToken<RemoteFederation>('REMOTE_FEDERATION');

/** Contract every remote honours: it exposes `./routes` with its route table as default export. */
export const REMOTE_ROUTES_MODULE = './routes';
interface RemoteRoutesModule {
  readonly default: Routes;
}

export class RemoteUnavailableError extends Error {
  constructor(
    readonly remoteName: string,
    options?: { cause?: unknown },
  ) {
    super(`Remote "${remoteName}" is not available`, options);
    this.name = 'RemoteUnavailableError';
  }
}

function isRoutesModule(value: unknown): value is RemoteRoutesModule {
  return typeof value === 'object' && value !== null && 'default' in value && Array.isArray(value.default);
}

@Injectable()
export class RemoteRegistry {
  private readonly manifest = inject(REMOTE_FEDERATION).manifest;
  private federation = inject(REMOTE_FEDERATION).federation;

  async loadRoutes(remoteName: string): Promise<Routes> {
    const descriptor = this.manifest[remoteName];
    const remoteEntry = typeof descriptor === 'string' ? descriptor : descriptor?.url;
    if (!remoteEntry || !this.federation) throw new RemoteUnavailableError(remoteName);
    try {
      return await this.load(remoteName);
    } catch {
      // The remote may have been down when the shell booted (so it was never registered) and be
      // up now: register its entry again before giving up.
      try {
        this.federation = await this.federation.initRemoteEntry(remoteEntry, remoteName);
        return await this.load(remoteName);
      } catch (cause) {
        throw new RemoteUnavailableError(remoteName, { cause });
      }
    }
  }

  private async load(remoteName: string): Promise<Routes> {
    if (!this.federation) throw new RemoteUnavailableError(remoteName);
    const module: unknown = await this.federation.loadRemoteModule(remoteName, REMOTE_ROUTES_MODULE);
    if (!isRoutesModule(module)) throw new RemoteUnavailableError(remoteName);
    return module.default;
  }
}

/** `loadChildren` factory; runs in the route's injection context. */
export function loadRemoteRoutes(remoteName: string): () => Promise<Routes> {
  return () => inject(RemoteRegistry).loadRoutes(remoteName);
}
