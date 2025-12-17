import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbol, userId, bybitTrades, sentiment, largeOrders } = await req.json();
    
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    let result;

    switch (action) {
      case 'analyze_winning_patterns':
        result = await analyzeWinningPatterns(bybitTrades);
        break;
      case 'get_trading_signal':
        result = await getAITradingSignal(symbol, bybitTrades, sentiment, largeOrders);
        break;
      case 'analyze_whale_activity':
        result = await analyzeWhaleActivity(largeOrders, symbol);
        break;
      case 'sentiment_analysis':
        result = await analyzeSentiment(symbol);
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('AI Trading Intelligence error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// 🧠 Analisar padrões de trades vencedores do histórico Bybit
async function analyzeWinningPatterns(trades: any[]) {
  if (!trades || trades.length === 0) {
    return { patterns: [], recommendations: {} };
  }

  // Filtrar apenas trades vencedores
  const winningTrades = trades.filter(t => parseFloat(t.closedPnl || t.pnl || 0) > 0);
  const losingTrades = trades.filter(t => parseFloat(t.closedPnl || t.pnl || 0) < 0);

  // Análise por hora UTC
  const hourlyStats = new Map<number, { wins: number; losses: number; totalPnl: number }>();
  
  for (const trade of trades) {
    const time = new Date(parseInt(trade.updatedTime || trade.createdTime));
    const hour = time.getUTCHours();
    
    const stats = hourlyStats.get(hour) || { wins: 0, losses: 0, totalPnl: 0 };
    const pnl = parseFloat(trade.closedPnl || trade.pnl || 0);
    
    if (pnl > 0) stats.wins++;
    else stats.losses++;
    stats.totalPnl += pnl;
    
    hourlyStats.set(hour, stats);
  }

  // Encontrar melhores horas
  const bestHours = Array.from(hourlyStats.entries())
    .map(([hour, stats]) => ({
      hour,
      winRate: stats.wins / (stats.wins + stats.losses) * 100,
      totalPnl: stats.totalPnl,
      trades: stats.wins + stats.losses
    }))
    .filter(h => h.trades >= 3 && h.winRate >= 50)
    .sort((a, b) => b.winRate - a.winRate)
    .slice(0, 5);

  // Análise por símbolo
  const symbolStats = new Map<string, { wins: number; losses: number; totalPnl: number; avgLeverage: number }>();
  
  for (const trade of trades) {
    const symbol = trade.symbol;
    const stats = symbolStats.get(symbol) || { wins: 0, losses: 0, totalPnl: 0, avgLeverage: 0 };
    const pnl = parseFloat(trade.closedPnl || trade.pnl || 0);
    const leverage = parseFloat(trade.leverage || 10);
    
    if (pnl > 0) stats.wins++;
    else stats.losses++;
    stats.totalPnl += pnl;
    stats.avgLeverage = (stats.avgLeverage * (stats.wins + stats.losses - 1) + leverage) / (stats.wins + stats.losses);
    
    symbolStats.set(symbol, stats);
  }

  // Melhores símbolos
  const bestSymbols = Array.from(symbolStats.entries())
    .map(([symbol, stats]) => ({
      symbol,
      winRate: stats.wins / (stats.wins + stats.losses) * 100,
      totalPnl: stats.totalPnl,
      trades: stats.wins + stats.losses,
      avgLeverage: stats.avgLeverage
    }))
    .filter(s => s.trades >= 3 && s.winRate >= 50)
    .sort((a, b) => b.totalPnl - a.totalPnl)
    .slice(0, 10);

  // Padrões de trades vencedores
  const patterns = {
    avgWinSize: winningTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + parseFloat(t.closedPnl || t.pnl || 0), 0) / winningTrades.length 
      : 0,
    avgLossSize: losingTrades.length > 0 
      ? Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.closedPnl || t.pnl || 0), 0)) / losingTrades.length 
      : 0,
    winRate: trades.length > 0 ? (winningTrades.length / trades.length) * 100 : 0,
    profitFactor: losingTrades.length > 0 
      ? winningTrades.reduce((sum, t) => sum + parseFloat(t.closedPnl || t.pnl || 0), 0) / 
        Math.abs(losingTrades.reduce((sum, t) => sum + parseFloat(t.closedPnl || t.pnl || 0), 0))
      : 0,
    bestHours,
    bestSymbols,
    totalTrades: trades.length,
    totalWins: winningTrades.length,
    totalLosses: losingTrades.length,
  };

  // Gerar recomendações via IA
  const aiRecommendations = await getAIRecommendations(patterns);

  return {
    patterns,
    recommendations: aiRecommendations,
    analyzedAt: new Date().toISOString()
  };
}

