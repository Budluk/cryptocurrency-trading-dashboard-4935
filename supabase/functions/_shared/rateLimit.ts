// Rate limiting middleware for Deno edge functions
// Uses Deno.Kv (built-in, no external deps)

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
  totalRequests: number;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 30,
  windowMs: 60_000, // 1 minute
  keyPrefix: 'ratelimit',
};

// In-memory fallback for environments without KV
const memoryStore = new Map<string, number[]>();

export async function checkRateLimit(
  identifier: string,
  config: Partial<RateLimitConfig> = {},
  kv?: Deno.Kv
): Promise<RateLimitResult> {
  const { maxRequests, windowMs, keyPrefix } = { ...DEFAULT_CONFIG, ...config };
  const key = `${keyPrefix}:${identifier}`;
  const now = Date.now();
  const windowStart = now - windowMs;

  let requests: number[];

  if (kv) {
    // Use Deno.Kv (persistent, works across instances)
    const entry = await kv.get<number[]>([key]);
    requests = entry.value?.filter(t => t > windowStart) || [];
    requests.push(now);
    await kv.set([key], requests);
  } else {
    // Fallback to in-memory (per-instance only)
    requests = (memoryStore.get(key) || []).filter(t => t > windowStart);
    requests.push(now);
    memoryStore.set(key, requests);
  }

  const remaining = Math.max(0, maxRequests - requests.length);
  const resetTime = requests.length > 0 ? requests[0] + windowMs : now + windowMs;

  return {
    allowed: requests.length <= maxRequests,
    remaining,
    resetTime,
    totalRequests: requests.length,
  };
}

export function rateLimitHeaders(result: RateLimitResult): HeadersInit {
  return {
    'X-RateLimit-Limit': String(result.totalRequests + result.remaining),
    'X-RateLimit-Remaining': String(result.remaining),
    'X-RateLimit-Reset': String(Math.ceil(result.resetTime / 1000)),
    'Retry-After': result.allowed ? '0' : String(Math.ceil((result.resetTime - Date.now()) / 1000)),
  };
}

export function createRateLimitResponse(result: RateLimitResult, corsHeaders: HeadersInit = {}): Response {
  return new Response(
    JSON.stringify({
      error: 'Rate limit exceeded',
      retryAfter: Math.ceil((result.resetTime - Date.now()) / 1000),
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        ...rateLimitHeaders(result),
        ...corsHeaders,
      },
    }
  );
}

// Helper to extract client identifier from request
export function getClientIdentifier(req: Request): string {
  // Priority: authenticated user > API key > IP
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    return `user:${authHeader.slice(7).slice(0, 16)}`; // Truncated token
  }
  
  const apiKey = req.headers.get('x-api-key');
  if (apiKey) {
    return `apikey:${apiKey.slice(0, 16)}`;
  }

  // Fallback to IP (behind proxy, use x-forwarded-for)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0]?.trim() || 'unknown';
  return `ip:${ip}`;
}