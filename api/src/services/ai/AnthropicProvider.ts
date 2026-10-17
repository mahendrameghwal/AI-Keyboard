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

const BASE_URL = 'https://api.anthropic.com/v1';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicResponse {
  model?: string;
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

export class AnthropicProvider implements AIProvider {
  readonly providerId = 'anthropic';
  readonly displayName = 'Anthropic';

  private readonly fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    this.fetchImpl = resolveFetch(fetchImpl);
  }

  async generate(request: AIProviderRequest, apiKey: string): Promise<AIProviderResponse> {
    const body = {
      model: request.model,
      system: request.systemPrompt,
      messages: [{ role: 'user', content: request.userText }],
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens,
    };

    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE_URL}/messages`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        body: JSON.stringify(body),
        signal: withTimeout(request.signal, env.PROVIDER_TIMEOUT_MS),
      });
    } catch (err) {
      throw mapAbortError(err, this.displayName);
    }

    if (!res.ok) throw mapProviderHttpError(res.status, this.displayName);

    const data = (await readJsonSafe(res)) as AnthropicResponse | undefined;
    const text = (data?.content ?? [])
      .filter((block) => block.type === 'text')
      .map((block) => block.text ?? '')
      .join('');
    if (text.trim() === '') {
      throw new AppError(ErrorCode.EMPTY_RESPONSE, 'The AI provider returned an empty response.');
    }

    return {
      text: text.trim(),
      model: data?.model ?? request.model,
      inputTokens: data?.usage?.input_tokens,
      outputTokens: data?.usage?.output_tokens,
    };
  }

  async validateCredentials(apiKey: string): Promise<CredentialValidation> {
    try {
      const res = await this.fetchImpl(`${BASE_URL}/models`, {
        headers: { 'x-api-key': apiKey, 'anthropic-version': ANTHROPIC_VERSION },
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
