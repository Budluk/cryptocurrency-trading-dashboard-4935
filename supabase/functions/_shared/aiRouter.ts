// Hybrid AI router: tries FreeLLMAPI first (OpenAI-compatible), falls back to Lovable AI Gateway.
const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

export async function aiFetch(init: RequestInit): Promise<Response> {
  const base = Deno.env.get('FREELLMAPI_URL');
  const key = Deno.env.get('FREELLMAPI_KEY');
  if (base) {
    try {
      const body = JSON.parse(String(init.body ?? '{}'));
      body.model = Deno.env.get('FREELLMAPI_MODEL') || 'auto';
      const res = await fetch(`${base.replace(/\/+$/, '')}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(key ? { Authorization: `Bearer ${key}` } : {}) },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) {
        console.log('[aiRouter] provider=freellmapi');
        return res;
      }
      console.warn('[aiRouter] freellmapi failed', res.status, '-> fallback lovable');
    } catch (e) {
      console.warn('[aiRouter] freellmapi error -> fallback lovable', (e as Error).message);
    }
  }
  console.log('[aiRouter] provider=lovable');
  return fetch(LOVABLE_URL, init);
}
