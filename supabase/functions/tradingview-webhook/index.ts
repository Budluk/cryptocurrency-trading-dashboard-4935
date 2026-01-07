import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TradingViewAlert {
  action: string;
  symbol: string;
  price: number;
  confidence: number;
  qty: number;
  stop_loss?: number;
  take_profit?: number;
  atr?: number;
  ema_fast?: number;
  ema_slow?: number;
  rsi?: number;
}

// Proteção contra sinais duplicados
const recentSignals = new Map<string, number>();

function canExecute(key: string, cooldownMs: number = 5000): boolean {
  const now = Date.now();
  const last = recentSignals.get(key) || 0;
  if (now - last < cooldownMs) {
    return false;
  }
  recentSignals.set(key, now);
  return true;
}

// Validação conservadora adicional
function scoreSignal(data: TradingViewAlert, minConfidence: number = 80): {
  shouldExecute: boolean;
  adjustedConfidence: number;
  reason: string;
} {
  let score = data.confidence;
  const reasons: string[] = [];

  // Verificar se tem indicadores mínimos
  if (!data.rsi || !data.atr) {
    return { 
      shouldExecute: false, 
      adjustedConfidence: 0, 
      reason: "Missing required indicators (RSI, ATR)" 
    };
  }

  // RSI em zona extrema (menos restritivo para conta real)
  if (data.action === "buy" && data.rsi && data.rsi > 78) {
    score -= 10;
    reasons.push("RSI overbought");
  }
  if (data.action === "sell" && data.rsi && data.rsi < 22) {
    score -= 10;
    reasons.push("RSI oversold");
  }

  // EMA confirmação
  if (data.ema_fast && data.ema_slow) {
    if (data.action === "buy" && data.ema_fast > data.ema_slow) {
      score += 10;
      reasons.push("EMA bullish");
    } else if (data.action === "sell" && data.ema_fast < data.ema_slow) {
      score += 10;
      reasons.push("EMA bearish");
    } else {
      score -= 10;
      reasons.push("EMA divergence");
    }
  }

  // Volatilidade (ATR muito alto = risco)
  if (data.atr && data.price) {
    const atrPercent = (data.atr / data.price) * 100;
    if (atrPercent > 3) {
      score -= 10;
      reasons.push("High volatility");
    }
  }

  const shouldExecute = score >= minConfidence;
  return {
    shouldExecute,
    adjustedConfidence: Math.max(0, Math.min(100, score)),
    reason: reasons.join(", ")
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  try {
    // ==========================================
    // SECURITY: Webhook signature verification (REQUIRED)
    // ==========================================
    const webhookSecret = Deno.env.get('TRADINGVIEW_WEBHOOK_SECRET');
    
    // CRITICAL: Reject all requests if secret not configured
    if (!webhookSecret) {
      console.error('❌ TRADINGVIEW_WEBHOOK_SECRET not configured - rejecting request');
      return new Response(
        JSON.stringify({ error: 'Webhook authentication not configured' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const signature = req.headers.get('X-TradingView-Signature');
    const body = await req.text();
    
    if (!signature) {
      console.error('❌ Missing webhook signature');
      return new Response(
        JSON.stringify({ error: 'Missing signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    // Verify HMAC signature
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );
    
    const signatureBuffer = Uint8Array.from(
      atob(signature),
      c => c.charCodeAt(0)
    );
    
    const isValid = await crypto.subtle.verify(
      'HMAC',
      key,
      signatureBuffer,
      encoder.encode(body)
    );
    
    if (!isValid) {
      console.error('❌ Invalid webhook signature');
      return new Response(
        JSON.stringify({ error: 'Invalid signature' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    
    const data: TradingViewAlert = JSON.parse(body);
    console.log("✅ TradingView webhook received (verified)");

    // Validação básica
    if (!data.action || !data.symbol || !data.confidence || !data.price) {
      throw new Error("Missing required fields: action, symbol, confidence, price");
    }

    // Limiar mínimo de confiança
    const MIN_CONFIDENCE = 80;
    if (data.confidence < MIN_CONFIDENCE) {
      console.log(`⚠️ Signal ignored: confidence ${data.confidence} < ${MIN_CONFIDENCE}`);
      return new Response(
        JSON.stringify({ 
          status: "ignored", 
          reason: "low_confidence", 
          confidence: data.confidence 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Proteção contra duplicatas
    const key = `${data.symbol}:${data.action}`;
    if (!canExecute(key)) {
      console.log(`⚠️ Duplicate signal blocked: ${key}`);
      return new Response(
        JSON.stringify({ status: "ignored", reason: "duplicate" }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Score local conservador
    const validation = scoreSignal(data, MIN_CONFIDENCE);
    if (!validation.shouldExecute) {
      console.log(`⚠️ Signal filtered: ${validation.reason}`);
      return new Response(
        JSON.stringify({ 
          status: "ignored", 
          reason: "strategy_filter",
          validation 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`✅ Signal validated: ${validation.adjustedConfidence}% - ${validation.reason}`);

    // Chamar edge function de trading do Bybit - MODO REAL ATIVADO
    const { data: tradeResult, error: tradeError } = await supabase.functions.invoke('bybit-trading', {
      body: {
        action: 'place_order',
        isTestnet: false, // ⚡ CONTA REAL ATIVA
        params: {
          category: 'linear',
          symbol: data.symbol,
          side: data.action === 'buy' ? 'Buy' : 'Sell',
          orderType: 'Market',
          qty: data.qty.toString(),
          stopLoss: data.stop_loss?.toString(),
          takeProfit: data.take_profit?.toString(),
          timeInForce: 'GTC'
        }
      }
    });

    if (tradeError) {
      console.error("❌ Trading error:", tradeError);
      throw tradeError;
    }

    console.log("✅ Trade executed:", tradeResult);

    // Salvar no histórico de learning (sem user_id pois webhook é público)
    const { error: logError } = await supabase
      .from('auto_trader_logs')
      .insert({
        log_type: 'TRADINGVIEW_SIGNAL' as any,
        symbol: data.symbol,
        message: `Signal from TradingView: ${data.action} @ ${data.price}`,
        metadata: {
          original_confidence: data.confidence,
          adjusted_confidence: validation.adjustedConfidence,
          validation_reason: validation.reason,
          indicators: {
            rsi: data.rsi,
            atr: data.atr,
            ema_fast: data.ema_fast,
            ema_slow: data.ema_slow
          },
          trade_result: tradeResult
        } as any
      });

    if (logError) {
      console.error("⚠️ Log error:", logError);
    }

    return new Response(
      JSON.stringify({ 
        status: "success", 
        trade: tradeResult,
        validation
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error: any) {
    console.error("❌ Webhook error:", error);
    return new Response(
      JSON.stringify({ 
        status: "error", 
        message: error.message 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
