import { test, expect, vi, beforeEach, afterEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

// Mock Deno.env
const mockEnv = {
  FREELLMAPI_URL: 'https://freellmapi.test/v1',
  FREELLMAPI_KEY: 'free-key',
  GROQ_API_KEY: 'groq-key',
  OPENAI_API_KEY: 'openai-key',
  FREELLMAPI_MODEL: 'free-model',
  GROQ_MODEL: 'groq-model',
  OPENAI_MODEL: 'openai-model',
};

vi.stubGlobal('Deno', {
  env: {
    get: (key: string) => mockEnv[key],
  },
});

import { aiFetch, providers, checkRateLimit, checkCircuitBreaker, recordFailure, recordSuccess } from './aiRouter.ts';

describe('aiRouter', () => {
  beforeEach(() => {
    mockFetch.mockReset();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  test('providers returns FreeLLMAPI first', () => {
    const providerList = providers();
    expect(providerList[0].name).toBe('freellmapi');
    expect(providerList[0].url).toContain('freellmapi.test');
  });

  test('providers includes Groq second', () => {
    const providerList = providers();
    expect(providerList[1].name).toBe('groq');
    expect(providerList[1].url).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  test('providers includes OpenAI third', () => {
    const providerList = providers();
    expect(providerList[2].name).toBe('openai');
    expect(providerList[2].url).toBe('https://api.openai.com/v1/chat/completions');
  });

  test('aiFetch tries FreeLLMAPI first on success', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'test' } }] }),
    });

    const response = await aiFetch({
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const call = mockFetch.mock.calls[0];
    expect(call[0]).toContain('freellmapi.test');
    expect(response.ok).toBe(true);
  });

  test('aiFetch falls back to Groq when FreeLLMAPI fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('FreeLLMAPI down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'test' } }] }),
      });

    const response = await aiFetch({
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toContain('freellmapi.test');
    expect(mockFetch.mock.calls[1][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(response.ok).toBe(true);
  });

  test('aiFetch falls back to OpenAI when Groq fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('FreeLLMAPI down'))
      .mockRejectedValueOnce(new Error('Groq down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'test' } }] }),
      });

    const response = await aiFetch({
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[2][0]).toBe('https://api.openai.com/v1/chat/completions');
    expect(response.ok).toBe(true);
  });

  test('rate limiting prevents excess requests', async () => {
    const providerName = 'freellmapi';
    
    // Make 30 requests (limit)
    for (let i = 0; i < 30; i++) {
      const allowed = checkRateLimit(providerName);
      expect(allowed).toBe(true);
    }
    
    // 31st should be blocked
    const blocked = checkRateLimit(providerName);
    expect(blocked).toBe(false);
  });

  test('circuit breaker opens after 3 failures', () => {
    const providerName = 'test-provider';
    
    recordFailure(providerName);
    expect(checkCircuitBreaker(providerName)).toBe(true);
    
    recordFailure(providerName);
    expect(checkCircuitBreaker(providerName)).toBe(true);
    
    recordFailure(providerName);
    expect(checkCircuitBreaker(providerName)).toBe(false); // Open
  });

  test('circuit breaker closes on success', () => {
    const providerName = 'test-provider-2';
    
    recordFailure(providerName);
    recordFailure(providerName);
    recordFailure(providerName);
    expect(checkCircuitBreaker(providerName)).toBe(false);
    
    recordSuccess(providerName);
    expect(checkCircuitBreaker(providerName)).toBe(true);
  });

  test('skips provider when circuit breaker open', async () => {
    const providerName = 'freellmapi';
    
    // Open circuit breaker
    recordFailure(providerName);
    recordFailure(providerName);
    recordFailure(providerName);
    
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ choices: [{ message: { content: 'test' } }] }),
    });

    const response = await aiFetch({
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    // Should skip FreeLLMAPI (circuit open) and go to Groq
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  test('skips provider when rate limited', async () => {
    const providerName = 'freellmapi';
    
    // Exhaust rate limit
    for (let i = 0; i < 30; i++) {
      checkRateLimit(providerName);
    }
    
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'test' } }] }),
      });

    const response = await aiFetch({
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    // Should skip FreeLLMAPI (rate limited) and go to Groq
    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  test('falls back to Lovable when all providers fail', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('FreeLLMAPI down'))
      .mockRejectedValueOnce(new Error('Groq down'))
      .mockRejectedValueOnce(new Error('OpenAI down'))
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ choices: [{ message: { content: 'lovable response' } }] }),
      });

    const response = await aiFetch({
      method: 'POST',
      body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
    });

    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(mockFetch.mock.calls[3][0]).toBe('https://ai.gateway.lovable.dev/v1/chat/completions');
    expect(response.ok).toBe(true);
  });
});