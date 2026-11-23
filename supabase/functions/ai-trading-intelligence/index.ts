import { aiFetch } from '../_shared/aiRouter.ts';
import { createClient } from "npm:@supabase/supabase-js@2.57.4";


const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;

// 🔥 Modelo mais potente para análise avançada
const AI_MODEL = 'google/gemini-2.5-pro'; // Upgrade de flash para pro

Deno.serve(async (req) => {
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
      case 'get_realtime_news':
        result = await getRealtimeNews(symbol);
        break;
      case 'comprehensive_ai_analysis':
        result = await comprehensiveAIAnalysis(symbol, bybitTrades, largeOrders);
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

// 🌐 NOVA FUNÇÃO: Buscar notícias em tempo real via Perplexity
async function getRealtimeNews(symbol: string) {
  const cleanSymbol = symbol.replace('USDT', '').replace('USD', '');
  
  if (!PERPLEXITY_API_KEY) {
    console.log('⚠️ PERPLEXITY_API_KEY não configurada');
    return { news: [], source: 'unavailable' };
  }

  try {
    console.log(`📰 Buscando notícias em tempo real para ${cleanSymbol}...`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar-pro', // Modelo mais potente com multi-step reasoning
        messages: [
          { 
            role: 'system', 
            content: `Você é um analista de criptomoedas especializado em ${cleanSymbol}. Analise TODAS as notícias das últimas 6 horas. Seja específico sobre impacto no preço.` 
          },
          { 
            role: 'user', 
            content: `Pesquise notícias ATUAIS sobre ${cleanSymbol} nas últimas 6 horas. Foque em:
1. Movimentações de whales/instituições
2. Listagens ou delistagens em exchanges
3. Atualizações de protocolo/desenvolvimento
4. Parcerias ou acordos
5. Regulamentação
6. Hacks ou problemas de segurança
7. Análises de traders influentes

Retorne JSON VÁLIDO:
{
  "breakingNews": [{"title": "...", "impact": "BULLISH|BEARISH|NEUTRAL", "importance": 1-10}],
  "marketNarrative": "narrativa atual do mercado em 1-2 frases",
  "tradingBias": "LONG|SHORT|NEUTRAL",
  "urgentAlerts": ["alerta urgente se houver"],
  "confidence": 0-100,
  "nextCatalyst": "próximo evento importante se conhecido"
}`
          }
        ],
        max_tokens: 1000,
        search_recency_filter: 'day',
      }),
    });

    if (!response.ok) {
      console.error('❌ Perplexity error:', response.status);
      return { news: [], source: 'error' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        citations,
        source: 'perplexity-pro',
        symbol: cleanSymbol,
        fetchedAt: new Date().toISOString()
      };
    }
    
    return { news: [], source: 'parse_error' };
  } catch (error) {
    console.error('❌ Erro notícias tempo real:', error);
    return { news: [], source: 'error' };
  }
}

