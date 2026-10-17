export type FetchLike = typeof fetch;

/**
 * Resolves a fetch implementation. Defaulting to a thin wrapper (rather than
 * capturing global fetch at module load) keeps adapters testable and lets
 * tests stub `globalThis.fetch`.
 */
export function resolveFetch(impl?: FetchLike): FetchLike {
  if (impl) return impl;
  return (input: Parameters<FetchLike>[0], init?: Parameters<FetchLike>[1]) =>
    globalThis.fetch(input, init);
}

/** Combines a client-disconnect signal with a provider timeout. */
export function withTimeout(signal: AbortSignal | undefined, ms: number): AbortSignal {
  const timeout = AbortSignal.timeout(ms);
  if (!signal) return timeout;
  return AbortSignal.any([signal, timeout]);
}
