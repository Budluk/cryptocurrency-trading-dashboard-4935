// Hybrid AI router: FreeLLMAPI -> Groq -> OpenAI -> Lovable AI Gateway (last-resort fallback).
// Per AGENTS.md: FreeLLMAPI first, then fallbacks. Circuit breaker + rate limiting per provider.
const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

type Provider = { name: string; url: string; key?: string; model: string };

// Circuit breaker state per provider
const circuitBreakers = new Map<string, { failures: number; lastFailure: number; open: boolean }>();
// Rate limiting: max requests per minute per provider
const rateLimits = new Map<string, number[]>();

const MAX_REQUESTS_PER_MINUTE = 30;
const CIRCUIT_FAILURE_THRESHOLD = 3;
const CIRCUIT_RESET_MS = 60_000;

function providers(): Provider[] {
  const list: Provider[] = [];
  
  // 1. FreeLLMAPI FIRST (per AGENTS.md)
  const free = Deno.env.get('FREELLMAPI_URL');
  if (free) {
    list.push({ 
      name: 'freellmapi', 
      url: `${free.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1/chat/completions`, 
      key: Deno.env.get('FREELLMAPI_KEY'), 
      model: Deno.env.get('FREELLMAPI_MODEL') || 'auto' 
    });
  }
  
  // 2. Groq (fast, free tier available)
  const groq = Deno.env.get('GROQ_API_KEY');
  if (groq) {
    list.push({ 
      name: 'groq', 
      url: 'https://api.groq.com/openai/v1/chat/completions', 
      key: groq, 
      model: Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile' 
    });
  }
  
  // 3. OpenAI
  const openai = Deno.env.get('OPENAI_API_KEY');
  if (openai) {
    list.push({ 
      name: 'openai', 
      url: 'https://api.openai.com/v1/chat/completions', 
      key: openai, 
      model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini' 
    });
  }
  
  return list;
}

function checkRateLimit(name: string): boolean {
  const now = Date.now();
  const windowStart = now - 60_000;
  const requests = rateLimits.get(name) || [];
  const recent = requests.filter(t => t > windowStart);
  if (recent.length >= MAX_REQUESTS_PER_MINUTE) return false;
  recent.push(now);
  rateLimits.set(name, recent);
  return true;
}

function checkCircuitBreaker(name: string): boolean {
  const cb = circuitBreakers.get(name);
  if (!cb || !cb.open) return true;
  if (Date.now() - cb.lastFailure > CIRCUIT_RESET_MS) {
    cb.open = false;
    cb.failures = 0;
    return true;
  }
  return false;
}

function recordFailure(name: string) {
  const cb = circuitBreakers.get(name) || { failures: 0, lastFailure: 0, open: false };
  cb.failures++;
  cb.lastFailure = Date.now();
  if (cb.failures >= CIRCUIT_FAILURE_THRESHOLD) cb.open = true;
  circuitBreakers.set(name, cb);
}

function recordSuccess(name: string) {
  const cb = circuitBreakers.get(name);
  if (cb) {
    cb.failures = 0;
    cb.open = false;
  }
}

export async function aiFetch(init: RequestInit): Promise<Response> {
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(String(init.body ?? '{}')); } catch { /* keep empty */ }
  
  const availableProviders = providers();
  
  if (availableProviders.length === 0) {
    console.log('[aiRouter] No providers configured, falling back to Lovable');
    return fetch(LOVABLE_URL, init);
  }

  for (const p of availableProviders) {
    // Skip if rate limited
    if (!checkRateLimit(p.name)) {
      console.warn(`[aiRouter] ${p.name} rate limited, skipping`);
      continue;
    }
    // Skip if circuit breaker open
    if (!checkCircuitBreaker(p.name)) {
      console.warn(`[aiRouter] ${p.name} circuit breaker open, skipping`);
      continue;
    }
    
    try {
      const { tools: _t, tool_choice: _c, ...rest } = body as Record<string, unknown>;
      const payload = p.name === 'freellmapi' ? { ...rest, model: p.model } : { ...body, model: p.model };
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(p.key ? { Authorization: `Bearer ${p.key}` } : {}) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      });
      
      if (res.ok) { 
        console.log(`[aiRouter] provider=${p.name}`);
        recordSuccess(p.name);
        return res; 
      }
      
      const errText = await res.text().catch(() => '');
      console.warn(`[aiRouter] ${p.name} failed`, res.status, errText);
      recordFailure(p.name);
    } catch (e) {
      console.warn(`[aiRouter] ${p.name} error`, (e as Error).message);
      recordFailure(p.name);
    }
  }
  
  console.log('[aiRouter] all providers exhausted, falling back to Lovable');
  return fetch(LOVABLE_URL, init);
}