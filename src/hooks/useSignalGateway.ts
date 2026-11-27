// Ponte opcional entre o ai-signal-gateway e o robô frontend.
// O gateway é usado como VETO: se ele bloquear ou divergir da ação local, a
// entrada é ignorada. Falha do gateway nunca impede o robô (fail-open), e o
// resultado fica em cache por 15 min para evitar custo de IA a cada candle.
import { supabase } from '@/integrations/supabase/client';

export interface GatewaySignal {
  symbol: string;
  finalAction: 'BUY' | 'SELL' | 'WAIT';
  finalConfidence: number;
  gatePass: boolean;
  gateBlockedBy?: string[];
  analyzedAt?: string;
}

const CACHE_MS = 15 * 60_000;
const cache = new Map<string, { at: number; value: GatewaySignal | null }>();

export async function getGatewaySignal(symbol: string): Promise<GatewaySignal | null> {
  // Desligue com VITE_USE_SIGNAL_GATEWAY=false para operar só com o analisador local.
  if (import.meta.env.VITE_USE_SIGNAL_GATEWAY === 'false') return null;

  const key = symbol.toUpperCase().replace('/', '');
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.value;

  let value: GatewaySignal | null = null;
  try {
    const { data, error } = await supabase.functions.invoke('ai-signal-gateway', {
      body: { symbol: key, timeframe: '5m', minConfidence: 60, requireConsensus: true },
    });
    if (!error && data) value = data as GatewaySignal;
  } catch {
    // gateway indisponível não bloqueia o robô
  }
  cache.set(key, { at: Date.now(), value });
  return value;
}

export function clearGatewayCache() {
  cache.clear();
}
