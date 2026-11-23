
- AI calls in edge functions go through supabase/functions/_shared/aiRouter.ts (FreeLLMAPI first, Lovable AI fallback) so providers can change in one place.

- Bybit signing: bybit-trading uses the RSA private key stored server-side in bybit_rsa_keys (service role only) when present, else HMAC with BYBIT_API_SECRET; the private key is never returned to clients.
