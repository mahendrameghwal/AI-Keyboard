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

const BASE_URL = 'https://api.openai.com/v1';

interface OpenAIChatResponse {
  model?: string;
  choices?: Array<{ message?: { content?: string } }>;
  usage?: { prompt_tokens?: number; completion_tokens?: number };
}

export class OpenAIProvider implements AIProvider {
  readonly providerId = 'openai';
  readonly displayName = 'OpenAI';

  private readonly fetchImpl: FetchLike;

  constructor(fetchImpl?: FetchLike) {
    this.fetchImpl = resolveFetch(fetchImpl);
  }

  async generate(request: AIProviderRequest, apiKey: string): Promise<AIProviderResponse> {
    const body = {
      model: request.model,
      messages: [
        { role: 'system', content: request.systemPrompt },
        { role: 'user', content: request.userText },
      ],
      temperature: request.temperature,
      max_tokens: request.maxOutputTokens,
    };

    let res: Response;
    try {
      res = await this.fetchImpl(`${BASE_URL}/chat/completions`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
        signal: withTimeout(request.signal, env.PROVIDER_TIMEOUT_MS),
      });
    } catch (err) {
      throw mapAbortError(err, this.displayName);
    }

    if (!res.ok) throw mapProviderHttpError(res.status, this.displayName);

    const data = (await readJsonSafe(res)) as OpenAIChatResponse | undefined;
    const text = data?.choices?.[0]?.message?.content;
    if (typeof text !== 'string' || text.trim() === '') {
      throw new AppError(ErrorCode.EMPTY_RESPONSE, 'The AI provider returned an empty response.');
    }

    return {
      text: text.trim(),
      model: data?.model ?? request.model,
      inputTokens: data?.usage?.prompt_tokens,
      outputTokens: data?.usage?.completion_tokens,
    };
  }

  async validateCredentials(apiKey: string): Promise<CredentialValidation> {
    try {
      const res = await this.fetchImpl(`${BASE_URL}/models`, {
        headers: { authorization: `Bearer ${apiKey}` },
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