// 🤖 Obter recomendações da IA baseadas nos padrões
async function getAIRecommendations(patterns: any) {
  if (!LOVABLE_API_KEY) {
    console.log('LOVABLE_API_KEY not configured, using rule-based recommendations');
    return generateRuleBasedRecommendations(patterns);
  }

  try {
    const prompt = `Você é um analista de trading quantitativo especializado em scalping de criptomoedas.

Analise estes padrões de trading histórico e forneça recomendações ESPECÍFICAS e ACIONÁVEIS:

DADOS:
- Win Rate: ${patterns.winRate.toFixed(1)}%
- Profit Factor: ${patterns.profitFactor.toFixed(2)}
- Ganho Médio: $${patterns.avgWinSize.toFixed(4)}
- Perda Média: $${patterns.avgLossSize.toFixed(4)}
- Total Trades: ${patterns.totalTrades}
- Melhores Horas UTC: ${patterns.bestHours.map((h: any) => `${h.hour}h (${h.winRate.toFixed(0)}%)`).join(', ')}
- Melhores Símbolos: ${patterns.bestSymbols.slice(0,5).map((s: any) => `${s.symbol} (${s.winRate.toFixed(0)}%)`).join(', ')}

RESPONDA EM JSON com este formato EXATO:
{
  "optimalLeverage": number (5-50),
  "optimalStopLoss": number (0.05-0.5 como porcentagem),
  "optimalTakeProfit": number (0.1-1.0 como porcentagem),
  "bestTradingHours": [array de horas UTC],
  "symbolsToFocus": [array de símbolos],
  "symbolsToAvoid": [array de símbolos],
  "riskPerTrade": number (1-5 como porcentagem),
  "maxConcurrentPositions": number (1-10),
  "insights": "string com 2-3 insights principais"
}`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é um analista quantitativo. Responda APENAS em JSON válido, sem markdown.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1000,
      }),
    });

    if (!response.ok) {
      console.error('AI API error:', response.status);
      return generateRuleBasedRecommendations(patterns);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    // Extrair JSON da resposta
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }
    
    return generateRuleBasedRecommendations(patterns);
  } catch (error) {
    console.error('AI recommendation error:', error);
    return generateRuleBasedRecommendations(patterns);
  }
}

// Recomendações baseadas em regras (fallback)
function generateRuleBasedRecommendations(patterns: any) {
  return {
    optimalLeverage: patterns.winRate >= 60 ? 25 : patterns.winRate >= 50 ? 15 : 10,
    optimalStopLoss: patterns.avgLossSize > patterns.avgWinSize ? 0.10 : 0.15,
    optimalTakeProfit: patterns.avgWinSize * 2.5 / 100 || 0.25,
    bestTradingHours: patterns.bestHours.slice(0, 3).map((h: any) => h.hour),
    symbolsToFocus: patterns.bestSymbols.slice(0, 5).map((s: any) => s.symbol),
    symbolsToAvoid: [],
    riskPerTrade: patterns.winRate >= 55 ? 3 : 2,
    maxConcurrentPositions: patterns.winRate >= 60 ? 5 : 3,
    insights: `Win rate de ${patterns.winRate.toFixed(1)}% sugere ${patterns.winRate >= 55 ? 'estratégia agressiva' : 'estratégia conservadora'}. Profit factor de ${patterns.profitFactor.toFixed(2)}.`
  };
}

