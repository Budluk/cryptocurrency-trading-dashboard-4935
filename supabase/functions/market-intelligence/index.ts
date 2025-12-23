import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// 🔧 Usando LOVABLE_API_KEY (gratuito) em vez de PERPLEXITY_API_KEY
const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

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

// 📰 Buscar análise de sentimento via Lovable AI (Gemini)
async function getNewsSentiment(symbol: string) {
  if (!LOVABLE_API_KEY) {
    console.log('LOVABLE_API_KEY not configured, using simulated data');
    return getSimulatedSentiment(symbol);
  }

  try {
    const cleanSymbol = symbol.replace('USDT', '').replace('USD', '');
    
    console.log(`📰 Analisando sentimento para ${cleanSymbol} via Lovable AI...`);
    
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
            content: `Você é um analista experiente de criptomoedas. Analise o mercado de ${cleanSymbol} com base em seu conhecimento geral do mercado cripto. Responda APENAS em JSON válido, sem markdown ou explicações.` 
          },
          { 
            role: 'user', 
            content: `Forneça uma análise de sentimento para ${cleanSymbol} criptomoeda considerando:
- Tendências gerais do mercado cripto
- Fundamentos do projeto
- Situação macroeconômica
- Padrões típicos de comportamento

Retorne JSON: {
  "sentiment": "BULLISH" ou "BEARISH" ou "NEUTRAL",
  "confidence": 0-100,
  "keyNews": ["análise 1", "análise 2", "análise 3"],
  "catalysts": ["fator positivo/negativo"],
  "riskLevel": "LOW" ou "MEDIUM" ou "HIGH",
  "recommendation": "LONG" ou "SHORT" ou "WAIT",
  "reasoning": "explicação curta baseada em análise geral"
}`
          }
        ],
        max_tokens: 600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Lovable AI API error:', response.status, errorText);
      return getSimulatedSentiment(symbol);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    console.log(`📊 Resposta Lovable AI para ${cleanSymbol}:`, content.substring(0, 200));
    
    // Extrair JSON
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      return {
        ...parsed,
        symbol,
        source: 'lovable-ai',
        analyzedAt: new Date().toISOString()
      };
    }
    
    return getSimulatedSentiment(symbol);
  } catch (error) {
    console.error('News sentiment error:', error);
    return getSimulatedSentiment(symbol);
  }
}

// 🌐 Buscar eventos de mercado via Lovable AI
async function getMarketEvents() {
  if (!LOVABLE_API_KEY) {
    return { events: [], source: 'simulated' };
  }

  try {
    console.log('🌐 Buscando eventos de mercado via Lovable AI...');
    
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
            content: 'Você é um analista de mercado cripto experiente. Forneça análise de eventos que tipicamente afetam o mercado. Responda APENAS em JSON válido.' 
          },
          { 
            role: 'user', 
            content: `Liste 5 tipos de eventos/fatores importantes que geralmente afetam o mercado cripto, com exemplos de como traders devem reagir.
            
Retorne JSON: {
  "events": [
    {
      "title": "tipo de evento",
      "type": "FOMC" ou "CPI" ou "NFP" ou "EARNINGS" ou "CRYPTO_SPECIFIC" ou "OTHER",
      "impact": "HIGH" ou "MEDIUM" ou "LOW",
      "expectedTime": "frequência típica",
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
      }),
    });

    if (!response.ok) {
      console.error('Lovable AI error for market events:', response.status);
      return { events: [], source: 'error' };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        ...JSON.parse(jsonMatch[0]),
        source: 'lovable-ai',
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
  if (!LOVABLE_API_KEY) {
    return { analysis: null, source: 'no_api_key' };
  }

  const cleanSymbol = symbol.replace('USDT', '').replace('USD', '');

  try {
    console.log(`📊 Análise profunda para ${cleanSymbol}...`);
    
    // Primeiro buscar sentimento
    const newsData = await getNewsSentiment(symbol);
    
    // Depois usar Gemini para análise mais profunda
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
            content: 'Você é um trader profissional de criptomoedas. Analise dados e dê recomendações práticas em JSON.' 
          },
          { 
            role: 'user', 
            content: `Baseado nestas informações sobre ${cleanSymbol}:
            
Sentimento: ${newsData.sentiment}
Confiança: ${newsData.confidence}%
Análises: ${JSON.stringify(newsData.keyNews)}
Nível de Risco: ${newsData.riskLevel}

Forneça uma análise de trading:

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
      }),
    });

    if (!response.ok) {
      return { ...newsData, analysis: null };
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        ...newsData,
        analysis: JSON.parse(jsonMatch[0]),
        source: 'lovable-ai',
        analyzedAt: new Date().toISOString()
      };
    }
    
    return { ...newsData, analysis: null };
  } catch (error) {
    console.error('Symbol analysis error:', error);
    return { analysis: null, source: 'error' };
  }
}

// 🐋 Buscar alertas de whales via Lovable AI
async function getWhaleAlerts(symbols: string[]) {
  if (!LOVABLE_API_KEY) {
    return getSimulatedWhaleAlerts(symbols);
  }

  try {
    const symbolList = symbols.slice(0, 5).map(s => s.replace('USDT', '')).join(', ');
    
    console.log(`🐋 Analisando atividade de whales para: ${symbolList}...`);
    
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
            content: 'Você é um analista on-chain de criptomoedas. Forneça análise típica de comportamento de whales. Responda APENAS em JSON válido.' 
          },
          { 
            role: 'user', 
            content: `Analise padrões típicos de movimentação de whales (grandes carteiras) para: ${symbolList}.

Considere:
- Padrões de acumulação/distribuição típicos
- Impacto de grandes movimentações em exchanges
- Comportamento histórico de grandes investidores
            
Retorne JSON: {
  "alerts": [
    {
      "symbol": "BTC",
      "type": "ACCUMULATION" ou "DISTRIBUTION" ou "EXCHANGE_INFLOW" ou "EXCHANGE_OUTFLOW",
      "amount": "valor aproximado em USD",
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
      }),
    });

    if (!response.ok) {
      console.error('Lovable AI error for whale alerts:', response.status);
      return getSimulatedWhaleAlerts(symbols);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content || '';
    
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      return {
        ...JSON.parse(jsonMatch[0]),
        source: 'lovable-ai',
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
  // 🔧 Dados simulados NÃO devem bloquear operações
  // Retornar NEUTRAL com baixa confiança para não interferir no trading
  return {
    sentiment: 'NEUTRAL',
    confidence: 40, // Baixa confiança = não bloqueia
    keyNews: ['Dados simulados - APIs indisponíveis'],
    catalysts: [],
    riskLevel: 'LOW', // LOW para não bloquear
    recommendation: 'WAIT',
    reasoning: 'Dados simulados - APIs indisponíveis',
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
