/**
 * Common AI provider interface (SRS §12.1).
 *
 * The API key is passed per-call rather than stored on the adapter so that
 * credentials are strictly request-scoped and never retained (SRS §16.1).
 */
export interface AIProviderRequest {
  model: string;
  systemPrompt: string;
  userText: string;
  temperature?: number;
  maxOutputTokens?: number;
  /** Combined client-disconnect + provider-timeout signal. */
  signal?: AbortSignal;
}

export interface AIProviderResponse {
  text: string;
  model: string;
  inputTokens?: number;
  outputTokens?: number;
}

export interface CredentialValidation {
  valid: boolean;
  message?: string;
}

export interface AIProvider {
  readonly providerId: string;
  readonly displayName: string;

  generate(request: AIProviderRequest, apiKey: string): Promise<AIProviderResponse>;

  validateCredentials(apiKey: string): Promise<CredentialValidation>;
}
