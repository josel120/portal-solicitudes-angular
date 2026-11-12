import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter, withComponentInputBinding, withNavigationErrorHandler } from '@angular/router';
import { provideAuth } from '@portal/shared';
import { handleNavigationError, routes } from './app.routes';
import { REMOTE_FEDERATION, RemoteFederation, RemoteRegistry } from './remotes/remote-registry';

/** Zoneless is the default since Angular 21 (no zone.js in polyfills), so no provider is needed. */
export function appConfig(remotes: RemoteFederation): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      provideRouter(routes, withComponentInputBinding(), withNavigationErrorHandler(handleNavigationError)),
      provideAuth(),
      { provide: REMOTE_FEDERATION, useValue: remotes },
      RemoteRegistry,
    ],
  };
}