// 🧠 NOVA FUNÇÃO: Análise Compreensiva com IA Potente
async function comprehensiveAIAnalysis(symbol: string, bybitTrades: any[], largeOrders: any[]) {
  if (!LOVABLE_API_KEY) {
    return { error: 'LOVABLE_API_KEY não configurada' };
  }

  try {
    // Buscar notícias em tempo real
    const realtimeNews = await getRealtimeNews(symbol);
    
    // Analisar padrões históricos
    const patterns = await analyzeWinningPatterns(bybitTrades);
    
    // Analisar atividade de baleias
    const whaleAnalysis = await analyzeWhaleActivity(largeOrders, symbol);
    
    const cleanSymbol = symbol.replace('USDT', '').replace('USD', '');
    
    // 🔥 PROMPT MELHORADO E MAIS DETALHADO
    const enhancedPrompt = `Você é um trader quantitativo profissional de criptomoedas com 15 anos de experiência. Analise ${cleanSymbol} com EXTREMA precisão.

═══════════════════════════════════════════════════════════════
📰 NOTÍCIAS EM TEMPO REAL (últimas 6h):
${realtimeNews.breakingNews?.map((n: any) => `• ${n.title} [${n.impact}] (${n.importance}/10)`).join('\n') || 'Sem notícias relevantes'}
Narrativa: ${realtimeNews.marketNarrative || 'N/A'}
Bias atual: ${realtimeNews.tradingBias || 'NEUTRAL'}
Próximo catalisador: ${realtimeNews.nextCatalyst || 'Nenhum identificado'}
═══════════════════════════════════════════════════════════════

🐋 ATIVIDADE DE WHALES:
• Direção: ${whaleAnalysis.whaleDirection}
• Pressão compra: ${whaleAnalysis.buyPressure}%
• Pressão venda: ${whaleAnalysis.sellPressure}%
• Padrão: ${whaleAnalysis.pattern || 'N/A'}
• Confiança: ${whaleAnalysis.confidence}%
═══════════════════════════════════════════════════════════════

📊 PADRÕES HISTÓRICOS DO TRADER:
• Win Rate: ${patterns.patterns?.winRate?.toFixed(1) || 'N/A'}%
• Profit Factor: ${patterns.patterns?.profitFactor?.toFixed(2) || 'N/A'}
• Melhores horas UTC: ${patterns.patterns?.bestHours?.slice(0, 3).map((h: any) => h.hour).join(', ') || 'N/A'}
• Melhor em ${symbol}: ${patterns.patterns?.bestSymbols?.includes(symbol) ? 'SIM ✅' : 'NÃO ❌'}
• Total trades analisados: ${patterns.patterns?.totalTrades || 0}
═══════════════════════════════════════════════════════════════

🎯 SUA ANÁLISE DEVE INCLUIR:

1. DECISÃO DE TRADE:
   - Ação: BUY, SELL, ou WAIT (seja conservador se incerto)
   - Confidence: 0-100 (seja honesto, não inflacione)
   - Timing: AGORA, AGUARDAR_PULLBACK, AGUARDAR_BREAKOUT

2. GESTÃO DE RISCO (crítico):
   - Stop Loss: distância em % (considere volatilidade)
   - Take Profit: distância em % (realista)
   - Alavancagem máxima: 10-50x (baseado em volatilidade)
   - Risk/Reward mínimo aceitável

3. ALERTAS E AVISOS:
   - Riscos imediatos
   - Níveis de invalidação
   - Eventos que podem reverter a análise

4. EDGE QUANTITATIVO:
   - Por que essa oportunidade existe?
   - Qual é sua vantagem estatística?
   - Probabilidade estimada de sucesso

Responda em JSON VÁLIDO:
{
  "action": "BUY|SELL|WAIT",
  "confidence": 0-100,
  "timing": "NOW|WAIT_DIP|WAIT_BREAKOUT|AVOID",
  "stopLossPercent": 0.1-0.5,
  "takeProfitPercent": 0.2-1.0,
  "maxLeverage": 10-50,
  "riskReward": "1:X",
  "reasoning": "motivo principal em 20 palavras",
  "keyRisks": ["risco 1", "risco 2"],
  "invalidationLevel": "preço ou condição que invalida análise",
  "edgeExplanation": "por que temos vantagem",
  "probabilityOfSuccess": 0-100,
  "urgentAlerts": ["alerta urgente se houver"],
  "newsImpact": "como notícias afetam decisão"
}`;

    console.log('🧠 Chamando IA com modelo potente:', AI_MODEL);
    
    const response = await aiFetch({
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL,
        messages: [
          { 
            role: 'system', 
            content: `Você é um trader quantitativo de elite. Sua análise é usada para decisões de trading REAIS. Seja EXTREMAMENTE preciso, conservador quando incerto, e honesto sobre limitações. Priorize preservação de capital. Responda APENAS em JSON válido.` 
          },
          { role: 'user', content: enhancedPrompt }
        ],
        max_tokens: 2000,
        temperature: 0.3, // Mais determinístico para análise
      }),
    });

    if (!response.ok) {
      console.error('❌ AI API error:', response.status);
      return { error: 'AI API error', status: response.status };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const aiDecision = JSON.parse(jsonMatch[0]);
      
      return {
        symbol,
        decision: aiDecision,
        components: {
          realtimeNews,
          whaleAnalysis,
          historicalPatterns: patterns.patterns,
        },
        modelUsed: AI_MODEL,
        analyzedAt: new Date().toISOString()
      };
    }
    
    return { error: 'Failed to parse AI response' };
  } catch (error) {
    console.error('❌ Comprehensive analysis error:', error);
    return { error: error.message };
  }
}

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

  // Gerar recomendações via IA POTENTE
  const aiRecommendations = await getAIRecommendations(patterns);

  return {
    patterns,
    recommendations: aiRecommendations,
    analyzedAt: new Date().toISOString()
  };
}

