import { aiFetch } from '../_shared/aiRouter.ts';
import { createClient } from "npm:@supabase/supabase-js@2.57.4";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SourceSignal {
  source: string;
  action: 'BUY' | 'SELL' | 'WAIT';
  confidence: number;
  target?: number;
  stop?: number;
  leverage?: number;
  reasoning: string;
  metadata?: Record<string, any>;
  timestamp: string;
}

interface GatewayRequest {
  symbol: string;
  timeframe?: string;
  sources?: ('market' | 'trading' | 'comprehensive' | 'ml')[];
  minConfidence?: number;
  requireConsensus?: boolean;
}

interface GatewayResponse {
  symbol: string;
  finalAction: 'BUY' | 'SELL' | 'WAIT';
  finalConfidence: number;
  targetPrice?: number;
  stopLoss?: number;
  suggestedLeverage?: number;
  reasoning: string;
  sourcesUsed: SourceSignal[];
  consensus: boolean;
  gatePass: boolean;
  gateBlockedBy?: string[];
  analyzedAt: string;
}

// Circuit breaker state
const circuitBreakers = new Map<string, { failures: number; lastFailure: number; open: boolean }>();

function checkCircuitBreaker(key: string): boolean {
  const cb = circuitBreakers.get(key);
  if (!cb || !cb.open) return true;
  // Auto-close after 60 seconds
  if (Date.now() - cb.lastFailure > 60000) {
    cb.open = false;
    cb.failures = 0;
    return true;
  }
  return false;
}

function recordFailure(key: string) {
  const cb = circuitBreakers.get(key) || { failures: 0, lastFailure: 0, open: false };
  cb.failures++;
  cb.lastFailure = Date.now();
  if (cb.failures >= 3) cb.open = true;
  circuitBreakers.set(key, cb);
}

function recordSuccess(key: string) {
  const cb = circuitBreakers.get(key);
  if (cb) {
    cb.failures = 0;
    cb.open = false;
  }
}

