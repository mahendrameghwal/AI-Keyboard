export type ActionType =
  | 'fix'
  | 'rewrite'
  | 'shorten'
  | 'expand'
  | 'summarize'
  | 'explain'
  | 'continue'
  | 'email'
  | 'reply';

export interface PromptSettings {
  tone?: string;
  toneStrength?: string;
  formality?: string;
  length?: string;
  language?: string;
}

export interface BuiltPrompt {
  systemPrompt: string;
  userText: string;
}

const ACTION_INSTRUCTION: Record<ActionType, string> = {
  fix: 'Correct spelling, grammar, punctuation, and sentence structure without changing the meaning.',
  rewrite: 'Rewrite the text while preserving its original meaning.',
  shorten: 'Shorten the text, preserving all essential information and removing filler.',
  expand: 'Expand the text into complete, natural sentences while preserving the user intent and inventing no new facts.',
  summarize: 'Summarize the text, preserving the main points and removing unnecessary detail.',
  explain: 'Explain the text in clear, simpler language while preserving its meaning.',
  continue: 'Continue the text by writing the next sentence or paragraph, matching its style and intent.',
  email: 'Compose a complete email from the user request. Return a JSON object with exactly the keys "subject" and "body" and nothing else.',
  reply: 'Write a reply to the supplied message, responding only to the information provided.',
};

const TONE_INSTRUCTION: Record<string, string> = {
  professional: 'Write in a professional style.',
  casual: 'Write in a casual style.',
  polite: 'Write in a polite style.',
  funny: 'Write in a light, humorous style.',
  friendly: 'Write in a friendly style.',
  romantic: 'Write in a romantic style.',
  confident: 'Write in a confident style.',
  empathetic: 'Write in an empathetic style.',
  neutral: 'Write in a neutral style.',
};

const TONE_STRENGTH_INSTRUCTION: Record<string, string> = {
  soft: 'Use a gentle, diplomatic tone.',
  balanced: 'Use a clear, balanced tone.',
  hard: 'Use a firm, direct tone. Do not be abusive or aggressive.',
};

const FORMALITY_INSTRUCTION: Record<string, string> = {
  formal: 'Use formal language.',
  neutral: 'Use neutral language.',
  informal: 'Use informal, everyday language.',
};

const LENGTH_INSTRUCTION: Record<string, string> = {
  very_short: 'Keep the result extremely brief (roughly one short sentence).',
  short: 'Keep the result brief (roughly one to two sentences).',
  normal: 'Use a normal length.',
  detailed: 'Provide a detailed response.',
  elaborate: 'Provide an elaborate, thorough response.',
};

const LENGTH_TOKEN_BUDGET: Record<string, number> = {
  very_short: 256,
  short: 512,
  normal: 1024,
  detailed: 2048,
  elaborate: 4096,
};

const BASE_SYSTEM_PROMPT = [
  'You are a precise writing assistant embedded in a mobile keyboard.',
  'Apply the requested operation to the user text.',
  'Return ONLY the resulting text — no explanations, labels, quotation marks around the whole answer, or markdown code fences.',
  'Preserve names, numbers, dates, and technical terms exactly.',
  'Never invent facts that are not present in the input.',
].join(' ');

export function resolveMaxOutputTokens(action: ActionType, length?: string): number {
  const base = LENGTH_TOKEN_BUDGET[length ?? 'normal'] ?? 1024;
  // Summaries and expansions can legitimately need more room.
  if (action === 'summarize' || action === 'expand') return Math.max(base, 1024);
  return base;
}

export function resolveTemperature(action: ActionType): number {
  // Deterministic for corrections, more creative for generative actions.
  if (action === 'fix' || action === 'summarize') return 0.2;
  if (action === 'rewrite' || action === 'shorten') return 0.4;
  return 0.7;
}

export function buildPrompt(
  action: ActionType,
  text: string,
  settings: PromptSettings = {},
  customInstructions: string[] = [],
): BuiltPrompt {
  const lines: string[] = [BASE_SYSTEM_PROMPT, ACTION_INSTRUCTION[action]];

  const modifiers: Array<string | undefined> = [
    settings.tone ? TONE_INSTRUCTION[settings.tone] : undefined,
    settings.toneStrength ? TONE_STRENGTH_INSTRUCTION[settings.toneStrength] : undefined,
    settings.formality ? FORMALITY_INSTRUCTION[settings.formality] : undefined,
    settings.length ? LENGTH_INSTRUCTION[settings.length] : undefined,
  ];
  for (const modifier of modifiers) {
    if (modifier) lines.push(modifier);
  }

  if (settings.language) {
    lines.push(`Write the result in the language identified by "${settings.language}".`);
  }

  // Custom instructions are user-controlled system content; they are sanitized
  // to a single line each and capped by the caller (SRS §13.6, §16.4).
  const cleaned = customInstructions
    .map((i) => i.replace(/\s+/g, ' ').trim())
    .filter((i) => i.length > 0);
  if (cleaned.length > 0) {
    lines.push('Additional user instructions:');
    for (const instruction of cleaned) lines.push(`- ${instruction}`);
  }

  return { systemPrompt: lines.join('\n'), userText: text };
}

export interface ParsedEmail {
  subject: string;
  body: string;
}

/** Best-effort parse of an `email` action result into subject/body. */
export function parseEmailResult(text: string): ParsedEmail | undefined {
  const cleaned = text
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/, '')
    .trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return undefined;

  try {
    const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
    const subject = typeof obj.subject === 'string' ? obj.subject.trim() : '';
    const body = typeof obj.body === 'string' ? obj.body.trim() : '';
    if (!subject && !body) return undefined;
    return { subject, body };
  } catch {
    return undefined;
  }
}
