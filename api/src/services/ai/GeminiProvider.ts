import type {
  AIProvider,
  AIProviderRequest,
  AIProviderResponse,
  CredentialValidation,
} from './AIProvider';
import { AppError } from '../../errors/AppError';
import { ErrorCode } from '../../errors/codes';
import { env } from '../../config/env';
import { mapAbortError, mapProviderHttpError, readJsonSafe } from './providerErrors';
import { resolveFetch, withTimeout, type FetchLike } from './http';

const BASE_URL = 'https://generativelanguage.googleapis.com/v1beta';

interface GeminiResponse {
  candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  usageMetadata?: { promptTokenCount?: number; candidatesTokenCount?: number };
}

/**
 * Google Gemini adapter.
 *
 * IMPORTANT: the API key is sent via the `x-goog-api-key` header — never as a
 * `?key=` query parameter, which would put the credential in URLs/logs
 * (SRS §16.1).
 */
export class GeminiProvider implements AIProvider {
  readonly providerId = 'gemini';
  readonly displayName = 'Google Gemini';

  private readonly fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    this.fetchImpl = resolveFetch(fetchImpl);
  }

  async generate(request: AIProviderRequest, apiKey: string): Promise<AIProviderResponse> {
    const body = {
      systemInstruction: { parts: [{ text: request.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: request.userText }] }],
      generationConfig: {
        temperature: request.temperature,
        maxOutputTokens: request.maxOutputTokens,
      },
    };

    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE_URL}/models/${encodeURIComponent(request.model)}:generateContent`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        body: JSON.stringify(body),
        signal: withTimeout(request.signal, env.PROVIDER_TIMEOUT_MS),
      });
    } catch (err) {
      throw mapAbortError(err, this.displayName);
    }

    if (!res.ok) throw mapProviderHttpError(res.status, this.displayName);

    const data = (await readJsonSafe(res)) as GeminiResponse | undefined;
    const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text ?? '').join('') ?? '';
    if (text.trim() === '') {
      throw new AppError(ErrorCode.EMPTY_RESPONSE, 'The AI provider returned an empty response.');
    }

    return {
      text: text.trim(),
      model: request.model,
      inputTokens: data?.usageMetadata?.promptTokenCount,
      outputTokens: data?.usageMetadata?.candidatesTokenCount,
    };
  }

  async validateCredentials(apiKey: string): Promise<CredentialValidation> {
    try {
      const res = await this.fetchImpl(`${BASE_URL}/models`, {
        headers: { 'x-goog-api-key': apiKey },
        signal: withTimeout(undefined, env.PROVIDER_TIMEOUT_MS),
      });
      if (res.status === 401 || res.status === 403) {
        return { valid: false, message: 'The API key was rejected.' };
      }
      if (!res.ok) return { valid: false, message: 'Could not verify the API key.' };
      return { valid: true };
    } catch {
      return { valid: false, message: 'Could not reach the provider.' };
    }
  }
}