// 🐋 Analisar atividade de baleias/grandes players
async function analyzeWhaleActivity(largeOrders: any[], symbol?: string) {
  if (!largeOrders || largeOrders.length === 0) {
    return {
      signal: 'NEUTRAL',
      confidence: 50,
      buyPressure: 50,
      sellPressure: 50,
      whaleDirection: 'NEUTRAL',
      insights: 'Sem dados de grandes ordens disponíveis'
    };
  }

  // Filtrar por símbolo se especificado
  const relevantOrders = symbol 
    ? largeOrders.filter(o => o.symbol === symbol || o.symbol?.includes(symbol.replace('USDT', '')))
    : largeOrders;

  if (relevantOrders.length === 0) {
    return {
      signal: 'NEUTRAL',
      confidence: 50,
      buyPressure: 50,
      sellPressure: 50,
      whaleDirection: 'NEUTRAL',
      insights: `Sem grandes ordens para ${symbol || 'ativos selecionados'}`
    };
  }

  // Calcular pressão de compra/venda
  const buyOrders = relevantOrders.filter(o => o.side === 'Buy' || o.side === 'bid');
  const sellOrders = relevantOrders.filter(o => o.side === 'Sell' || o.side === 'ask');

  const buyVolume = buyOrders.reduce((sum, o) => sum + (o.value_usd || o.size * o.price), 0);
  const sellVolume = sellOrders.reduce((sum, o) => sum + (o.value_usd || o.size * o.price), 0);
  const totalVolume = buyVolume + sellVolume;

  const buyPressure = totalVolume > 0 ? (buyVolume / totalVolume) * 100 : 50;
  const sellPressure = totalVolume > 0 ? (sellVolume / totalVolume) * 100 : 50;

  // Determinar direção das baleias
  let whaleDirection: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let signal: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';
  let confidence = 50;

  if (buyPressure >= 65) {
    whaleDirection = 'BULLISH';
    signal = 'BUY';
    confidence = Math.min(90, 50 + (buyPressure - 50));
  } else if (sellPressure >= 65) {
    whaleDirection = 'BEARISH';
    signal = 'SELL';
    confidence = Math.min(90, 50 + (sellPressure - 50));
  }

  // Detectar acumulação/distribuição
  const recentOrders = relevantOrders.slice(0, 20);
  const recentBuys = recentOrders.filter(o => o.side === 'Buy' || o.side === 'bid').length;
  const pattern = recentBuys >= 14 ? 'ACUMULAÇÃO' : recentBuys <= 6 ? 'DISTRIBUIÇÃO' : 'MISTO';

  return {
    signal,
    confidence,
    buyPressure: Math.round(buyPressure),
    sellPressure: Math.round(sellPressure),
    whaleDirection,
    pattern,
    totalVolume,
    largeOrderCount: relevantOrders.length,
    insights: `${pattern} detectada. ${whaleDirection === 'BULLISH' ? 'Baleias acumulando' : whaleDirection === 'BEARISH' ? 'Baleias vendendo' : 'Sem direção clara'}. Volume: $${(totalVolume/1000).toFixed(1)}k`
  };
}

