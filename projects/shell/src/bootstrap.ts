import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { RemoteFederation } from './app/remotes/remote-registry';

export function bootstrap(remotes: RemoteFederation) {
  return bootstrapApplication(App, appConfig(remotes));
}
