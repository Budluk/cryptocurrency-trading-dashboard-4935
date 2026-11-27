import { test, expect, describe, beforeEach, afterEach, mock } from 'bun:test';

// --- Deno.env shim (edge functions run on Deno; tests run on Bun) -------------
const mockEnv: Record<string, string> = {
  FREELLMAPI_URL: 'https://freellmapi.test/v1',
  FREELLMAPI_KEY: 'free-key',
  GROQ_API_KEY: 'groq-key',
  OPENAI_API_KEY: 'openai-key',
  FREELLMAPI_MODEL: 'free-model',
  GROQ_MODEL: 'groq-model',
  OPENAI_MODEL: 'openai-model',
};

(globalThis as unknown as { Deno: unknown }).Deno = {
  env: {
    get: (key: string) => mockEnv[key],
  },
};

const {
  aiFetch,
  providers,
  checkRateLimit,
  checkCircuitBreaker,
  recordFailure,
  recordSuccess,
  __resetRouterState,
} = await import('./aiRouter.ts');

// --- fetch stub ---------------------------------------------------------------
const realFetch = globalThis.fetch;
let mockFetch: ReturnType<typeof mock>;

const okResponse = () => ({
  ok: true,
  status: 200,
  json: async () => ({ choices: [{ message: { content: 'test' } }] }),
});

const request = () =>
  aiFetch({
    method: 'POST',
    body: JSON.stringify({ messages: [{ role: 'user', content: 'hi' }] }),
  });

describe('aiRouter', () => {
  beforeEach(() => {
    __resetRouterState();
    mockFetch = mock();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = realFetch;
  });

  test('providers returns FreeLLMAPI first', () => {
    const [first] = providers();
    expect(first.name).toBe('freellmapi');
    expect(first.url).toContain('freellmapi.test');
  });

  test('providers includes Groq second', () => {
    const [, second] = providers();
    expect(second.name).toBe('groq');
    expect(second.url).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  test('providers includes OpenAI third', () => {
    const [, , third] = providers();
    expect(third.name).toBe('openai');
    expect(third.url).toBe('https://api.openai.com/v1/chat/completions');
  });

  test('aiFetch tries FreeLLMAPI first on success', async () => {
    mockFetch.mockResolvedValueOnce(okResponse());

    const response = await request();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(String(mockFetch.mock.calls[0][0])).toContain('freellmapi.test');
    expect(response.ok).toBe(true);
  });

  test('aiFetch falls back to Groq when FreeLLMAPI fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('FreeLLMAPI down'))
      .mockResolvedValueOnce(okResponse());

    const response = await request();

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(String(mockFetch.mock.calls[0][0])).toContain('freellmapi.test');
    expect(mockFetch.mock.calls[1][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
    expect(response.ok).toBe(true);
  });

  test('aiFetch falls back to OpenAI when Groq fails', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('FreeLLMAPI down'))
      .mockRejectedValueOnce(new Error('Groq down'))
      .mockResolvedValueOnce(okResponse());

    const response = await request();

    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[2][0]).toBe('https://api.openai.com/v1/chat/completions');
    expect(response.ok).toBe(true);
  });

  test('rate limiting prevents excess requests', () => {
    const providerName = 'freellmapi';

    for (let i = 0; i < 30; i++) {
      expect(checkRateLimit(providerName)).toBe(true);
    }

    expect(checkRateLimit(providerName)).toBe(false);
  });

  test('circuit breaker opens after 3 failures', () => {
    const providerName = 'test-provider';

    recordFailure(providerName);
    expect(checkCircuitBreaker(providerName)).toBe(true);

    recordFailure(providerName);
    expect(checkCircuitBreaker(providerName)).toBe(true);

    recordFailure(providerName);
    expect(checkCircuitBreaker(providerName)).toBe(false); // open
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
    for (let i = 0; i < 3; i++) recordFailure('freellmapi');
    mockFetch.mockResolvedValueOnce(okResponse());

    await request();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  test('skips provider when rate limited', async () => {
    for (let i = 0; i < 30; i++) checkRateLimit('freellmapi');
    mockFetch.mockResolvedValueOnce(okResponse());

    await request();

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toBe('https://api.groq.com/openai/v1/chat/completions');
  });

  test('falls back to Lovable when all providers fail', async () => {
    mockFetch
      .mockRejectedValueOnce(new Error('FreeLLMAPI down'))
      .mockRejectedValueOnce(new Error('Groq down'))
      .mockRejectedValueOnce(new Error('OpenAI down'))
      .mockResolvedValueOnce(okResponse());

    const response = await request();

    expect(mockFetch).toHaveBeenCalledTimes(4);
    expect(mockFetch.mock.calls[3][0]).toBe('https://ai.gateway.lovable.dev/v1/chat/completions');
    expect(response.ok).toBe(true);
  });
});
