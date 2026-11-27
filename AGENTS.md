
- AI calls in edge functions go through supabase/functions/_shared/aiRouter.ts (FreeLLMAPI first, Lovable AI fallback) so providers can change in one place.

- Bybit signing: standard API credentials use server-side HMAC-SHA256 with BYBIT_API_SECRET and v2 signing headers; never auto-select stored RSA keys, because a mismatched key type breaks all authenticated calls. Keep the signing helper independently tested for GET and POST payloads.
- Research agent (strategy research chat) lives in supabase/functions/_shared/researchAgent.ts and is routed via action "research*" inside ai-market-analysis — the Supabase plan has no room for a new function, and it must never import Bybit/exchange code or keys.

- Keep the trading robot mounted across workspace tabs (forceMount with inactive panels hidden) so navigation does not interrupt its timers; use disclosure sections for secondary controls without changing their handlers.
