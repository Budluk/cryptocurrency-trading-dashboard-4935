import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const PERPLEXITY_API_KEY = Deno.env.get('PERPLEXITY_API_KEY');

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, symbol, symbols } = await req.json();
    
    let result;

    switch (action) {
      case 'get_news_sentiment':
        result = await getNewsSentiment(symbol);
        break;
      case 'get_market_events':
        result = await getMarketEvents();
        break;
      case 'analyze_symbol_news':
        result = await analyzeSymbolNews(symbol);
        break;
      case 'get_whale_alerts':
        result = await getWhaleAlerts(symbols || [symbol]);
        break;
      case 'get_fear_greed':
        result = await getFearGreedIndex();
        break;
      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(JSON.stringify({ success: true, data: result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Market Intelligence error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

// 📰 Buscar análise de sentimento via Perplexity (busca web em tempo real)
async function getNewsSentiment(symbol: string) {
  if (!PERPLEXITY_API_KEY) {
    console.log('PERPLEXITY_API_KEY not configured, using simulated data');
    return getSimulatedSentiment(symbol);
  }

  try {
    const cleanSymbol = symbol.replace('USDT', '').replace('USD', '');
    
    console.log(`📰 Analisando sentimento para ${cleanSymbol} via Perplexity...`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: `Você é um analista experiente de criptomoedas. Analise as notícias mais recentes sobre ${cleanSymbol}. Responda APENAS em JSON válido, sem markdown ou explicações.` 
          },
          { 
            role: 'user', 
            content: `Pesquise e analise as notícias mais recentes sobre ${cleanSymbol} criptomoeda nas últimas 24 horas. Considere:
- Notícias de exchanges e regulamentação
- Atualizações de desenvolvimento do projeto
- Movimentações de whales
- Sentimento das redes sociais
- Eventos macroeconômicos que afetam cripto

Retorne JSON: {
  "sentiment": "BULLISH" ou "BEARISH" ou "NEUTRAL",
  "confidence": 0-100,
  "keyNews": ["notícia 1", "notícia 2", "notícia 3"],
  "catalysts": ["fator positivo/negativo"],
  "riskLevel": "LOW" ou "MEDIUM" ou "HIGH",
  "recommendation": "LONG" ou "SHORT" ou "WAIT",
  "reasoning": "explicação curta baseada nas notícias encontradas"
}`
          }
        ],
        max_tokens: 600,
        search_recency_filter: 'day',
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Perplexity API error:', response.status, errorText);
      return getSimulatedSentiment(symbol);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    
    console.log(`📊 Resposta Perplexity para ${cleanSymbol}:`, content.substring(0, 200));
    
    // Extrair JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        symbol,
        citations,
        source: 'perplexity',
        analyzedAt: new Date().toISOString()
      };
    }
    
    return getSimulatedSentiment(symbol);
  } catch (error) {
    console.error('News sentiment error:', error);
    return getSimulatedSentiment(symbol);
  }
}

// 🌐 Buscar eventos de mercado via Perplexity
async function getMarketEvents() {
  if (!PERPLEXITY_API_KEY) {
    return { events: [], source: 'simulated' };
  }

  try {
    console.log('🌐 Buscando eventos de mercado via Perplexity...');
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um analista de mercado cripto experiente. Pesquise eventos importantes que podem afetar o mercado. Responda APENAS em JSON válido.' 
          },
          { 
            role: 'user', 
            content: `Pesquise os próximos eventos econômicos e de criptomoedas que podem impactar o mercado nos próximos 7 dias:
- Decisões do FOMC/Fed
- Relatórios de CPI/inflação
- Halvings, airdrops, unlocks de tokens
- Atualizações de protocolos importantes (Ethereum, etc)
- Eventos regulatórios
             
Retorne JSON: {
  "events": [
    {
      "title": "nome do evento",
      "type": "FOMC" ou "CPI" ou "NFP" ou "EARNINGS" ou "CRYPTO_SPECIFIC" ou "OTHER",
      "impact": "HIGH" ou "MEDIUM" ou "LOW",
      "expectedTime": "data/hora aproximada",
      "affectedAssets": ["BTC", "ETH", etc],
      "expectedDirection": "BULLISH" ou "BEARISH" ou "UNCERTAIN",
      "tradingAdvice": "dica curta"
    }
  ],
  "overallMarketSentiment": "RISK_ON" ou "RISK_OFF" ou "NEUTRAL"
}`
          }
        ],
        max_tokens: 800,
        search_recency_filter: 'week',
      }),
    });

    if (!response.ok) {
      console.error('Perplexity error for market events:', response.status);
      return { events: [], source: 'error' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        ...JSON.parse(jsonMatch[0]),
        citations,
        source: 'perplexity',
        analyzedAt: new Date().toISOString()
      };
    }
    
    return { events: [], source: 'parse_error' };
  } catch (error) {
    console.error('Market events error:', error);
    return { events: [], source: 'error' };
  }
}

