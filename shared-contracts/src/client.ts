import { z } from 'zod';
import {
  AuthTokensSchema,
  ErrorEnvelopeSchema,
  GenerateRequestSchema,
  GenerateResponseSchema,
  PreferencesSchema,
  ProviderCatalogSchema,
  SessionListSchema,
  type Action,
  type ErrorCode,
  type GenerateRequestInput,
  type GenerateResponseOutput,
  type PreferencesOutput,
  type Provider,
  type ProviderCatalogOutput,
} from './schemas';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export interface ApiClientOptions {
  /** Scheme + host only, e.g. `https://api.example.com`. No trailing slash. */
  baseUrl: string;
  fetchImpl?: typeof fetch;
  /** Supplies the user's provider key per request. Never cache it here. */
  getProviderKey?: () => string | undefined | Promise<string | undefined>;
  /** Supplies a live access token, or null/undefined when signed out. */
  getAccessToken?: () => string | null | undefined | Promise<string | null | undefined>;
  /** Called after a 401 so the app can refresh and retry. */
  onUnauthorized?: (code: ErrorCode) => Promise<void> | void;
  requestTimeoutMs?: number;
  newRequestId?: () => string;
}

/** Normalized failure: every non-2xx response becomes exactly one of these. */
export class ApiRequestError extends Error {
  readonly status: number;
  readonly code: ErrorCode | 'UNPARSEABLE_RESPONSE' | 'NETWORK_ERROR' | 'TIMEOUT';
  readonly requestId?: string;
  readonly retryable: boolean;
  readonly retryAfterSeconds?: number;
  readonly details?: unknown;

  constructor(input: {
    status: number;
    code: ApiRequestError['code'];
    message: string;
    requestId?: string;
    retryable?: boolean;
    retryAfterSeconds?: number;
    details?: unknown;
  }) {
    super(input.message);
    this.name = 'ApiRequestError';
    this.status = input.status;
    this.code = input.code;
    this.requestId = input.requestId;
    this.retryable = input.retryable ?? false;
    this.retryAfterSeconds = input.retryAfterSeconds;
    this.details = input.details;
  }
}

export interface GenerateResponse extends GenerateResponseOutput {
  requestId: string;
}

let counter = 0;
const fallbackRequestId = (): string =>
  `client-${Date.now().toString(36)}-${(counter += 1).toString(36)}`;

interface RequestSpec<T> {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  path: string;
  body?: unknown;
  schema?: z.ZodType<T>;
  providerKey?: boolean;
  auth?: boolean;
  /** Statuses other than 2xx that still mean success (e.g. 204). */
  emptyStatuses?: number[];
  allowUnauthorized?: boolean;
}

export class ApiClient {
  private readonly options: Required<Pick<ApiClientOptions, 'requestTimeoutMs' | 'newRequestId'>> &
    ApiClientOptions;

  constructor(options: ApiClientOptions) {
    this.options = {
      ...options,
      baseUrl: options.baseUrl.replace(/\/+$/, ''),
      requestTimeoutMs: options.requestTimeoutMs ?? 35_000,
      newRequestId: options.newRequestId ?? fallbackRequestId,
    };
  }