// 📰 Analisar sentimento do mercado
async function analyzeSentiment(symbol: string) {
  // Simulação de análise de sentimento (em produção, integrar com APIs de notícias/social)
  const fearGreedIndex = 45 + Math.random() * 30; // 45-75 range
  const socialScore = 40 + Math.random() * 40; // 40-80 range
  
  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let confidence = 50;

  if (fearGreedIndex >= 60 && socialScore >= 60) {
    sentiment = 'BULLISH';
    confidence = Math.min(85, (fearGreedIndex + socialScore) / 2);
  } else if (fearGreedIndex <= 40 || socialScore <= 35) {
    sentiment = 'BEARISH';
    confidence = Math.min(85, 100 - (fearGreedIndex + socialScore) / 2);
  }

  // Usar IA para análise mais profunda se disponível
  if (LOVABLE_API_KEY) {
    try {
      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            { 
              role: 'system', 
              content: 'Você é um analista de sentimento de mercado cripto. Responda APENAS em JSON.' 
            },
            { 
              role: 'user', 
              content: `Analise o sentimento atual para ${symbol}. Fear & Greed Index: ${fearGreedIndex.toFixed(0)}. Social Score: ${socialScore.toFixed(0)}. 
              
              Responda em JSON: {"sentiment": "BULLISH|BEARISH|NEUTRAL", "confidence": 0-100, "keyFactors": ["fator1", "fator2"], "recommendation": "string curta"}` 
            }
          ],
          max_tokens: 500,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        const content = data.choices?.[0]?.message?.content || '';
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const aiSentiment = JSON.parse(jsonMatch[0]);
          return {
            ...aiSentiment,
            fearGreedIndex: Math.round(fearGreedIndex),
            socialScore: Math.round(socialScore),
            analyzedAt: new Date().toISOString()
          };
        }
      }
    } catch (error) {
      console.error('AI sentiment error:', error);
    }
  }

  return {
    sentiment,
    confidence: Math.round(confidence),
    fearGreedIndex: Math.round(fearGreedIndex),
    socialScore: Math.round(socialScore),
    keyFactors: ['Fear & Greed Index', 'Social Volume'],
    recommendation: sentiment === 'BULLISH' ? 'Favorável para longs' : sentiment === 'BEARISH' ? 'Cautela com longs' : 'Aguardar confirmação',
    analyzedAt: new Date().toISOString()
  };
}

// 🎯 Obter sinal de trading completo da IA
async function getAITradingSignal(symbol: string, bybitTrades: any[], sentiment: any, largeOrders: any[]) {
  // Analisar padrões históricos
  const patterns = await analyzeWinningPatterns(bybitTrades);
  
  // Analisar atividade de baleias
  const whaleAnalysis = await analyzeWhaleActivity(largeOrders, symbol);
  
  // Analisar sentimento
  const sentimentAnalysis = sentiment || await analyzeSentiment(symbol);

  // Calcular score composto
  let score = 50; // Neutro
  let direction: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';

  // Peso: Baleias 40%, Sentimento 30%, Padrões 30%
  if (whaleAnalysis.signal === 'BUY') score += 20;
  else if (whaleAnalysis.signal === 'SELL') score -= 20;

  if (sentimentAnalysis.sentiment === 'BULLISH') score += 15;
  else if (sentimentAnalysis.sentiment === 'BEARISH') score -= 15;

  // Ajuste baseado em padrões históricos
  const symbolInBest = patterns.patterns.bestSymbols?.some((s: any) => s.symbol === symbol);
  if (symbolInBest) score += 10;

  const currentHour = new Date().getUTCHours();
  const hourInBest = patterns.patterns.bestHours?.some((h: any) => h.hour === currentHour);
  if (hourInBest) score += 10;

  // Determinar direção
  if (score >= 65) direction = 'BUY';
  else if (score <= 35) direction = 'SELL';

  const confidence = Math.min(95, Math.max(30, Math.abs(score - 50) + 50));

  // Parâmetros recomendados
  const recommendations = patterns.recommendations || {};
  
  return {
    symbol,
    signal: direction,
    score,
    confidence,
    components: {
      whaleSignal: whaleAnalysis.signal,
      whaleConfidence: whaleAnalysis.confidence,
      sentiment: sentimentAnalysis.sentiment,
      sentimentConfidence: sentimentAnalysis.confidence,
      historicalEdge: symbolInBest || hourInBest
    },
    parameters: {
      suggestedLeverage: recommendations.optimalLeverage || 15,
      suggestedStopLoss: recommendations.optimalStopLoss || 0.15,
      suggestedTakeProfit: recommendations.optimalTakeProfit || 0.35,
      riskPerTrade: recommendations.riskPerTrade || 2
    },
    insights: [
      whaleAnalysis.insights,
      sentimentAnalysis.recommendation,
      hourInBest ? `✅ Hora favorável (${currentHour}h UTC)` : `⚠️ Hora não ideal`,
      symbolInBest ? `✅ ${symbol} é um dos melhores ativos` : `⚠️ ${symbol} não está no top histórico`
    ],
    analyzedAt: new Date().toISOString()
  };
}