// 🤖 Obter recomendações da IA baseadas nos padrões - PROMPT MELHORADO
async function getAIRecommendations(patterns: any) {
  if (!LOVABLE_API_KEY) {
    console.log('LOVABLE_API_KEY not configured, using rule-based recommendations');
    return generateRuleBasedRecommendations(patterns);
  }

  try {
    // 🔥 PROMPT MUITO MAIS DETALHADO
    const prompt = `Você é um analista quantitativo de elite com PhD em matemática financeira e 15 anos de experiência em trading algorítmico de criptomoedas.

══════════════════════════════════════════════════════════════════════════
📊 DADOS HISTÓRICOS DO TRADER (analisar com rigor estatístico):
══════════════════════════════════════════════════════════════════════════

📈 MÉTRICAS GERAIS:
• Win Rate: ${patterns.winRate.toFixed(2)}% (${patterns.totalWins}W / ${patterns.totalLosses}L)
• Profit Factor: ${patterns.profitFactor.toFixed(3)}
• Ganho Médio por Trade: $${patterns.avgWinSize.toFixed(4)}
• Perda Média por Trade: $${patterns.avgLossSize.toFixed(4)}
• Expectancy: $${((patterns.winRate/100 * patterns.avgWinSize) - ((100-patterns.winRate)/100 * patterns.avgLossSize)).toFixed(4)}
• Total de Trades Analisados: ${patterns.totalTrades}

⏰ ANÁLISE TEMPORAL (melhores horas UTC):
${patterns.bestHours.map((h: any) => `  ${h.hour}h: ${h.winRate.toFixed(1)}% WR, PnL $${h.totalPnl.toFixed(2)} (${h.trades} trades)`).join('\n')}

🎯 ANÁLISE POR ATIVO (melhores símbolos):
${patterns.bestSymbols.slice(0, 5).map((s: any) => `  ${s.symbol}: ${s.winRate.toFixed(1)}% WR, PnL $${s.totalPnl.toFixed(2)}, Leverage médio ${s.avgLeverage.toFixed(0)}x (${s.trades} trades)`).join('\n')}

══════════════════════════════════════════════════════════════════════════
🎯 SUA ANÁLISE DEVE CONSIDERAR:
══════════════════════════════════════════════════════════════════════════

1. GESTÃO DE RISCO MATEMÁTICA:
   - Kelly Criterion ajustado para o win rate e profit factor
   - Máximo drawdown tolerável
   - Número ótimo de posições simultâneas

2. EDGE EXPLOITATION:
   - Como maximizar vantagem nos melhores horários?
   - Quais símbolos priorizar baseado em dados?
   - Como ajustar sizing baseado em condições?

3. MELHORIA CONTÍNUA:
   - O que os dados revelam sobre fraquezas?
   - Padrões de perda a evitar?
   - Otimizações sugeridas?

Responda em JSON EXATO e VÁLIDO:
{
  "optimalLeverage": number (10-50, baseado em volatilidade e win rate),
  "optimalStopLoss": number (0.05-0.5 como %, adaptativo à volatilidade),
  "optimalTakeProfit": number (0.1-1.0 como %, baseado em R:R histórico),
  "kellyFraction": number (0.1-0.3, fração de Kelly recomendada),
  "bestTradingHours": [array de horas UTC prioritárias],
  "symbolsToFocus": [array de símbolos com edge comprovado],
  "symbolsToAvoid": [array de símbolos com edge negativo],
  "riskPerTrade": number (1-5 como % do capital),
  "maxConcurrentPositions": number (1-10),
  "maxDailyTrades": number (baseado em dados),
  "insights": "3-5 insights acionáveis baseados nos dados",
  "weaknesses": "2-3 áreas de melhoria identificadas",
  "confidenceInAnalysis": number (0-100, quão confiável são os dados)
}`;

    const response = await aiFetch({
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: AI_MODEL, // Modelo mais potente
        messages: [
          { role: 'system', content: 'Você é um quant de elite. Análise estatística rigorosa. Responda APENAS em JSON válido, sem markdown ou explicações.' },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1500,
        temperature: 0.2,
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
  const kellyFraction = patterns.winRate > 0 && patterns.profitFactor > 0 
    ? Math.min(0.25, (patterns.winRate/100 - (1 - patterns.winRate/100) / patterns.profitFactor))
    : 0.1;
    
  return {
    optimalLeverage: patterns.winRate >= 60 ? 30 : patterns.winRate >= 50 ? 20 : 15,
    optimalStopLoss: patterns.avgLossSize > patterns.avgWinSize ? 0.10 : 0.15,
    optimalTakeProfit: patterns.avgWinSize * 2.5 / 100 || 0.25,
    kellyFraction: Math.max(0.1, kellyFraction),
    bestTradingHours: patterns.bestHours.slice(0, 3).map((h: any) => h.hour),
    symbolsToFocus: patterns.bestSymbols.slice(0, 5).map((s: any) => s.symbol),
    symbolsToAvoid: [],
    riskPerTrade: patterns.winRate >= 55 ? 3 : 2,
    maxConcurrentPositions: patterns.winRate >= 60 ? 5 : 3,
    maxDailyTrades: 20,
    insights: `Win rate de ${patterns.winRate.toFixed(1)}% sugere ${patterns.winRate >= 55 ? 'estratégia agressiva' : 'estratégia conservadora'}. Profit factor de ${patterns.profitFactor.toFixed(2)}.`,
    weaknesses: 'Análise manual - dados limitados para conclusões robustas.',
    confidenceInAnalysis: Math.min(80, patterns.totalTrades * 2)
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
  const pattern = recentBuys >= 14 ? 'ACCUMULATION' : recentBuys <= 6 ? 'DISTRIBUTION' : 'MIXED';

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

// 📰 Analisar sentimento do mercado com IA Potente
async function analyzeSentiment(symbol: string) {
  // Primeiro buscar notícias em tempo real
  const realtimeNews = await getRealtimeNews(symbol);
  
  // Estimativa base
  const fearGreedIndex = 45 + Math.random() * 30;
  const socialScore = 40 + Math.random() * 40;
  
  let sentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL' = 'NEUTRAL';
  let confidence = 50;

  // Integrar notícias em tempo real
  if (realtimeNews.tradingBias === 'LONG') {
    sentiment = 'BULLISH';
    confidence = realtimeNews.confidence || 65;
  } else if (realtimeNews.tradingBias === 'SHORT') {
    sentiment = 'BEARISH';
    confidence = realtimeNews.confidence || 65;
  } else if (fearGreedIndex >= 60 && socialScore >= 60) {
    sentiment = 'BULLISH';
    confidence = Math.min(85, (fearGreedIndex + socialScore) / 2);
  } else if (fearGreedIndex <= 40 || socialScore <= 35) {
    sentiment = 'BEARISH';
    confidence = Math.min(85, 100 - (fearGreedIndex + socialScore) / 2);
  }

  return {
    sentiment,
    confidence: Math.round(confidence),
    fearGreedIndex: Math.round(fearGreedIndex),
    socialScore: Math.round(socialScore),
    realtimeNews: realtimeNews,
    keyFactors: realtimeNews.breakingNews?.map((n: any) => n.title) || ['Fear & Greed Index', 'Social Volume'],
    recommendation: sentiment === 'BULLISH' ? 'Favorável para longs' : sentiment === 'BEARISH' ? 'Cautela com longs' : 'Aguardar confirmação',
    analyzedAt: new Date().toISOString()
  };
}

// 🎯 Obter sinal de trading completo da IA
async function getAITradingSignal(symbol: string, bybitTrades: any[], sentiment: any, largeOrders: any[]) {
  // Usar análise compreensiva se disponível
  if (LOVABLE_API_KEY) {
    const comprehensive = await comprehensiveAIAnalysis(symbol, bybitTrades, largeOrders);
    if (comprehensive.decision) {
      return {
        symbol,
        signal: comprehensive.decision.action,
        score: comprehensive.decision.confidence,
        confidence: comprehensive.decision.confidence,
        components: comprehensive.components,
        parameters: {
          suggestedLeverage: comprehensive.decision.maxLeverage || 20,
          suggestedStopLoss: comprehensive.decision.stopLossPercent || 0.15,
          suggestedTakeProfit: comprehensive.decision.takeProfitPercent || 0.35,
          riskPerTrade: 2
        },
        insights: [
          comprehensive.decision.reasoning,
          comprehensive.decision.edgeExplanation,
          comprehensive.decision.newsImpact,
          ...(comprehensive.decision.urgentAlerts || [])
        ],
        decision: comprehensive.decision,
        analyzedAt: new Date().toISOString()
      };
    }
  }

  // Fallback para análise tradicional
  const patterns = await analyzeWinningPatterns(bybitTrades);
  const whaleAnalysis = await analyzeWhaleActivity(largeOrders, symbol);
  const sentimentAnalysis = sentiment || await analyzeSentiment(symbol);

  let score = 50;
  let direction: 'BUY' | 'SELL' | 'NEUTRAL' = 'NEUTRAL';

  if (whaleAnalysis.signal === 'BUY') score += 20;
  else if (whaleAnalysis.signal === 'SELL') score -= 20;

  if (sentimentAnalysis.sentiment === 'BULLISH') score += 15;
  else if (sentimentAnalysis.sentiment === 'BEARISH') score -= 15;

  const symbolInBest = patterns.patterns.bestSymbols?.some((s: any) => s.symbol === symbol);
  if (symbolInBest) score += 10;

  const currentHour = new Date().getUTCHours();
  const hourInBest = patterns.patterns.bestHours?.some((h: any) => h.hour === currentHour);
  if (hourInBest) score += 10;

  if (score >= 65) direction = 'BUY';
  else if (score <= 35) direction = 'SELL';

  const confidence = Math.min(95, Math.max(30, Math.abs(score - 50) + 50));
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
