/*
 * Public API of @portal/shared. Remotes and the shell import only from here, never from deep paths.
 */

// Models
export * from './lib/models/user';
export * from './lib/models/request';
export * from './lib/models/api-error';
export * from './lib/models/labels';

// API client
export * from './lib/api/api-config';
export { parseAmount } from './lib/api/normalize';
export * from './lib/api/requests-api';
export * from './lib/api/catalog-api';
export * from './lib/api/auth-api';

// Session & auth
export * from './lib/session/session-store';
export * from './lib/auth/auth.interceptor';
export * from './lib/auth/auth.guards';
export * from './lib/auth/provide-auth';
export * from './lib/auth/return-url';

// Cross-remote contract
export * from './lib/events/request-events';

// Forms & UI
export * from './lib/forms/server-errors';
export * from './lib/ui/states';
export * from './lib/ui/status-badge';
export * from './lib/ui/field-error';
export * from './lib/ui/login-page';
