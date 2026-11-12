import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { EnvironmentProviders, effect, inject, makeEnvironmentProviders, provideEnvironmentInitializer } from '@angular/core';
import { Router } from '@angular/router';
import { SessionStore } from '../session/session-store';
import { authInterceptor } from './auth.interceptor';
import { loginUrlTree } from './return-url';

/**
 * HTTP + auth wiring used by every app that runs on its own (the shell, and each remote in
 * standalone mode). Remotes loaded inside the shell inherit the shell's providers instead.
 */
export function provideAuth(): EnvironmentProviders {
  return makeEnvironmentProviders([
    provideHttpClient(withFetch(), withInterceptors([authInterceptor])),
    // When the token's lifetime runs out client-side, leave the protected page right away
    // instead of waiting for the next request to fail with 401.
    provideEnvironmentInitializer(() => {
      const session = inject(SessionStore);
      const router = inject(Router);
      effect(() => {
        if (session.endReason() === 'expired' && !router.url.startsWith('/login')) {
          void router.navigateByUrl(loginUrlTree(router));
        }
      });
    }),
  ]);
}
