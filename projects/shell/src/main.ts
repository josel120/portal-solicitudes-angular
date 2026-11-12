import { FederationManifest, NativeFederationResult, initFederation } from '@angular-architects/native-federation';

const MANIFEST_URL = 'federation.manifest.json';

/**
 * Remote URLs come from the manifest at runtime (one file per environment, no URLs in code).
 * If the manifest or a remote is unreachable the shell still boots: the affected sections show
 * an error state with retry instead of a blank page.
 */
async function start(): Promise<void> {
  let manifest: FederationManifest = {};
  let federation: NativeFederationResult | null = null;
  try {
    const response = await fetch(MANIFEST_URL);
    if (!response.ok) throw new Error(`Manifest HTTP ${response.status}`);
    manifest = (await response.json()) as FederationManifest;
    federation = await initFederation(manifest, { hostRemoteEntry: { url: './remoteEntry.json' } });
  } catch (error) {
    console.error('[shell] Federation init failed; remotes will be unavailable', error);
  }
  const { bootstrap } = await import('./bootstrap');
  await bootstrap({ manifest, federation });
}

start().catch((error: unknown) => console.error(error));