async function callWithTimeout<T>(promise: Promise<T>, ms: number, name: string): Promise<T | null> {
  if (!checkCircuitBreaker(name)) {
    console.warn(`Circuit breaker open for ${name}, skipping`);
    return null;
  }
  try {
    const result = await Promise.race([
      promise,
      new Promise<null>((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
    ]);
    recordSuccess(name);
    return result;
  } catch (error) {
    recordFailure(name);
    console.error(`${name} failed:`, error);
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body: GatewayRequest = await req.json();
    const { 
      symbol, 
      timeframe = '1h', 
      sources = ['market', 'trading', 'comprehensive', 'ml'],
      minConfidence = 70,
      requireConsensus = true
    } = body;

    if (!symbol) {
      return new Response(JSON.stringify({ error: 'symbol required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const sourceSignals: SourceSignal[] = [];
    const errors: string[] = [];

    // 1. ai-market-analysis (technical + news + ML score)
    if (sources.includes('market')) {
      const result = await callWithTimeout(
        supabase.functions.invoke('ai-market-analysis', {
          body: { symbol, timeframe, analysis_type: 'comprehensive' }
        }),
        15000,
        'ai-market-analysis'
      );
      if (result?.data) {
        const d = result.data;
        sourceSignals.push({
          source: 'ai-market-analysis',
          action: d.action,
          confidence: d.confidence,
          target: d.target_price,
          stop: d.stop_loss,
          leverage: d.leverage,
          reasoning: d.reasoning,
          metadata: { mlScore: d.mlScore, indicators: d.indicators },
          timestamp: new Date().toISOString()
        });
      } else if (result?.error) {
        errors.push(`market: ${result.error}`);
      }
    }

    // 2. ai-trading-intelligence (deep analysis with patterns + whales + news)
    if (sources.includes('trading')) {
      // Need recent trades and large orders for this
      const { data: trades } = await supabase
        .from('auto_trader_logs')
        .select('*')
        .eq('symbol', symbol)
        .order('created_at', { ascending: false })
        .limit(100);
      
      const { data: largeOrders } = await supabase
        .from('large_orders')
        .select('*')
        .eq('symbol', symbol)
        .order('timestamp', { ascending: false })
        .limit(50);

      const result = await callWithTimeout(
        supabase.functions.invoke('ai-trading-intelligence', {
          body: { 
            action: 'comprehensive_ai_analysis', 
            symbol, 
            bybitTrades: trades || [], 
            largeOrders: largeOrders || [] 
          }
        }),
        20000,
        'ai-trading-intelligence'
      );
      if (result?.data?.decision) {
        const dec = result.data.decision;
        sourceSignals.push({
          source: 'ai-trading-intelligence',
          action: dec.action,
          confidence: dec.confidence,
          target: dec.targetPrice,
          stop: dec.stopLoss,
          leverage: dec.maxLeverage,
          reasoning: dec.reasoning,
          metadata: { 
            components: result.data.components,
            modelUsed: result.data.modelUsed 
          },
          timestamp: new Date().toISOString()
        });
      } else if (result?.error) {
        errors.push(`trading: ${result.error}`);
      }
    }

    // 3. ai-comprehensive-analysis (on-chain + technical multi-TF + fundamental)
    if (sources.includes('comprehensive')) {
      const result = await callWithTimeout(
        supabase.functions.invoke('ai-comprehensive-analysis', {
          body: { symbol }
        }),
        20000,
        'ai-comprehensive-analysis'
      );
      if (result?.data?.finalSignal) {
        const sig = result.data.finalSignal;
        sourceSignals.push({
          source: 'ai-comprehensive-analysis',
          action: sig.action,
          confidence: sig.confidence,
          target: sig.targetPrice,
          stop: sig.stopLoss,
          leverage: sig.leverage,
          reasoning: sig.reasoning,
          metadata: { 
            onChain: result.data.onChain,
            technical: result.data.technical,
            fundamental: result.data.fundamental,
            sentiment: result.data.sentiment
          },
          timestamp: new Date().toISOString()
        });
      } else if (result?.error) {
        errors.push(`comprehensive: ${result.error}`);
      }
    }

    // 4. ml-adaptive-learning (pattern predictions)
    if (sources.includes('ml')) {
      const result = await callWithTimeout(
        supabase.functions.invoke('ml-adaptive-learning', {
          body: { action: 'predict', symbol, userId: 'gateway' }
        }),
        10000,
        'ml-adaptive-learning'
      );
      if (result?.data?.prediction) {
        const pred = result.data.prediction;
        sourceSignals.push({
          source: 'ml-adaptive-learning',
          action: pred.action,
          confidence: pred.confidence,
          target: pred.target,
          stop: pred.stop,
          leverage: pred.leverage,
          reasoning: pred.reasoning,
          metadata: { patterns: result.data.patterns },
          timestamp: new Date().toISOString()
        });
      } else if (result?.error) {
        errors.push(`ml: ${result.error}`);
      }
    }

    if (sourceSignals.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'No sources returned valid signals', 
        errors 
      }), {
        status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Aggregation logic
    const buySignals = sourceSignals.filter(s => s.action === 'BUY');
    const sellSignals = sourceSignals.filter(s => s.action === 'SELL');
    const waitSignals = sourceSignals.filter(s => s.action === 'WAIT');

    // Weighted confidence by source reliability
    const sourceWeights: Record<string, number> = {
      'ai-trading-intelligence': 1.0,  // Most comprehensive
      'ai-comprehensive-analysis': 0.9,
      'ai-market-analysis': 0.8,
      'ml-adaptive-learning': 0.7
    };

    let buyWeight = 0, sellWeight = 0, waitWeight = 0;
    let totalWeight = 0;
    let weightedTargetSum = 0, weightedStopSum = 0, weightedLeverageSum = 0;
    let targetCount = 0, stopCount = 0, leverageCount = 0;

    for (const s of sourceSignals) {
      const w = sourceWeights[s.source] || 0.5;
      totalWeight += w;
      if (s.action === 'BUY') {
        buyWeight += w * (s.confidence / 100);
        if (s.target) { weightedTargetSum += s.target * w; targetCount++; }
        if (s.stop) { weightedStopSum += s.stop * w; stopCount++; }
        if (s.leverage) { weightedLeverageSum += s.leverage * w; leverageCount++; }
      } else if (s.action === 'SELL') {
        sellWeight += w * (s.confidence / 100);
        if (s.target) { weightedTargetSum += s.target * w; targetCount++; }
        if (s.stop) { weightedStopSum += s.stop * w; stopCount++; }
        if (s.leverage) { weightedLeverageSum += s.leverage * w; leverageCount++; }
      } else {
        waitWeight += w;
      }
    }

    // Determine final action
    let finalAction: 'BUY' | 'SELL' | 'WAIT' = 'WAIT';
    let finalConfidence = 0;
    let targetPrice: number | undefined;
    let stopLoss: number | undefined;
    let suggestedLeverage: number | undefined;

    const buyScore = buyWeight / (totalWeight || 1);
    const sellScore = sellWeight / (totalWeight || 1);
    const waitScore = waitWeight / (totalWeight || 1);

    if (buyScore > sellScore && buyScore > waitScore && buyScore >= 0.3) {
      finalAction = 'BUY';
      finalConfidence = Math.round(buyScore * 100);
    } else if (sellScore > buyScore && sellScore > waitScore && sellScore >= 0.3) {
      finalAction = 'SELL';
      finalConfidence = Math.round(sellScore * 100);
    } else {
      finalAction = 'WAIT';
      finalConfidence = Math.round(Math.max(buyScore, sellScore, waitScore) * 100);
    }

    // Average targets from agreeing sources
    const agreeingSources = sourceSignals.filter(s => s.action === finalAction);
    if (agreeingSources.length > 0) {
      if (targetCount > 0) targetPrice = weightedTargetSum / targetCount;
      if (stopCount > 0) stopLoss = weightedStopSum / stopCount;
      if (leverageCount > 0) suggestedLeverage = Math.round(weightedLeverageSum / leverageCount);
    }

    // Consensus check
    const consensus = requireConsensus 
      ? (buyScore >= 0.5 || sellScore >= 0.5) // At least half weighted agreement
      : true;

    // Gate audit (reuse existing logic conceptually)
    const gateBlockedBy: string[] = [];
    if (finalConfidence < minConfidence) {
      gateBlockedBy.push(`confidence_below_${minConfidence}`);
    }
    if (requireConsensus && !consensus) {
      gateBlockedBy.push('no_consensus');
    }
    if (sourceSignals.length < 2) {
      gateBlockedBy.push('insufficient_sources');
    }
    // Time gate - no trading outside major hours (optional, configurable)
    const hour = new Date().getUTCHours();
    if (hour < 12 || hour > 22) { // 09:00-19:00 BRT approx
      gateBlockedBy.push('outside_trading_hours');
    }

    const gatePass = gateBlockedBy.length === 0 && finalAction !== 'WAIT';

    const response: GatewayResponse = {
      symbol,
      finalAction,
      finalConfidence,
      targetPrice,
      stopLoss,
      suggestedLeverage,
      reasoning: `Aggregated from ${sourceSignals.length} sources: ${sourceSignals.map(s => `${s.source}:${s.action}(${s.confidence}%)`).join(', ')}`,
      sourcesUsed: sourceSignals,
      consensus,
      gatePass,
      gateBlockedBy: gateBlockedBy.length > 0 ? gateBlockedBy : undefined,
      analyzedAt: new Date().toISOString()
    };

    // Log decision for ML training
    try {
      await supabase.from('ai_decisions').insert({
        symbol,
        final_action: finalAction,
        final_confidence: finalConfidence,
        target_price: targetPrice,
        stop_loss: stopLoss,
        leverage: suggestedLeverage,
        sources: sourceSignals.map(s => s.source),
        gate_pass: gatePass,
        gate_blocked_by: gateBlockedBy,
        consensus,
        raw_sources: sourceSignals,
        created_at: new Date().toISOString()
      });
    } catch (logError) {
      console.warn('Failed to log AI decision:', logError);
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('AI Signal Gateway error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});