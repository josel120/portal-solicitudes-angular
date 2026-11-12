import { NativeFederationResult } from '@angular-architects/native-federation';
import { TestBed } from '@angular/core/testing';
import { Routes } from '@angular/router';
import { REMOTE_FEDERATION, RemoteRegistry, RemoteUnavailableError } from './remote-registry';

const ROUTES: Routes = [{ path: '' }];

function fakeFederation(loads: (() => Promise<unknown>)[]) {
  const loadRemoteModule = vi.fn(() => (loads.shift() ?? (() => Promise.reject(new Error('down'))))());
  const federation = { loadRemoteModule } as unknown as NativeFederationResult & {
    initRemoteEntry: ReturnType<typeof vi.fn>;
  };
  federation.initRemoteEntry = vi.fn(() => Promise.resolve(federation));
  return federation;
}

function setup(federation: NativeFederationResult | null): RemoteRegistry {
  TestBed.configureTestingModule({
    providers: [
      RemoteRegistry,
      {
        provide: REMOTE_FEDERATION,
        useValue: { manifest: { 'mfe-requests': 'http://localhost:4201/remoteEntry.json' }, federation },
      },
    ],
  });
  return TestBed.inject(RemoteRegistry);
}

describe('RemoteRegistry', () => {
  it('returns the routes the remote exposes as default export', async () => {
    const registry = setup(fakeFederation([() => Promise.resolve({ default: ROUTES })]));
    await expect(registry.loadRoutes('mfe-requests')).resolves.toBe(ROUTES);
  });

  it('re-registers the remote entry and retries when the first load fails (remote was down at boot)', async () => {
    const federation = fakeFederation([() => Promise.reject(new Error('down')), () => Promise.resolve({ default: ROUTES })]);
    const registry = setup(federation);

    await expect(registry.loadRoutes('mfe-requests')).resolves.toBe(ROUTES);
    expect(federation.initRemoteEntry).toHaveBeenCalledWith('http://localhost:4201/remoteEntry.json', 'mfe-requests');
  });

  it('throws RemoteUnavailableError when the remote is still down', async () => {
    const registry = setup(fakeFederation([]));
    await expect(registry.loadRoutes('mfe-requests')).rejects.toBeInstanceOf(RemoteUnavailableError);
  });

  it('throws RemoteUnavailableError for remotes missing from the manifest or when federation failed', async () => {
    await expect(setup(fakeFederation([])).loadRoutes('mfe-unknown')).rejects.toBeInstanceOf(RemoteUnavailableError);
    TestBed.resetTestingModule();
    await expect(setup(null).loadRoutes('mfe-requests')).rejects.toBeInstanceOf(RemoteUnavailableError);
  });
});
