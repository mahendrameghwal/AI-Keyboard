import type { Request, Response } from 'express';
import {
  buildPrompt,
  parseEmailResult,
  resolveMaxOutputTokens,
  resolveTemperature,
  type ActionType,
} from '../prompts';
import { providerRegistry } from '../services/ai/ProviderRegistry';
import { findModel, isProviderEnabled } from '../services/ai/modelCatalog';
import { AppError } from '../errors/AppError';
import { ErrorCode } from '../errors/codes';
import { env } from '../config/env';
import { GenerateRequestSchema, ProviderTestSchema } from '../validators/ai.validators';

interface GeneratedPayload {
  requestId: string;
  success: true;
  provider: string;
  model: string;
  result?: string;
  email?: { subject: string; body: string };
  usage?: { inputTokens?: number; outputTokens?: number };
}

export async function generate(req: Request, res: Response): Promise<void> {
  const body = GenerateRequestSchema.parse(req.body);

  // Streaming is not part of the MVP (plan D8).
  if (body.options?.stream === true) {
    throw new AppError(
      ErrorCode.STREAM_NOT_SUPPORTED,
      'Streaming responses are not supported.',
    );
  }

  const provider = providerRegistry.get(body.provider);
  if (!provider) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Unknown provider "${body.provider}".`);
  }
  if (!isProviderEnabled(body.provider)) {
    throw new AppError(
      ErrorCode.PROVIDER_UNAVAILABLE,
      `${provider.displayName} is temporarily disabled. Try another provider.`,
    );
  }

  const modelInfo = findModel(body.provider, body.model);
  if (!modelInfo) {
    throw new AppError(
      ErrorCode.UNSUPPORTED_MODEL,
      `The model "${body.model}" is not available for ${provider.displayName}.`,
    );
  }
  if (modelInfo.status === 'deprecated') {
    throw new AppError(
      ErrorCode.MODEL_DEPRECATED,
      `The model "${body.model}" is no longer available for ${provider.displayName}.`,
    );
  }

  const { systemPrompt, userText } = buildPrompt(
    body.action as ActionType,
    body.text,
    body.settings ?? {},
    body.customInstructions ?? [],
  );

  // Abort the upstream request if the client disconnects (SRS §12.2).
  const controller = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) controller.abort();
  });

  const result = await provider.generate(
    {
      model: body.model,
      systemPrompt,
      userText,
      temperature: resolveTemperature(body.action as ActionType),
      maxOutputTokens: resolveMaxOutputTokens(body.action as ActionType, body.settings?.length),
      signal: controller.signal,
    },
    req.providerKey as string,
  );

  const payload: GeneratedPayload = {
    requestId: req.requestId,
    success: true,
    provider: body.provider,
    model: result.model,
  };

  if (body.action === 'email') {
    const parsed = parseEmailResult(result.text);
    if (parsed) payload.email = parsed;
    else payload.result = result.text;
  } else {
    payload.result = result.text;
  }

  if (result.inputTokens !== undefined || result.outputTokens !== undefined) {
    payload.usage = { inputTokens: result.inputTokens, outputTokens: result.outputTokens };
  }

  res.status(200).json(payload);
}

export function listProviders(_req: Request, res: Response): void {
  res.status(200).json({ providers: providerRegistry.catalog() });
}

export async function testProvider(req: Request, res: Response): Promise<void> {
  const body = ProviderTestSchema.parse(req.body);
  const provider = providerRegistry.get(body.provider);
  if (!provider) {
    throw new AppError(ErrorCode.VALIDATION_ERROR, `Unknown provider "${body.provider}".`);
  }
  if (!isProviderEnabled(body.provider)) {
    throw new AppError(
      ErrorCode.PROVIDER_UNAVAILABLE,
      `${provider.displayName} is temporarily disabled.`,
    );
  }
  const result = await provider.validateCredentials(req.providerKey as string);
  res.status(200).json(result);
}

export function usage(_req: Request, res: Response): void {
  // Usage tracking is disabled by default in the MVP (plan D11).
  res.status(200).json({ enabled: env.USAGE_TRACKING_ENABLED, events: [] });
}
