import { describe, it, expect } from 'vitest';
import {
  buildPrompt,
  parseEmailResult,
  resolveMaxOutputTokens,
  resolveTemperature,
} from '../../src/prompts';

describe('buildPrompt', () => {
  it('includes the action instruction and base rules', () => {
    const { systemPrompt, userText } = buildPrompt('rewrite', 'hello');
    expect(systemPrompt).toContain('Rewrite the text');
    expect(systemPrompt).toContain('Return ONLY the resulting text');
    expect(userText).toBe('hello');
  });

  it('applies tone, strength, formality and length', () => {
    const { systemPrompt } = buildPrompt('rewrite', 'x', {
      tone: 'professional',
      toneStrength: 'soft',
      formality: 'formal',
      length: 'short',
    });
    expect(systemPrompt).toContain('professional style');
    expect(systemPrompt).toContain('gentle, diplomatic');
    expect(systemPrompt).toContain('formal language');
    expect(systemPrompt).toContain('brief');
  });

  it('sanitizes and includes custom instructions', () => {
    const { systemPrompt } = buildPrompt('rewrite', 'x', {}, [
      '  Use   simple\n English ',
      '',
      'Avoid emojis',
    ]);
    expect(systemPrompt).toContain('- Use simple English');
    expect(systemPrompt).toContain('- Avoid emojis');
    expect(systemPrompt).not.toContain('\n\n-');
  });

  it('marks email action to return JSON', () => {
    const { systemPrompt } = buildPrompt('email', 'ask for leave');
    expect(systemPrompt).toContain('"subject"');
    expect(systemPrompt).toContain('"body"');
  });
});

describe('token and temperature resolution', () => {
  it('scales max output tokens with length', () => {
    expect(resolveMaxOutputTokens('rewrite', 'very_short')).toBeLessThan(
      resolveMaxOutputTokens('rewrite', 'elaborate'),
    );
    expect(resolveMaxOutputTokens('summarize', 'short')).toBeGreaterThanOrEqual(1024);
  });

  it('uses low temperature for corrections and higher for generative actions', () => {
    expect(resolveTemperature('fix')).toBeLessThan(resolveTemperature('reply'));
  });
});

describe('parseEmailResult', () => {
  it('parses plain JSON', () => {
    expect(parseEmailResult('{"subject":"Hi","body":"Hello"}')).toEqual({
      subject: 'Hi',
      body: 'Hello',
    });
  });

  it('parses JSON wrapped in a code fence', () => {
    expect(parseEmailResult('```json\n{"subject":"Hi","body":"Hello"}\n```')).toEqual({
      subject: 'Hi',
      body: 'Hello',
    });
  });

  it('returns undefined for non-JSON', () => {
    expect(parseEmailResult('just text')).toBeUndefined();
  });
});
