import { supabase } from '@/integrations/supabase/client';

export interface BybitResponse<T = any> {
  success: boolean;
  data?: T;
  transient?: boolean;
  code?: string;
  error?: string;
  retryAfterMs?: number;
}

// Cooldown tracker: prevents hammering Bybit after transient failures
const cooldowns = new Map<string, number>();
const DEFAULT_COOLDOWN_MS = 15000;

function getCooldownKey(action: string): string {
  return action;
}

function isOnCooldown(action: string): boolean {
  const key = getCooldownKey(action);
  const until = cooldowns.get(key);
  if (!until) return false;
  if (Date.now() >= until) {
    cooldowns.delete(key);
    return false;
  }
  return true;
}

function setCooldown(action: string, ms: number): void {
  cooldowns.set(getCooldownKey(action), Date.now() + ms);
}

/**
 * Centralized Bybit edge function invocation with transient error handling.
 * - Never throws for transient upstream errors (HTML/403/429/5xx from Bybit).
 * - Returns typed response with `transient` flag.
 * - Applies local cooldown after transient failure to reduce API pressure.
 */
export async function invokeBybit<T = any>(
  action: string,
  params: Record<string, any> = {},
  options?: { isTestnet?: boolean; skipCooldown?: boolean }
): Promise<BybitResponse<T>> {
  const { isTestnet = false, skipCooldown = false } = options || {};

  // Respect cooldown for read actions
  if (!skipCooldown && isOnCooldown(action)) {
    return {
      success: false,
      transient: true,
      code: 'COOLDOWN_ACTIVE',
      error: 'Aguardando cooldown após falha transitória',
    };
  }

  try {
    const { data, error } = await supabase.functions.invoke('bybit-trading', {
      body: { action, isTestnet, params },
    });

    // Supabase SDK-level error (network, 500 from edge runtime itself)
    if (error) {
      console.warn(`[invokeBybit] SDK error for ${action}:`, error.message);
      setCooldown(action, DEFAULT_COOLDOWN_MS);
      return {
        success: false,
        transient: true,
        code: 'SDK_ERROR',
        error: error.message,
        retryAfterMs: DEFAULT_COOLDOWN_MS,
      };
    }

    // Transient upstream error (classified by edge function)
    if (data && !data.success && data.transient) {
      console.warn(`[invokeBybit] Transient: ${action} → ${data.code}: ${data.error}`);
      setCooldown(action, data.retryAfterMs || DEFAULT_COOLDOWN_MS);
      return data as BybitResponse<T>;
    }

    // Normal response (success or non-transient error)
    return data as BybitResponse<T>;
  } catch (err: any) {
    console.error(`[invokeBybit] Unexpected error for ${action}:`, err);
    setCooldown(action, DEFAULT_COOLDOWN_MS);
    return {
      success: false,
      transient: true,
      code: 'CLIENT_ERROR',
      error: err?.message || String(err),
      retryAfterMs: DEFAULT_COOLDOWN_MS,
    };
  }
}
