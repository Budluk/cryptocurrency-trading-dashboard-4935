import { test, expect, beforeEach, afterEach } from 'bun:test';
import { checkRateLimit, getClientIdentifier, createRateLimitResponse, rateLimitHeaders } from './rateLimit.ts';

// Mock Request for testing
function createMockRequest(headers: Record<string, string> = {}): Request {
  const h = new Headers(headers);
  return new Request('https://example.com', { headers: h });
}

beforeEach(() => {
  // Clear any global state if needed
});

afterEach(() => {
  // Cleanup
});

test('checkRateLimit allows requests under limit', async () => {
  const identifier = 'test-user-1';
  const config = { maxRequests: 5, windowMs: 60_000 };
  
  for (let i = 0; i < 5; i++) {
    const result = await checkRateLimit(identifier, config);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(5 - i - 1);
  }
});

test('checkRateLimit blocks requests over limit', async () => {
  const identifier = 'test-user-2';
  const config = { maxRequests: 3, windowMs: 60_000 };
  
  await checkRateLimit(identifier, config);
  await checkRateLimit(identifier, config);
  await checkRateLimit(identifier, config);
  
  const result = await checkRateLimit(identifier, config);
  expect(result.allowed).toBe(false);
  expect(result.remaining).toBe(0);
});

test('checkRateLimit resets after window', async () => {
  const identifier = 'test-user-3';
  const config = { maxRequests: 2, windowMs: 100 }; // 100ms window
  
  await checkRateLimit(identifier, config);
  await checkRateLimit(identifier, config);
  
  let result = await checkRateLimit(identifier, config);
  expect(result.allowed).toBe(false);
  
  // Wait for window to expire
  await new Promise(resolve => setTimeout(resolve, 150));
  
  result = await checkRateLimit(identifier, config);
  expect(result.allowed).toBe(true);
  expect(result.remaining).toBe(1);
});

test('getClientIdentifier extracts user from Bearer token', () => {
  const req = createMockRequest({ 'authorization': 'Bearer abcdefghijklmnopqrstuvwxyz' });
  const id = getClientIdentifier(req);
  expect(id).toBe('user:abcdefghijklmnop');
});

test('getClientIdentifier extracts API key', () => {
  const req = createMockRequest({ 'x-api-key': 'my-api-key-12345' });
  const id = getClientIdentifier(req);
  expect(id).toBe('apikey:my-api-key-12345');
});

test('getClientIdentifier falls back to IP', () => {
  const req = createMockRequest({ 'x-forwarded-for': '192.168.1.1, 10.0.0.1' });
  const id = getClientIdentifier(req);
  expect(id).toBe('ip:192.168.1.1');
});

test('getClientIdentifier uses unknown for missing IP', () => {
  const req = createMockRequest({});
  const id = getClientIdentifier(req);
  expect(id).toBe('ip:unknown');
});

test('createRateLimitResponse returns 429 with correct headers', async () => {
  const result = await checkRateLimit('test-response', { maxRequests: 1, windowMs: 60_000 });
  await checkRateLimit('test-response', { maxRequests: 1, windowMs: 60_000 }); // Exceed
  
  const response = createRateLimitResponse(result, { 'Access-Control-Allow-Origin': '*' });
  
  expect(response.status).toBe(429);
  expect(response.headers.get('Content-Type')).toBe('application/json');
  expect(response.headers.get('X-RateLimit-Limit')).toBeDefined();
  expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');
  expect(response.headers.get('Retry-After')).toBeDefined();
});

test('rateLimitHeaders returns correct header values', () => {
  const mockResult = {
    allowed: true,
    remaining: 5,
    resetTime: Date.now() + 60_000,
    totalRequests: 5,
  };
  
  const headers = rateLimitHeaders(mockResult);
  
  expect(headers['X-RateLimit-Limit']).toBe('10');
  expect(headers['X-RateLimit-Remaining']).toBe('5');
  expect(headers['X-RateLimit-Reset']).toBeDefined();
  expect(headers['Retry-After']).toBe('0');
});

test('different identifiers have separate limits', async () => {
  const config = { maxRequests: 2, windowMs: 60_000 };
  
  await checkRateLimit('user-a', config);
  await checkRateLimit('user-a', config);
  
  const resultA = await checkRateLimit('user-a', config);
  const resultB = await checkRateLimit('user-b', config);
  
  expect(resultA.allowed).toBe(false);
  expect(resultB.allowed).toBe(true);
});

test('rate limit works with custom keyPrefix', async () => {
  const identifier = 'test-prefix';
  const config1 = { maxRequests: 1, windowMs: 60_000, keyPrefix: 'prefix1' };
  const config2 = { maxRequests: 1, windowMs: 60_000, keyPrefix: 'prefix2' };
  
  await checkRateLimit(identifier, config1);
  const result1 = await checkRateLimit(identifier, config1);
  expect(result1.allowed).toBe(false);
  
  const result2 = await checkRateLimit(identifier, config2);
  expect(result2.allowed).toBe(true); // Different prefix = separate bucket
});