import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { checkRateLimit, createRateLimitResponse, getClientIdentifier, rateLimitHeaders } from '../_shared/rateLimit.ts';
import { RISK, clampLeverage, stopDistancePct } from '../_shared/autonomousRisk.ts';
import { guardFromState, dailyReview } from '../_shared/autonomousAgent.ts';


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
  leverage?: number;
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

// 🔧 CORREÇÃO CRÍTICA: Calcular SL/TP com R:R mínimo de 2:1
function calculateOptimalSLTP(
  price: number,
  action: string,
  atr: number | undefined,
  originalSL?: number,
  originalTP?: number
): { stopLoss: number; takeProfit: number; riskReward: number } {
  const isBuy = action === 'buy';
  
  // Calcular volatilidade %
  const volatilityPct = atr ? (atr / price) * 100 : 2.0;
  
  // 🎯 SL baseado em volatilidade: 40-50% do ATR para dar espaço
  // Mínimo 0.8%, Máximo 2.5%
  let slPercent = Math.max(0.8, Math.min(2.5, volatilityPct * 0.45));
  
  // Alta volatilidade = SL maior para não ser stopado por ruído
  if (volatilityPct > 5) {
    slPercent = Math.max(slPercent, 1.5);
  } else if (volatilityPct > 3) {
    slPercent = Math.max(slPercent, 1.0);
  }
  
  // 🎯 R:R MÍNIMO de 2:1 - FORÇADO
  const MIN_RR = 2.0;
  let tpPercent = slPercent * MIN_RR;
  
  // Calcular valores absolutos
  const slDecimal = slPercent / 100;
  const tpDecimal = tpPercent / 100;
  
  let stopLoss: number;
  let takeProfit: number;
  
  if (isBuy) {
    stopLoss = price * (1 - slDecimal);
    takeProfit = price * (1 + tpDecimal);
  } else {
    stopLoss = price * (1 + slDecimal);
    takeProfit = price * (1 - tpDecimal);
  }
  
  // Verificar se os valores originais do TradingView são melhores
  if (originalSL && originalTP) {
    const origSlDist = Math.abs(price - originalSL);
    const origTpDist = Math.abs(originalTP - price);
    const origRR = origTpDist / origSlDist;
    
    // Se o R:R original for >= 2:1, usar os valores originais
    if (origRR >= MIN_RR) {
      console.log(`✅ Using TradingView SL/TP: R:R ${origRR.toFixed(2)}:1`);
      return {
        stopLoss: originalSL,
        takeProfit: originalTP,
        riskReward: origRR
      };
    } else {
      console.log(`⚠️ TradingView R:R ${origRR.toFixed(2)}:1 < 2:1, recalculando...`);
    }
  }
  
  const riskReward = tpPercent / slPercent;
  console.log(`🎯 Calculated SL: ${slPercent.toFixed(2)}% | TP: ${tpPercent.toFixed(2)}% | R:R ${riskReward.toFixed(1)}:1`);
  
  return { stopLoss, takeProfit, riskReward };
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Rate limiting: 30 req/min per client (IP/API key/user)
  const rateLimitResult = await checkRateLimit(getClientIdentifier(req), { maxRequests: 30, windowMs: 60_000 });
  if (!rateLimitResult.allowed) {
    return createRateLimitResponse(rateLimitResult, corsHeaders);
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
    const signalKey = `${data.symbol}:${data.action}`;
    if (!canExecute(signalKey)) {
      console.log(`⚠️ Duplicate signal blocked: ${signalKey}`);
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

    // Gate de memória do agente autônomo: kill switch, blacklist e horários
    // valem também para sinais vindos da TradingView.
    const { data: agentStates } = await supabase
      .from('agent_state')
      .select('*')
      .eq('symbol', data.symbol)
      .order('updated_at', { ascending: false })
      .limit(1);
    const agentState = agentStates?.[0] ?? null;
    const { data: recentTrades } = await supabase
      .from('agent_trades')
      .select('result, pnl_pct, closed_at, opened_at')
      .eq('symbol', data.symbol)
      .order('opened_at', { ascending: false })
      .limit(200);
    const review = dailyReview(recentTrades ?? []);
    const volatilityPct = data.atr && data.price ? (data.atr / data.price) * 100 : undefined;
    const gate = guardFromState(
      agentState,
      { price: Number(data.price) || undefined, atrPct: volatilityPct },
      new Date().getUTCHours(),
      new Date(),
      review.trades ? review.winRate : undefined,
    );
    if (!gate.tradable) {
      const reason = gate.reasons.join('; ') || 'risk_gate';
      console.log(`⛔ Risk gate blocked ${data.symbol}: ${reason}`);
      return new Response(
        JSON.stringify({ status: "ignored", reason: "risk_gate", detail: reason }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Alavancagem limitada ao mesmo RISK usado pelo chat (3x-6x, teto 8x).
    const requestedLeverage = Number(data.leverage) || (volatilityPct !== undefined
      ? (volatilityPct > 3 ? RISK.minLeverage : volatilityPct > 2 ? 4 : volatilityPct > 1 ? 5 : RISK.maxLeverage)
      : RISK.maxLeverage);
    const leverage = clampLeverage(requestedLeverage);
    console.log(`📊 Setting leverage: ${leverage}x`);

    // Primeiro, setar a alavancagem
    const { error: leverageError } = await supabase.functions.invoke('bybit-trading', {
      body: {
        action: 'set_leverage',
        isTestnet: false,
        params: {
          category: 'linear',
          symbol: data.symbol,
          buyLeverage: leverage.toString(),
          sellLeverage: leverage.toString()
        }
      }
    });

    if (leverageError) {
      console.log('⚠️ Leverage warning:', leverageError.message);
      // Continuar mesmo com erro de alavancagem (pode já estar setado)
    }

    // 🔧 CORREÇÃO CRÍTICA: Recalcular SL/TP para garantir R:R >= 2:1
    const optimal = calculateOptimalSLTP(
      data.price,
      data.action,
      data.atr,
      data.stop_loss,
      data.take_profit
    );
    let stopLoss = optimal.stopLoss;
    const takeProfit = optimal.takeProfit;
    // Teto único de distância do stop: 0,5% (mesmo limite do chat).
    if (stopDistancePct(data.price, stopLoss) > RISK.maxStopPct) {
      stopLoss = data.action === 'buy'
        ? data.price * (1 - RISK.maxStopPct / 100)
        : data.price * (1 + RISK.maxStopPct / 100);
    }
    const riskReward = stopDistancePct(data.price, stopLoss) > 0
      ? Math.abs(takeProfit - data.price) / Math.abs(data.price - stopLoss)
      : 0;

    console.log(`📊 Final SL: ${stopLoss.toFixed(4)} | TP: ${takeProfit.toFixed(4)} | R:R: ${riskReward.toFixed(1)}:1`);

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
          leverage: leverage,
          stopLoss: stopLoss.toFixed(4),
          takeProfit: takeProfit.toFixed(4),
          timeInForce: 'GTC'
        }
      }
    });

    if (tradeError) {
      console.error("❌ Trading error:", tradeError);
      throw tradeError;
    }

    console.log("✅ Trade executed:", tradeResult);

    // System user ID for webhook-initiated logs (required by NOT NULL constraint)
    const SYSTEM_USER_ID = '00000000-0000-0000-0000-000000000001';
    
    const { error: logError } = await supabase
      .from('auto_trader_logs')
      .insert({
        user_id: SYSTEM_USER_ID,
        log_type: 'TRADINGVIEW_SIGNAL' as any,
        symbol: data.symbol,
        message: `Signal from TradingView: ${data.action} @ ${data.price}`,
        metadata: {
          original_confidence: data.confidence,
          adjusted_confidence: validation.adjustedConfidence,
          validation_reason: validation.reason,
          calculated_sl: stopLoss,
          calculated_tp: takeProfit,
          risk_reward: riskReward,
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

    // Memória do agente autônomo: abre o registro para que o dailyReview e os
    // gates futuros tenham dados reais deste sinal.
    const { error: tradeMemoryError } = await supabase.from('agent_trades').insert({
      user_id: SYSTEM_USER_ID,
      symbol: data.symbol,
      side: data.action === 'buy' ? 'Buy' : 'Sell',
      entry: Number(data.price),
      stop_loss: stopLoss,
      qty: Number(data.qty),
      result: 'open',
      opened_at: new Date().toISOString(),
    });
    if (tradeMemoryError) console.error('⚠️ agent_trades insert error:', tradeMemoryError);

    const { error: stateMemoryError } = await supabase.from('agent_state').upsert({
      user_id: SYSTEM_USER_ID,
      symbol: data.symbol,
      last_signal_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: 'user_id,symbol' });
    if (stateMemoryError) console.error('⚠️ agent_state upsert error:', stateMemoryError);

    return new Response(
      JSON.stringify({ 
        status: "success", 
        trade: tradeResult,
        validation,
        riskManagement: {
          stopLoss,
          takeProfit,
          riskReward
        }
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