  private async send<T>(spec: RequestSpec<T>): Promise<T> {
    const headers: Record<string, string> = { accept: 'application/json' };
    const requestId = this.options.newRequestId();
    headers['x-request-id'] = requestId;

    if (spec.body !== undefined) headers['content-type'] = 'application/json';

    if (spec.providerKey) {
      const key = await this.options.getProviderKey?.();
      if (!key) {
        throw new ApiRequestError({
          status: 0,
          code: 'UNAUTHENTICATED',
          message: 'No provider API key is configured for this request.',
          requestId,
        });
      }
      headers['x-provider-key'] = key;
    }

    if (spec.auth) {
      const token = await this.options.getAccessToken?.();
      if (token) headers['authorization'] = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.options.requestTimeoutMs);
    let response: Response;
    try {
      const fetchImpl = this.options.fetchImpl ?? fetch;
      response = await fetchImpl(`${this.options.baseUrl}${spec.path}`, {
        method: spec.method,
        headers,
        body: spec.body === undefined ? undefined : JSON.stringify(spec.body),
        signal: controller.signal,
      });
    } catch (err) {
      clearTimeout(timer);
      const aborted = controller.signal.aborted;
      throw new ApiRequestError({
        status: 0,
        code: aborted ? 'TIMEOUT' : 'NETWORK_ERROR',
        message: aborted
          ? 'The request timed out. Your draft was not lost.'
          : 'Cannot reach the AI Keyboard service. Check your connection.',
        requestId,
        retryable: true,
        details: err instanceof Error ? err.name : undefined,
      });
    }
    clearTimeout(timer);

    const retryAfter = response.headers.get('retry-after');
    const headerRequestId = response.headers.get('x-request-id') ?? requestId;

    if (spec.emptyStatuses?.includes(response.status)) {
      return undefined as T;
    }

    const payload: unknown = await response.json().catch(() => null);

    if (!response.ok) {
      const parsed = ErrorEnvelopeSchema.safeParse(payload);
      if (parsed.success && !spec.allowUnauthorized) {
        const code = parsed.data.error.code;
        if (response.status === 401) await this.options.onUnauthorized?.(code);
        throw new ApiRequestError({
          status: response.status,
          code,
          message: parsed.data.error.message,
          requestId: parsed.data.error.requestId ?? headerRequestId,
          retryable: parsed.data.error.retryable,
          retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
          details: parsed.data.error.details,
        });
      }
      if (response.status === 401 && !spec.allowUnauthorized) {
        await this.options.onUnauthorized?.('UNAUTHENTICATED');
      }
      throw new ApiRequestError({
        status: response.status,
        code: 'UNPARSEABLE_RESPONSE',
        message: `The service returned an unexpected response (${response.status}).`,
        requestId: headerRequestId,
        retryable: response.status >= 500,
        retryAfterSeconds: retryAfter ? Number(retryAfter) : undefined,
      });
    }

    if (!spec.schema) return payload as T;
    const parsed = spec.schema.safeParse(payload);
    if (!parsed.success) {
      throw new ApiRequestError({
        status: response.status,
        code: 'UNPARSEABLE_RESPONSE',
        message: 'The service response did not match the shared contract.',
        requestId: headerRequestId,
        details: parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`),
      });
    }
    return parsed.data as T;
  }

  // Health

  health(): Promise<{ status: string }> {
    return this.send({ method: 'GET', path: '/health' });
  }

  readiness(): Promise<{ status: string; dependencies: { database: boolean } }> {
    return this.send({ method: 'GET', path: '/v1/health/ready', allowUnauthorized: true });
  }

  // AI

  async generate(input: GenerateRequestInput): Promise<GenerateResponse> {
    const body = GenerateRequestSchema.parse(input);
    return this.send({
      method: 'POST',
      path: '/v1/ai/generate',
      body,
      schema: GenerateResponseSchema,
      providerKey: true,
      auth: true,
    }) as Promise<GenerateResponse>;
  }

  providers(): Promise<ProviderCatalogOutput> {
    return this.send({ method: 'GET', path: '/v1/ai/providers', schema: ProviderCatalogSchema });
  }

  testProvider(provider: Provider): Promise<{ valid: boolean; message?: string }> {
    return this.send({
      method: 'POST',
      path: '/v1/ai/providers/test',
      body: { provider },
      providerKey: true,
    });
  }

  usage(): Promise<{ enabled: boolean; events: unknown[] }> {
    return this.send({ method: 'GET', path: '/v1/ai/usage', auth: true });
  }

  // Account

  register(input: {
    email: string;
    password: string;
    device?: { platform: 'android' | 'ios'; name?: string };
  }): Promise<z.infer<typeof AuthTokensSchema>> {
    return this.send({
      method: 'POST',
      path: '/v1/auth/register',
      body: input,
      schema: AuthTokensSchema,
    });
  }

  login(input: {
    email: string;
    password: string;
    device?: { platform: 'android' | 'ios'; name?: string };
  }): Promise<z.infer<typeof AuthTokensSchema>> {
    return this.send({
      method: 'POST',
      path: '/v1/auth/login',
      body: input,
      schema: AuthTokensSchema,
    });
  }

  refresh(refreshToken: string): Promise<TokenPair & { accessTokenExpiresIn: number }> {
    return this.send({ method: 'POST', path: '/v1/auth/refresh', body: { refreshToken } });
  }

  logout(refreshToken: string): Promise<void> {
    return this.send({
      method: 'POST',
      path: '/v1/auth/logout',
      body: { refreshToken },
      auth: true,
      emptyStatuses: [204],
    });
  }

  me(): Promise<unknown> {
    return this.send({ method: 'GET', path: '/v1/users/me', auth: true });
  }

  /** Schedules deletion; the server purges after its grace window. */
  deleteAccount(): Promise<unknown> {
    return this.send({ method: 'DELETE', path: '/v1/users/me', auth: true, emptyStatuses: [202] });
  }

  sessions(): Promise<z.infer<typeof SessionListSchema>> {
    return this.send({
      method: 'GET',
      path: '/v1/users/me/sessions',
      auth: true,
      schema: SessionListSchema,
    });
  }

  revokeSession(id: string): Promise<void> {
    return this.send({
      method: 'DELETE',
      path: `/v1/users/me/sessions/${encodeURIComponent(id)}`,
      auth: true,
      emptyStatuses: [204],
    });
  }

  // Sync

  getPreferences(): Promise<PreferencesOutput> {
    return this.send({
      method: 'GET',
      path: '/v1/sync/preferences',
      auth: true,
      schema: PreferencesSchema,
    });
  }

  putPreferences(preferences: PreferencesOutput): Promise<PreferencesOutput> {
    return this.send({
      method: 'PUT',
      path: '/v1/sync/preferences',
      body: preferences,
      auth: true,
      schema: PreferencesSchema,
    });
  }
}

export type { Action, Provider };