// 📊 Análise profunda de um símbolo
async function analyzeSymbolNews(symbol: string) {
  if (!PERPLEXITY_API_KEY) {
    return { analysis: null, source: 'no_api_key' };
  }

  const cleanSymbol = symbol.replace('USDT', '').replace('USD', '');

  try {
    console.log(`📊 Análise profunda para ${cleanSymbol}...`);
    
    // Primeiro buscar sentimento
    const newsData = await getNewsSentiment(symbol);
    
    // Depois usar Perplexity para análise mais profunda
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um trader profissional de criptomoedas. Analise dados e dê recomendações práticas em JSON.' 
          },
          { 
            role: 'user', 
            content: `Baseado nestas informações sobre ${cleanSymbol}:
            
Sentimento: ${newsData.sentiment}
Confiança: ${newsData.confidence}%
Notícias: ${JSON.stringify(newsData.keyNews)}
Nível de Risco: ${newsData.riskLevel}

Pesquise mais informações em tempo real e forneça uma análise de trading:

{
  "shouldTrade": true ou false,
  "direction": "LONG" ou "SHORT" ou "NONE",
  "confidenceLevel": 0-100,
  "entryTiming": "NOW" ou "WAIT_DIP" ou "WAIT_BREAKOUT" ou "AVOID",
  "riskReward": "descrição curta da relação risco/recompensa",
  "stopLossAdvice": "onde colocar stop",
  "takeProfitAdvice": "onde realizar lucro",
  "timeframe": "scalp 5min" ou "swing 1h" ou "position 4h+",
  "warnings": ["aviso 1", "aviso 2"]
}`
          }
        ],
        max_tokens: 800,
        search_recency_filter: 'day',
      }),
    });

    if (!response.ok) {
      return { ...newsData, analysis: null };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        ...newsData,
        analysis: JSON.parse(jsonMatch[0]),
        citations,
        source: 'perplexity',
        analyzedAt: new Date().toISOString()
      };
    }
    
    return { ...newsData, analysis: null };
  } catch (error) {
    console.error('Symbol analysis error:', error);
    return { analysis: null, source: 'error' };
  }
}

// 🐋 Buscar alertas de whales via Perplexity
async function getWhaleAlerts(symbols: string[]) {
  if (!PERPLEXITY_API_KEY) {
    return getSimulatedWhaleAlerts(symbols);
  }

  try {
    const symbolList = symbols.slice(0, 5).map(s => s.replace('USDT', '')).join(', ');
    
    console.log(`🐋 Analisando atividade de whales para: ${symbolList}...`);
    
    const response = await fetch('https://api.perplexity.ai/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${PERPLEXITY_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'sonar',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um analista on-chain de criptomoedas. Pesquise movimentações de whales recentes. Responda APENAS em JSON válido.' 
          },
          { 
            role: 'user', 
            content: `Pesquise movimentações recentes de whales (grandes carteiras) para: ${symbolList}.

Busque em fontes como Whale Alert, on-chain data, e notícias sobre:
- Grandes transferências para/de exchanges
- Acumulação por carteiras institucionais
- Movimentações suspeitas
- Desbloqueios de tokens
             
Retorne JSON: {
  "alerts": [
    {
      "symbol": "BTC",
      "type": "ACCUMULATION" ou "DISTRIBUTION" ou "EXCHANGE_INFLOW" ou "EXCHANGE_OUTFLOW",
      "amount": "valor em USD",
      "impact": "BULLISH" ou "BEARISH" ou "NEUTRAL",
      "confidence": 0-100,
      "details": "descrição curta"
    }
  ],
  "overallWhaleDirection": "ACCUMULATING" ou "DISTRIBUTING" ou "MIXED",
  "tradingImplication": "o que isso significa para traders"
}`
          }
        ],
        max_tokens: 800,
        search_recency_filter: 'day',
      }),
    });

    if (!response.ok) {
      console.error('Perplexity error for whale alerts:', response.status);
      return getSimulatedWhaleAlerts(symbols);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    const citations = data.citations || [];
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        ...JSON.parse(jsonMatch[0]),
        citations,
        source: 'perplexity',
        analyzedAt: new Date().toISOString()
      };
    }
    
    return getSimulatedWhaleAlerts(symbols);
  } catch (error) {
    console.error('Whale alerts error:', error);
    return getSimulatedWhaleAlerts(symbols);
  }
}

