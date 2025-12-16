import { useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface SignalAnalysisResult {
  action: 'BUY' | 'SELL' | null;
  signalScore: number;
  buyScore: number;
  sellScore: number;
  confirmations: string[];
  shouldTrade: boolean;
  skipReason: string;
  signalQuality: 'low' | 'medium' | 'high' | 'premium';
  momentumScore: number;
  m1Signal?: 'buy' | 'sell' | 'hold';
  m5Support?: number;
  m5Resistance?: number;
  compositeScore?: number;
  aiConfidence?: number;
}

interface AnalysisParams {
  currentPrice: number;
  highPrice: number;
  lowPrice: number;
  priceChange: number;
  volume24h: number;
  volatility: number;
  scoreThreshold: number;
  minConfirmations: number;
  currentBalance: number;
  comprehensiveAI?: {
    compositeScore: number;
    scalpingConfig: {
      action: 'buy' | 'sell' | 'wait';
      confidence: number;
      support5m: number;
      resistance5m: number;
    };
    technical: {
      m1: { signal: string; rsi: number; score: number };
      m5: { trend: string; support: number; resistance: number };
      alignment: string;
    };
    sentiment: { fearGreedIndex: number; signal: string };
    onChain: { signal: string; fundingRate: number };
  };
}

export const useSignalAnalysis = () => {
  const lastAIFetch = useRef<Map<string, number>>(new Map());
  const aiCache = useRef<Map<string, any>>(new Map());

  const fetchComprehensiveAI = useCallback(async (symbol: string): Promise<any | null> => {
    const now = Date.now();
    const lastFetch = lastAIFetch.current.get(symbol) || 0;
    
    if (now - lastFetch < 30000 && aiCache.current.has(symbol)) {
      return aiCache.current.get(symbol);
    }
    
    try {
      const { data, error } = await supabase.functions.invoke('ai-comprehensive-analysis', {
        body: { symbol },
      });
      
      if (!error && data?.success && data?.analysis) {
        lastAIFetch.current.set(symbol, now);
        aiCache.current.set(symbol, data.analysis);
        return data.analysis;
      }
    } catch (e) {
      console.log(`⚠️ AI fetch failed for ${symbol}`);
    }
    return null;
  }, []);

  const analyzeSignal = useCallback((params: AnalysisParams): SignalAnalysisResult => {
    const {
      currentPrice, highPrice, lowPrice, priceChange,
      volume24h, volatility, scoreThreshold, minConfirmations, currentBalance,
      comprehensiveAI
    } = params;

    const priceRange = highPrice - lowPrice;
    const atrPercent = (priceRange / currentPrice) * 100;
    const pricePosition = priceRange > 0 ? (currentPrice - lowPrice) / priceRange : 0.5;
    
    // === VALIDAÇÕES BASE ===
    const hasMinVolume = volume24h > 80000;       // Mínimo 80k
    const hasGoodVolume = volume24h > 300000;     // 300k para confirmação
    const hasStrongVolume = volume24h > 700000;   // 700k para boost
    const hasVolumeSpike = volume24h > 1500000;   // 1.5M para spike
    
    // Volatilidade ideal para scalping
    const volInRange = volatility > 0.5 && volatility < 18;
    const volIdeal = volatility > 1.5 && volatility < 10;
    
    // === ANÁLISE DE TENDÊNCIA ===
    const strongBullish = priceChange > 2.5;
    const bullish = priceChange > 1.2;
    const mildBullish = priceChange > 0.5;
    
    const strongBearish = priceChange < -2.5;
    const bearish = priceChange < -1.2;
    const mildBearish = priceChange < -0.5;
    
    // === ZONAS DE S/R (preço na faixa do dia) ===
    let nearSupport = pricePosition < 0.20;
    let nearResistance = pricePosition > 0.80;
    let inMiddle = pricePosition >= 0.35 && pricePosition <= 0.65;
    
    // Usar S/R de 5m quando disponível (mais preciso)
    if (comprehensiveAI?.scalpingConfig) {
      const { support5m, resistance5m } = comprehensiveAI.scalpingConfig;
      if (support5m > 0 && resistance5m > 0) {
        const range5m = resistance5m - support5m;
        if (range5m > 0) {
          const pos5m = (currentPrice - support5m) / range5m;
          nearSupport = pos5m < 0.20;
          nearResistance = pos5m > 0.80;
          inMiddle = pos5m >= 0.35 && pos5m <= 0.65;
        }
      }
    }
    
    // === CONDIÇÕES DE REVERSÃO ===
    const oversold = priceChange < -4.0;
    const mildOversold = priceChange < -2.5 && priceChange >= -4.0;
    const overbought = priceChange > 4.0;
    const mildOverbought = priceChange > 2.5 && priceChange <= 4.0;
    
    const confirmations: string[] = [];
    
    // === PONTUAÇÃO BUY ===
    let buyScore = 0;
    
    // 1. Tendência + Volume (máximo 35 pontos)
    if (strongBullish && hasVolumeSpike) {
      buyScore += 35;
      confirmations.push('📈 Tendência forte + volume spike');
    } else if (bullish && hasStrongVolume) {
      buyScore += 28;
      confirmations.push('📈 Tendência bullish confirmada');
    } else if (bullish && hasGoodVolume) {
      buyScore += 22;
      confirmations.push('📈 Tendência bullish');
    } else if (mildBullish && hasStrongVolume) {
      buyScore += 18;
      confirmations.push('Momentum bullish + volume');
    }
    
    // 2. Reversão em suporte (máximo 40 pontos)
    if (oversold && nearSupport && hasVolumeSpike) {
      buyScore += 40;
      confirmations.push('🔄 Reversão forte no suporte');
    } else if (mildOversold && nearSupport && hasStrongVolume) {
      buyScore += 32;
      confirmations.push('🔄 Reversão no suporte');
    } else if (nearSupport && !bearish && hasGoodVolume) {
      buyScore += 20;
      confirmations.push('📍 Zona de suporte + volume');
    }
    
    // 3. Momentum (máximo 20 pontos)
    if (pricePosition > 0.55 && mildBullish && volIdeal) {
      buyScore += 20;
      confirmations.push('⚡ Momentum forte');
    } else if (pricePosition > 0.45 && priceChange > 0.3 && volInRange) {
      buyScore += 12;
      confirmations.push('Momentum positivo');
    }
    
    // 4. ATR ideal (máximo 15 pontos)
    if (atrPercent > 1.5 && atrPercent < 6) {
      buyScore += 15;
      confirmations.push('ATR ideal para scalp');
    } else if (atrPercent > 0.8 && atrPercent < 10) {
      buyScore += 8;
    }
    
    // === PONTUAÇÃO SELL ===
    let sellScore = 0;
    
    // 1. Tendência + Volume
    if (strongBearish && hasVolumeSpike) {
      sellScore += 35;
      confirmations.push('📉 Tendência forte + volume spike');
    } else if (bearish && hasStrongVolume) {
      sellScore += 28;
      confirmations.push('📉 Tendência bearish confirmada');
    } else if (bearish && hasGoodVolume) {
      sellScore += 22;
      confirmations.push('📉 Tendência bearish');
    } else if (mildBearish && hasStrongVolume) {
      sellScore += 18;
      confirmations.push('Momentum bearish + volume');
    }
    
    // 2. Reversão em resistência
    if (overbought && nearResistance && hasVolumeSpike) {
      sellScore += 40;
      confirmations.push('🔄 Reversão forte na resistência');
    } else if (mildOverbought && nearResistance && hasStrongVolume) {
      sellScore += 32;
      confirmations.push('🔄 Reversão na resistência');
    } else if (nearResistance && !bullish && hasGoodVolume) {
      sellScore += 20;
      confirmations.push('📍 Zona de resistência + volume');
    }
    
    // 3. Momentum
    if (pricePosition < 0.45 && mildBearish && volIdeal) {
      sellScore += 20;
      confirmations.push('⚡ Momentum bearish forte');
    } else if (pricePosition < 0.55 && priceChange < -0.3 && volInRange) {
      sellScore += 12;
      confirmations.push('Momentum negativo');
    }
    
    // 4. ATR
    if (atrPercent > 1.5 && atrPercent < 6) {
      sellScore += 15;
    } else if (atrPercent > 0.8 && atrPercent < 10) {
      sellScore += 8;
    }
    
    // === AI BOOST (mais seletivo) ===
    let aiBoost = 0;
    let m1Signal: 'buy' | 'sell' | 'hold' | undefined;
    let m5Support: number | undefined;
    let m5Resistance: number | undefined;
    let compositeScore: number | undefined;
    let aiConfidence: number | undefined;
    
    if (comprehensiveAI) {
      compositeScore = comprehensiveAI.compositeScore;
      aiConfidence = comprehensiveAI.scalpingConfig?.confidence;
      m5Support = comprehensiveAI.scalpingConfig?.support5m;
      m5Resistance = comprehensiveAI.scalpingConfig?.resistance5m;
      m1Signal = comprehensiveAI.technical?.m1?.signal as any;
      
      // Só boost quando AI está confiante E alinhada com análise técnica
      if (compositeScore !== undefined && aiConfidence && aiConfidence > 60) {
        if (compositeScore > 35 && buyScore > sellScore) {
          buyScore += 20;
          confirmations.push(`🤖 AI bullish: ${compositeScore.toFixed(0)}%`);
          aiBoost = 20;
        } else if (compositeScore < -35 && sellScore > buyScore) {
          sellScore += 20;
          confirmations.push(`🤖 AI bearish: ${compositeScore.toFixed(0)}%`);
          aiBoost = 20;
        }
      }
      
      // On-chain alignment (só quando forte)
      if (comprehensiveAI.onChain?.signal === 'bullish' && buyScore > sellScore) {
        buyScore += 10;
        confirmations.push('📊 On-Chain bullish');
      } else if (comprehensiveAI.onChain?.signal === 'bearish' && sellScore > buyScore) {
        sellScore += 10;
        confirmations.push('📊 On-Chain bearish');
      }
      
      // Funding rate (contrarian só em extremos)
      const funding = comprehensiveAI.onChain?.fundingRate || 0;
      if (funding > 0.05 && sellScore > buyScore) {
        sellScore += 8;
        confirmations.push('💰 Funding muito alto');
      } else if (funding < -0.03 && buyScore > sellScore) {
        buyScore += 8;
        confirmations.push('💰 Funding negativo');
      }
      
      // Sentiment (contrarian só em extremos)
      const fgi = comprehensiveAI.sentiment?.fearGreedIndex || 50;
      if (fgi < 20 && buyScore > sellScore) {
        buyScore += 12;
        confirmations.push('😱 Fear extremo');
      } else if (fgi > 80 && sellScore > buyScore) {
        sellScore += 12;
        confirmations.push('🤑 Greed extremo');
      }
      
      // 1m signal (só quando alinhado)
      if (m1Signal === 'buy' && buyScore > sellScore) {
        buyScore += 10;
        confirmations.push('📈 1m BUY');
      } else if (m1Signal === 'sell' && sellScore > buyScore) {
        sellScore += 10;
        confirmations.push('📉 1m SELL');
      }
      
      // Timeframe alignment
      const alignment = comprehensiveAI.technical?.alignment;
      if (alignment === 'strong_buy' && buyScore > sellScore) {
        buyScore += 15;
        confirmations.push('✅ TFs alinhados BUY');
      } else if (alignment === 'strong_sell' && sellScore > buyScore) {
        sellScore += 15;
        confirmations.push('✅ TFs alinhados SELL');
      }
    }
    
    // === DETERMINAR AÇÃO ===
    const scoreDiff = Math.abs(buyScore - sellScore);
    const minDiff = 8; // Diferença mínima menor para mais trades
    
    let action: 'BUY' | 'SELL' | null = null;
    let signalScore = 0;
    
    // Entrar quando há direção clara
    if (scoreDiff >= minDiff) {
      if (buyScore > sellScore && buyScore >= scoreThreshold) {
        action = 'BUY';
        signalScore = buyScore;
      } else if (sellScore > buyScore && sellScore >= scoreThreshold) {
        action = 'SELL';
        signalScore = sellScore;
      }
    }
    
    // === FILTROS DE QUALIDADE ===
    const volumeOk = hasMinVolume;
    const volatilityOk = volInRange;
    const atrOk = atrPercent > 0.3 && atrPercent < 15;
    const priceMovementOk = Math.abs(priceChange) > 0.3 && Math.abs(priceChange) < 15;
    
    // Momentum Score (mais permissivo)
    const momentumScore = Math.abs(priceChange) * (hasVolumeSpike ? 2.5 : hasStrongVolume ? 1.8 : hasGoodVolume ? 1.3 : 1);
    const momentumOk = momentumScore > 0.8;
    
    // Direção do volume (reversões permitidas em S/R)
    const isReversal = (
      (action === 'BUY' && (oversold || mildOversold) && nearSupport) ||
      (action === 'SELL' && (overbought || mildOverbought) && nearResistance)
    );
    
    const volumeDirectionOk = isReversal ||
      (action === 'BUY' && priceChange > 0.3) ||
      (action === 'SELL' && priceChange < -0.3);
    
    // Permitir entrada no meio se score forte
    const positionOk = !inMiddle || scoreDiff >= 15 || isReversal || signalScore >= 60;
    
    // Classificação de qualidade (mais permissivo)
    let signalQuality: 'low' | 'medium' | 'high' | 'premium' = 'low';
    if (signalScore >= 75 && hasVolumeSpike && momentumOk && !inMiddle) signalQuality = 'premium';
    else if (signalScore >= 55 && hasStrongVolume && momentumOk) signalQuality = 'high';
    else if (signalScore >= 40 && hasGoodVolume) signalQuality = 'medium';
    else if (signalScore >= 35 && hasMinVolume) signalQuality = 'medium'; // novo tier
    
    // AI upgrade
    if (aiBoost >= 10 && signalQuality === 'low') signalQuality = 'medium';
    if (aiBoost >= 15 && signalQuality === 'medium') signalQuality = 'high';
    if (aiConfidence && aiConfidence > 70 && signalQuality !== 'premium') signalQuality = 'high';
    
    // === DECISÃO FINAL (mais permissivo) ===
    const shouldTrade = (
      action !== null &&
      signalScore >= scoreThreshold &&
      scoreDiff >= minDiff &&
      currentBalance > 2 &&
      confirmations.length >= Math.max(1, minConfirmations - 1) &&
      volumeOk &&
      volatilityOk &&
      atrOk &&
      priceMovementOk &&
      (momentumOk || signalScore >= 50) && // momentum ou score alto
      (volumeDirectionOk || isReversal || signalScore >= 55) && // mais flexível
      positionOk &&
      signalQuality !== 'low'
    );

    // Skip reason
    let skipReason = '';
    if (!shouldTrade) {
      if (action === null) skipReason = 'Sem sinal claro';
      else if (signalScore < scoreThreshold) skipReason = `Score ${signalScore}/${scoreThreshold}`;
      else if (scoreDiff < minDiff) skipReason = `Diff ${scoreDiff}/${minDiff}`;
      else if (!volumeDirectionOk) skipReason = 'Volume contra direção';
      else if (!momentumOk) skipReason = `Momentum ${momentumScore.toFixed(1)} < 1.5`;
      else if (!positionOk) skipReason = 'Preço no meio do range';
      else if (signalQuality === 'low') skipReason = 'Qualidade baixa';
      else if (!volumeOk) skipReason = `Vol $${(volume24h/1e6).toFixed(2)}M < $0.15M`;
      else if (!volatilityOk) skipReason = `Volatility ${volatility.toFixed(1)}%`;
      else if (!atrOk) skipReason = `ATR ${atrPercent.toFixed(1)}%`;
      else if (!priceMovementOk) skipReason = `Move ${priceChange.toFixed(1)}%`;
      else if (currentBalance <= 3) skipReason = `Saldo $${currentBalance.toFixed(2)}`;
      else if (confirmations.length < minConfirmations) skipReason = `Conf ${confirmations.length}/${minConfirmations}`;
      else skipReason = 'Filtro geral';
    }

    return {
      action,
      signalScore,
      buyScore,
      sellScore,
      confirmations,
      shouldTrade,
      skipReason,
      signalQuality,
      momentumScore,
      m1Signal,
      m5Support,
      m5Resistance,
      compositeScore,
      aiConfidence,
    };
  }, []);

  return { analyzeSignal, fetchComprehensiveAI };
};
