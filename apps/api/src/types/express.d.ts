import type { AuthenticatedUser, PreAuthTokenPayload } from './auth';

/**
 * Augment express-serve-static-core (the actual source of the Request interface
 * used by @types/express@5) to add custom properties attached by our middleware.
 */
declare module 'express-serve-static-core' {
  interface Request {
    /** Populated by requireAccessToken middleware */
    user?: AuthenticatedUser;
    /** Populated by requirePreAuthToken middleware */
    preAuth?: PreAuthTokenPayload;
  }
}

export {};