// 😱 Fear & Greed Index (API pública gratuita)
async function getFearGreedIndex() {
  try {
    // API pública do Fear & Greed Index
    const response = await fetch('https://api.alternative.me/fng/?limit=1');
    
    if (!response.ok) {
      return getSimulatedFearGreed();
    }

    const data = await response.json();
    const fngData = data.data?.[0];
    
    if (!fngData) {
      return getSimulatedFearGreed();
    }

    const value = parseInt(fngData.value);
    let sentiment: 'EXTREME_FEAR' | 'FEAR' | 'NEUTRAL' | 'GREED' | 'EXTREME_GREED' = 'NEUTRAL';
    let tradingAdvice = '';

    if (value <= 20) {
      sentiment = 'EXTREME_FEAR';
      tradingAdvice = 'Oportunidade de compra - mercado em pânico. DCA recomendado.';
    } else if (value <= 40) {
      sentiment = 'FEAR';
      tradingAdvice = 'Mercado temeroso - boas oportunidades para longs com cuidado.';
    } else if (value <= 60) {
      sentiment = 'NEUTRAL';
      tradingAdvice = 'Mercado neutro - seguir sinais técnicos.';
    } else if (value <= 80) {
      sentiment = 'GREED';
      tradingAdvice = 'Mercado ganancioso - cuidado com longs, considerar shorts.';
    } else {
      sentiment = 'EXTREME_GREED';
      tradingAdvice = 'Euforia extrema - alto risco para longs, buscar shorts.';
    }

    return {
      value,
      classification: fngData.value_classification,
      sentiment,
      tradingAdvice,
      // Recomendações baseadas no índice
      longBias: value <= 40 ? 'FAVORABLE' : value >= 70 ? 'UNFAVORABLE' : 'NEUTRAL',
      shortBias: value >= 70 ? 'FAVORABLE' : value <= 30 ? 'UNFAVORABLE' : 'NEUTRAL',
      source: 'alternative.me',
      timestamp: fngData.timestamp,
      analyzedAt: new Date().toISOString()
    };
  } catch (error) {
    console.error('Fear & Greed error:', error);
    return getSimulatedFearGreed();
  }
}

// === SIMULAÇÕES (fallback quando APIs não disponíveis) ===

function getSimulatedSentiment(symbol: string) {
  return {
    sentiment: 'NEUTRAL',
    confidence: 40,
    keyNews: ['Dados simulados - API Perplexity indisponível'],
    catalysts: [],
    riskLevel: 'LOW',
    recommendation: 'WAIT',
    reasoning: 'Dados simulados - configure PERPLEXITY_API_KEY para análise real',
    symbol,
    source: 'simulated',
    analyzedAt: new Date().toISOString()
  };
}

function getSimulatedWhaleAlerts(symbols: string[]) {
  return {
    alerts: symbols.slice(0, 3).map(s => ({
      symbol: s.replace('USDT', ''),
      type: Math.random() > 0.5 ? 'ACCUMULATION' : 'DISTRIBUTION',
      amount: `$${Math.floor(Math.random() * 10 + 1)}M`,
      impact: 'NEUTRAL',
      confidence: 50,
      details: 'Dados simulados'
    })),
    overallWhaleDirection: 'MIXED',
    tradingImplication: 'Sem dados reais de whales disponíveis',
    source: 'simulated',
    analyzedAt: new Date().toISOString()
  };
}

function getSimulatedFearGreed() {
  const value = 45 + Math.floor(Math.random() * 20);
  return {
    value,
    classification: 'Neutral',
    sentiment: 'NEUTRAL',
    tradingAdvice: 'Mercado neutro - seguir sinais técnicos.',
    longBias: 'NEUTRAL',
    shortBias: 'NEUTRAL',
    source: 'simulated',
    analyzedAt: new Date().toISOString()
  };
}
