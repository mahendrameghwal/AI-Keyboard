import 'express-serve-static-core';

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlation id, always present after the requestId middleware. */
    requestId: string;
    /** Request-scoped provider API key; never logged or persisted. */
    providerKey?: string;
    /** Authenticated principal, set by the `authenticate` middleware. */
    user?: { id: string; sessionId: string };
  }
}
