import { supabase } from '@/integrations/supabase/client';

export interface ExchangeResponse<T = Record<string, unknown>> {
  ok: boolean;
  data?: T;
  error?: string;
}

/**
 * Chamada centralizada ao roteador multi-exchange hospedado em bybit-trading.
 * O painel usa somente dry_run=true; ordens reais exigem token assinado no
 * servidor e não são disparadas por esta UI.
 */
export async function invokeExchange<T = Record<string, unknown>>(
  action: string,
  params: Record<string, unknown> = {},
): Promise<ExchangeResponse<T>> {
  try {
    const { data, error } = await supabase.functions.invoke('bybit-trading', {
      body: { action, params: { ...params, dry_run: true } },
    });
    if (error) return { ok: false, error: error.message };
    const payload = data as { success?: boolean; data?: T; error?: string } | undefined;
    if (payload && payload.success === false) return { ok: false, error: payload.error || 'Falha na exchange' };
    const inner = payload?.data as { data?: T } | undefined;
    return { ok: true, data: (inner?.data ?? payload?.data) as T };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'Erro desconhecido' };
  }
}
