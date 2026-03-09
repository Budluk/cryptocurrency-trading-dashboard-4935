import { useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { getUserId } from '@/lib/anonymousUser';

interface PositionData {
  symbol: string;
  side: string;
  size: number;
  entryPrice: number;
  currentPrice: number;
  unrealizedPnl: number;
  leverage: number;
  positionId?: string;
}

interface TrailingStopConfig {
  activationPct: number;
  trailingPct: number;
  breakEvenPct: number;
}

interface PartialExitConfig {
  levels: { pct: number; size: number }[];
}

interface SmartExitState {
  highestPrice: Map<string, number>;
  lowestPrice: Map<string, number>;
  trailingActive: Map<string, boolean>;
  partialExitsExecuted: Map<string, number[]>;
  breakEvenActivated: Map<string, boolean>;
  lastPrices: Map<string, number[]>; // v12: track price momentum
}

export function useSmartExitManager() {
  const { toast } = useToast();
  
  const [exitState, setExitState] = useState<SmartExitState>({
    highestPrice: new Map(),
    lowestPrice: new Map(),
    trailingActive: new Map(),
    partialExitsExecuted: new Map(),
    breakEvenActivated: new Map(),
    lastPrices: new Map(),
  });

  // ============================================================
  // v12: TRAILING PROGRESSIVO MELHORADO
  // Mais níveis, aperta proporcional ao lucro
  // ============================================================
  const getProgressiveTrailingPct = useCallback((profitPct: number): number => {
    if (profitPct >= 4.0) return 0.15; // Lucro grande → stop ultra apertado
    if (profitPct >= 3.0) return 0.20;
    if (profitPct >= 2.0) return 0.25;
    if (profitPct >= 1.5) return 0.30;
    if (profitPct >= 1.0) return 0.35;
    if (profitPct >= 0.6) return 0.40;
    if (profitPct >= 0.4) return 0.45;
    return 0.50;
  }, []);

  // v12: Trailing config adaptativo — breakeven rápido em 0.25%
  const getAdaptiveTrailingConfig = useCallback((volatility: number, _mlConfig: any, profitPct?: number): TrailingStopConfig => {
    let baseConfig: TrailingStopConfig;

    // v12: breakeven mais cedo (0.25%), trailing ativa mais cedo
    if (volatility < 2) {
      baseConfig = { activationPct: 0.5, trailingPct: 0.45, breakEvenPct: 0.25 };
    } else if (volatility < 5) {
      baseConfig = { activationPct: 0.6, trailingPct: 0.50, breakEvenPct: 0.30 };
    } else {
      baseConfig = { activationPct: 0.8, trailingPct: 0.55, breakEvenPct: 0.35 };
    }

    // Aplicar trailing progressivo se já tem lucro
    if (profitPct && profitPct > 0.3) {
      baseConfig.trailingPct = getProgressiveTrailingPct(profitPct);
    }

    return baseConfig;
  }, [getProgressiveTrailingPct]);

  // ============================================================
  // v12: SAÍDAS PARCIAIS EM 3 NÍVEIS
  // Protege lucro mais cedo sem cortar potencial
  // ============================================================
  const getPartialExitConfig = useCallback((_mlConfig: any): PartialExitConfig => {
    return {
      levels: [
        { pct: 0.35, size: 0.30 }, // Nível 1: 30% da posição a 0.35% lucro
        { pct: 0.60, size: 0.35 }, // Nível 2: 35% a 0.6% lucro
        { pct: 0.80, size: 0.35 }, // Nível 3: 35% restante a 0.8% (= TP)
      ],
    };
  }, []);

  // Calcular lucro % (preço puro, sem alavancagem)
  const calculateProfitPct = useCallback((position: PositionData): number => {
    const priceDiff = position.side === 'Buy' 
      ? position.currentPrice - position.entryPrice
      : position.entryPrice - position.currentPrice;
    return (priceDiff / position.entryPrice) * 100;
  }, []);

  // v12: Detectar perda de momentum (preço caindo após pico)
  const detectMomentumLoss = useCallback((position: PositionData): boolean => {
    const key = position.symbol;
    const highest = exitState.highestPrice.get(key) || position.entryPrice;
    const profitFromPeak = position.side === 'Buy'
      ? ((position.currentPrice - highest) / highest) * 100
      : ((highest - position.currentPrice) / highest) * 100;
    
    // Se caiu mais de 0.25% do pico E já teve lucro → momentum perdido
    const currentProfit = calculateProfitPct(position);
    return currentProfit > 0.1 && profitFromPeak < -0.25;
  }, [exitState.highestPrice, calculateProfitPct]);

  // Verificar e executar saída parcial (v12: 3 níveis)
  const checkPartialExit = useCallback(async (
    position: PositionData,
    config: PartialExitConfig
  ): Promise<{ executed: boolean; level: number }> => {
    const key = position.symbol;
    const executed = exitState.partialExitsExecuted.get(key) || [];
    const profitPct = calculateProfitPct(position);

    for (let i = 0; i < config.levels.length; i++) {
      const levelNum = i + 1;
      const level = config.levels[i];
      
      if (profitPct >= level.pct && !executed.includes(levelNum)) {
        // Buscar instrumento para qtyStep
        const { data: instData } = await supabase.functions.invoke('bybit-trading', {
          body: { action: 'get_instruments', isTestnet: false, params: { category: 'linear', symbol: position.symbol } }
        });
        
        const instrument = instData?.data?.list?.[0];
        const lotSizeFilter = instrument?.lotSizeFilter || {};
        const qtyStep = parseFloat(lotSizeFilter.qtyStep || '0.001');
        const minOrderQty = parseFloat(lotSizeFilter.minOrderQty || '0.001');
        
        let exitQty = Math.floor((position.size * level.size) / qtyStep) * qtyStep;
        exitQty = Math.max(exitQty, minOrderQty);
        
        // Para último nível, fechar todo o restante
        if (levelNum === config.levels.length) {
          exitQty = position.size;
        }
        
        const qtyStepStr = qtyStep.toString();
        const decimalPlaces = qtyStepStr.includes('.') ? qtyStepStr.split('.')[1].length : 0;
        const exitQtyStr = exitQty.toFixed(decimalPlaces);
        
        console.log(`📊 SAÍDA PARCIAL ${levelNum}/3: ${position.symbol} - ${(level.size * 100).toFixed(0)}% @ ${profitPct.toFixed(2)}% lucro`);
        
        try {
          const { data, error } = await supabase.functions.invoke('bybit-trading', {
            body: {
              action: 'place_order',
              isTestnet: false,
              params: {
                category: 'linear',
                symbol: position.symbol,
                side: position.side === 'Buy' ? 'Sell' : 'Buy',
                orderType: 'Market',
                qty: exitQtyStr,
                reduceOnly: true,
                positionIdx: 0,
              }
            }
          });

          if (!error && data?.success) {
            setExitState(prev => {
              const newExecuted = new Map(prev.partialExitsExecuted);
              newExecuted.set(key, [...executed, levelNum]);
              return { ...prev, partialExitsExecuted: newExecuted };
            });

            toast({
              title: levelNum === 3 ? "✅ Posição Fechada" : `📊 Saída Parcial ${levelNum}/3`,
              description: `${position.symbol}: ${(level.size * 100).toFixed(0)}% @ ${profitPct.toFixed(2)}% lucro`,
            });

            await logPartialExit(position, levelNum, profitPct, exitQty);
            return { executed: true, level: levelNum };
          }
        } catch (err) {
          console.error(`Erro na saída parcial ${levelNum}:`, err);
        }
      }
    }

    return { executed: false, level: 0 };
  }, [exitState, toast, calculateProfitPct]);

  // Calcular trailing stop dinâmico
  const calculateTrailingStop = useCallback((
    position: PositionData,
    config: TrailingStopConfig
  ): { newStop: number | null; shouldActivate: boolean; isBreakeven: boolean } => {
    const key = position.symbol;
    const profitPct = calculateProfitPct(position);
    const isActive = exitState.trailingActive.get(key) || false;
    const isBreakeven = exitState.breakEvenActivated.get(key) || false;

    const highest = exitState.highestPrice.get(key) || position.entryPrice;
    const lowest = exitState.lowestPrice.get(key) || position.entryPrice;

    let newHighest = highest;
    let newLowest = lowest;

    if (position.side === 'Buy') {
      if (position.currentPrice > highest) {
        newHighest = position.currentPrice;
        setExitState(prev => {
          const newMap = new Map(prev.highestPrice);
          newMap.set(key, newHighest);
          return { ...prev, highestPrice: newMap };
        });
      }
    } else {
      if (position.currentPrice < lowest || lowest === position.entryPrice) {
        newLowest = position.currentPrice;
        setExitState(prev => {
          const newMap = new Map(prev.lowestPrice);
          newMap.set(key, newLowest);
          return { ...prev, lowestPrice: newMap };
        });
      }
    }

    // v12: Breakeven mais rápido (0.25%)
    if (!isBreakeven && profitPct >= config.breakEvenPct) {
      setExitState(prev => {
        const newMap = new Map(prev.breakEvenActivated);
        newMap.set(key, true);
        return { ...prev, breakEvenActivated: newMap };
      });
      
      const breakEvenStop = position.side === 'Buy'
        ? position.entryPrice * 1.0005 // +0.05% margem
        : position.entryPrice * 0.9995;

      console.log(`🛡️ BREAKEVEN ${position.symbol}: Stop → ${breakEvenStop.toFixed(4)} @ ${profitPct.toFixed(2)}% lucro`);
      return { newStop: breakEvenStop, shouldActivate: false, isBreakeven: true };
    }

    // Ativação do trailing
    if (!isActive && profitPct >= config.activationPct) {
      setExitState(prev => {
        const newMap = new Map(prev.trailingActive);
        newMap.set(key, true);
        return { ...prev, trailingActive: newMap };
      });
      
      console.log(`🎯 TRAILING ON ${position.symbol}: @ ${profitPct.toFixed(2)}% lucro`);
      return { newStop: null, shouldActivate: true, isBreakeven: false };
    }

    // Se trailing ativo, calcular novo stop progressivo
    if (isActive) {
      const trailingPct = getProgressiveTrailingPct(profitPct);
      const trailingDistance = trailingPct / 100;
      
      const newStop = position.side === 'Buy'
        ? newHighest * (1 - trailingDistance)
        : newLowest * (1 + trailingDistance);

      return { newStop, shouldActivate: false, isBreakeven: false };
    }

    return { newStop: null, shouldActivate: false, isBreakeven: false };
  }, [exitState, calculateProfitPct, getProgressiveTrailingPct]);

  const logPartialExit = async (position: PositionData, level: number, profitPct: number, qty: number) => {
    const userId = await getUserId();
    await supabase.from('auto_trader_logs').insert({
      user_id: userId,
      log_type: 'PARTIAL_EXIT',
      message: `Saída parcial ${level}/3: ${position.symbol} - ${qty} unidades @ ${profitPct.toFixed(2)}% lucro`,
      symbol: position.symbol,
      metadata: { level, profitPct, qty, side: position.side, entryPrice: position.entryPrice, exitPrice: position.currentPrice }
    });
  };

  // ============================================================
  // v12: TIME-BASED EXITS COM DETECÇÃO DE MOMENTUM
  // Mais inteligente — considera tendência recente
  // ============================================================
  const checkTimeBasedExit = useCallback(async (
    position: PositionData & { openedAt?: string }
  ): Promise<boolean> => {
    if (!position.openedAt) return false;
    
    const openTime = new Date(position.openedAt).getTime();
    const now = Date.now();
    const minutesOpen = (now - openTime) / (1000 * 60);
    const profitPct = calculateProfitPct(position);
    const momentumLost = detectMomentumLoss(position);
    
    // v12: Regras de tempo mais inteligentes
    const shouldClose = 
      // 1. Momentum perdido após ter lucro → fechar rápido (qualquer tempo)
      (minutesOpen > 3 && momentumLost && profitPct < 0.15) ||
      // 2. 5min com prejuízo crescente → cortar loss cedo
      (minutesOpen > 5 && profitPct < -0.15) ||
      // 3. 7min flat (sem direção) → capital preso
      (minutesOpen > 7 && Math.abs(profitPct) < 0.08) ||
      // 4. 10min com qualquer prejuízo → fechar
      (minutesOpen > 10 && profitPct < 0) ||
      // 5. 12min hard cap (exceto se lucro > 0.3%)
      (minutesOpen > 12 && profitPct < 0.3);
    
    if (!shouldClose) return false;
    
    let reason = '';
    if (momentumLost) reason = `⚡ MOMENTUM LOST: ${position.symbol} @ ${profitPct.toFixed(2)}%`;
    else if (profitPct < 0) reason = `⏰ TIME CUT: ${position.symbol} ${minutesOpen.toFixed(0)}min @ ${profitPct.toFixed(2)}%`;
    else reason = `⏰ TIME FLAT: ${position.symbol} ${minutesOpen.toFixed(0)}min @ ${profitPct.toFixed(2)}%`;
    
    console.log(reason);
    
    try {
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'place_order',
          isTestnet: false,
          params: {
            category: 'linear',
            symbol: position.symbol,
            side: position.side === 'Buy' ? 'Sell' : 'Buy',
            orderType: 'Market',
            qty: String(position.size),
            reduceOnly: true,
            positionIdx: 0,
          }
        }
      });
      
      if (!error && data?.success) {
        const userId = await getUserId();
        await supabase.from('auto_trader_logs').insert({
          user_id: userId,
          log_type: 'TIME_EXIT',
          message: reason,
          symbol: position.symbol,
          metadata: { minutesOpen, profitPct, side: position.side, momentumLost }
        });
        
        toast({
          title: momentumLost ? "⚡ Momentum Perdido" : "⏰ Saída por Tempo",
          description: `${position.symbol}: ${profitPct.toFixed(2)}% após ${minutesOpen.toFixed(0)}min`,
        });
        return true;
      }
    } catch (err) {
      console.error('Erro na saída por tempo:', err);
    }
    return false;
  }, [calculateProfitPct, detectMomentumLoss, toast]);

  // Processar todas as posições abertas
  const processOpenPositions = useCallback(async (
    positions: PositionData[],
    mlConfig: any,
    volatilityMap: Map<string, number>,
    options?: { enablePartialExit?: boolean; openedAtMap?: Map<string, string> }
  ) => {
    const results = [];
    const shouldUsePartialExit = options?.enablePartialExit ?? true;

    for (const position of positions) {
      // ⏰ Verificar saída por tempo PRIMEIRO
      const openedAt = options?.openedAtMap?.get(`${position.symbol}-${position.side}`);
      const timeExited = await checkTimeBasedExit({ ...position, openedAt });
      if (timeExited) {
        results.push({ symbol: position.symbol, action: 'TIME_EXIT' });
        continue;
      }

      const volatility = volatilityMap.get(position.symbol) || 2;
      const currentProfit = calculateProfitPct(position);
      const trailingConfig = getAdaptiveTrailingConfig(volatility, mlConfig, currentProfit);
      const partialConfig = getPartialExitConfig(mlConfig);

      // Verificar saída parcial
      if (shouldUsePartialExit) {
        const partialResult = await checkPartialExit(position, partialConfig);
        if (partialResult.executed) {
          results.push({ symbol: position.symbol, action: 'PARTIAL_EXIT', level: partialResult.level });
          continue;
        }
      }

      // Calcular trailing stop
      const trailingResult = calculateTrailingStop(position, trailingConfig);

      if (trailingResult.newStop) {
        try {
          await supabase.functions.invoke('bybit-trading', {
            body: {
              action: 'set_trading_stop',
              isTestnet: false,
              params: {
                category: 'linear',
                symbol: position.symbol,
                stopLoss: trailingResult.newStop.toFixed(4),
                slTriggerBy: 'MarkPrice',
                positionIdx: 0,
              }
            }
          });

          results.push({
            symbol: position.symbol,
            action: trailingResult.isBreakeven ? 'BREAKEVEN' : 'TRAILING_UPDATE',
            newStop: trailingResult.newStop,
          });

          console.log(`✅ Stop ${trailingResult.isBreakeven ? 'BE' : 'TRAIL'} ${position.symbol}: ${trailingResult.newStop.toFixed(4)}`);
        } catch (err) {
          console.error(`Erro ao atualizar stop ${position.symbol}:`, err);
        }
      }
    }

    return results;
  }, [getAdaptiveTrailingConfig, getPartialExitConfig, checkPartialExit, calculateTrailingStop, checkTimeBasedExit, calculateProfitPct]);

  // Limpar estado de posição fechada
  const clearPositionState = useCallback((symbol: string) => {
    setExitState(prev => {
      const newHighest = new Map(prev.highestPrice);
      const newLowest = new Map(prev.lowestPrice);
      const newTrailing = new Map(prev.trailingActive);
      const newPartial = new Map(prev.partialExitsExecuted);
      const newBreakeven = new Map(prev.breakEvenActivated);
      const newLastPrices = new Map(prev.lastPrices);

      newHighest.delete(symbol);
      newLowest.delete(symbol);
      newTrailing.delete(symbol);
      newPartial.delete(symbol);
      newBreakeven.delete(symbol);
      newLastPrices.delete(symbol);

      return {
        highestPrice: newHighest,
        lowestPrice: newLowest,
        trailingActive: newTrailing,
        partialExitsExecuted: newPartial,
        breakEvenActivated: newBreakeven,
        lastPrices: newLastPrices,
      };
    });
  }, []);

  return {
    exitState,
    processOpenPositions,
    clearPositionState,
    calculateProfitPct,
    getAdaptiveTrailingConfig,
    getPartialExitConfig,
  };
}
