// Hybrid AI router: Groq -> OpenAI -> FreeLLMAPI -> Lovable AI Gateway (last-resort fallback).
const LOVABLE_URL = 'https://ai.gateway.lovable.dev/v1/chat/completions';

type Provider = { name: string; url: string; key?: string; model: string };

function providers(): Provider[] {
  const list: Provider[] = [];
  const groq = Deno.env.get('GROQ_API_KEY');
  if (groq) list.push({ name: 'groq', url: 'https://api.groq.com/openai/v1/chat/completions', key: groq, model: Deno.env.get('GROQ_MODEL') || 'llama-3.3-70b-versatile' });
  const openai = Deno.env.get('OPENAI_API_KEY');
  if (openai) list.push({ name: 'openai', url: 'https://api.openai.com/v1/chat/completions', key: openai, model: Deno.env.get('OPENAI_MODEL') || 'gpt-4o-mini' });
  const free = Deno.env.get('FREELLMAPI_URL');
  if (free) list.push({ name: 'freellmapi', url: `${free.replace(/\/+$/, '').replace(/\/v1$/, '')}/v1/chat/completions`, key: Deno.env.get('FREELLMAPI_KEY'), model: Deno.env.get('FREELLMAPI_MODEL') || 'auto' });
  return list;
}

export async function aiFetch(init: RequestInit): Promise<Response> {
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(String(init.body ?? '{}')); } catch { /* keep empty */ }
  for (const p of providers()) {
    try {
      const { tools: _t, tool_choice: _c, ...rest } = body as Record<string, unknown>;
      const payload = p.name === 'freellmapi' ? { ...rest, model: p.model } : { ...body, model: p.model };
      const res = await fetch(p.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(p.key ? { Authorization: `Bearer ${p.key}` } : {}) },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(45000),
      });
      if (res.ok) { console.log(`[aiRouter] provider=${p.name}`); return res; }
      console.warn(`[aiRouter] ${p.name} failed`, res.status, await res.text().catch(() => ''));
    } catch (e) {
      console.warn(`[aiRouter] ${p.name} error`, (e as Error).message);
    }
  }
  console.log('[aiRouter] provider=lovable');
  return fetch(LOVABLE_URL, init);
}
