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
  activationPct: number; // % de lucro para ativar trailing (ex: 1%)
  trailingPct: number; // % de recuo para stop (ex: 0.5%)
  breakEvenPct: number; // % de lucro para mover stop para breakeven
}

interface PartialExitConfig {
  firstExitPct: number; // % de lucro para primeira saída (ex: 1.5%)
  firstExitSize: number; // % da posição para fechar (ex: 0.5 = 50%)
  secondExitPct: number; // % de lucro para segunda saída (ex: 3%)
  secondExitSize: number; // % restante para fechar
}

interface SmartExitState {
  highestPrice: Map<string, number>;
  lowestPrice: Map<string, number>;
  trailingActive: Map<string, boolean>;
  partialExitsExecuted: Map<string, number[]>;
  breakEvenActivated: Map<string, boolean>;
}

export function useSmartExitManager() {
  const { toast } = useToast();
  
  const [exitState, setExitState] = useState<SmartExitState>({
    highestPrice: new Map(),
    lowestPrice: new Map(),
    trailingActive: new Map(),
    partialExitsExecuted: new Map(),
    breakEvenActivated: new Map(),
  });

  // Configurações de trailing stop MAIS AGRESSIVAS - breakeven cedo
  const getAdaptiveTrailingConfig = useCallback((volatility: number, mlConfig: any, profitPct?: number): TrailingStopConfig => {
    // Se já tem lucro, apertar ainda mais
    const hasProfit = profitPct && profitPct > 0;
    
    // Se ML está ativo, usar recomendações com ajustes
    if (mlConfig?.is_enabled && mlConfig?.optimal_patterns?.dynamicStops) {
      const dynamicStops = mlConfig.optimal_patterns.dynamicStops;
      
      // Selecionar config baseado na volatilidade - BREAKEVEN MAIS CEDO
      if (volatility < 2) {
        return {
          activationPct: hasProfit ? 0.15 : 0.25, // Ativa mais cedo
          trailingPct: Math.min(dynamicStops.lowVolatility || 0.3, 0.25),
          breakEvenPct: 0.15, // Breakeven com apenas 0.15% lucro
        };
      } else if (volatility < 5) {
        return {
          activationPct: hasProfit ? 0.2 : 0.35,
          trailingPct: Math.min(dynamicStops.mediumVolatility || 0.4, 0.35),
          breakEvenPct: 0.2,
        };
      } else {
        return {
          activationPct: hasProfit ? 0.3 : 0.5,
          trailingPct: Math.min(dynamicStops.highVolatility || 0.6, 0.5),
          breakEvenPct: 0.25,
        };
      }
    }

    // Fallback sem ML - MAIS CONSERVADOR
    if (volatility < 2) {
      return { 
        activationPct: 0.25, 
        trailingPct: 0.2, 
        breakEvenPct: 0.15 // Breakeven com 0.15%
      };
    } else if (volatility < 5) {
      return { 
        activationPct: 0.35, 
        trailingPct: 0.3, 
        breakEvenPct: 0.2 
      };
    } else {
      return { 
        activationPct: 0.5, 
        trailingPct: 0.4, 
        breakEvenPct: 0.25 
      };
    }
  }, []);

  // Configurações de saída parcial baseadas em ML
  const getPartialExitConfig = useCallback((mlConfig: any): PartialExitConfig => {
    if (mlConfig?.is_enabled && mlConfig?.optimal_patterns?.dynamicTP) {
      const dynamicTP = mlConfig.optimal_patterns.dynamicTP;
      return {
        firstExitPct: dynamicTP.lowVolatility || 1.5,
        firstExitSize: 0.5, // 50% da posição
        secondExitPct: dynamicTP.mediumVolatility || 3.0,
        secondExitSize: 0.5, // 50% restante
      };
    }

    // Config padrão
    return {
      firstExitPct: 1.5,
      firstExitSize: 0.5,
      secondExitPct: 3.0,
      secondExitSize: 0.5,
    };
  }, []);

  // Calcular lucro % atual de uma posição
  const calculateProfitPct = useCallback((position: PositionData): number => {
    const priceDiff = position.side === 'Buy' 
      ? position.currentPrice - position.entryPrice
      : position.entryPrice - position.currentPrice;
    
    return (priceDiff / position.entryPrice) * 100 * position.leverage;
  }, []);

  // Verificar e executar saída parcial
  const checkPartialExit = useCallback(async (
    position: PositionData,
    config: PartialExitConfig
  ): Promise<{ executed: boolean; level: number }> => {
    const key = position.symbol;
    const executed = exitState.partialExitsExecuted.get(key) || [];
    const profitPct = calculateProfitPct(position);

    // Primeira saída: 50% quando atingir firstExitPct
    if (profitPct >= config.firstExitPct && !executed.includes(1)) {
      const exitQty = position.size * config.firstExitSize;
      
      console.log(`📊 SAÍDA PARCIAL 1: ${position.symbol} - Fechando ${(config.firstExitSize * 100)}% @ ${profitPct.toFixed(2)}% lucro`);
      
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
              qty: exitQty.toString(),
              reduceOnly: true,
              positionIdx: 0,
            }
          }
        });

        if (!error && data?.success) {
          // Atualizar estado
          setExitState(prev => {
            const newExecuted = new Map(prev.partialExitsExecuted);
            newExecuted.set(key, [...executed, 1]);
            return { ...prev, partialExitsExecuted: newExecuted };
          });

          toast({
            title: "📊 Saída Parcial Executada",
            description: `${position.symbol}: ${(config.firstExitSize * 100)}% fechado @ ${profitPct.toFixed(2)}% lucro`,
          });

          // Registrar no banco
          await logPartialExit(position, 1, profitPct, exitQty);

          return { executed: true, level: 1 };
        }
      } catch (err) {
        console.error('Erro na saída parcial 1:', err);
      }
    }

    // Segunda saída: resto quando atingir secondExitPct
    if (profitPct >= config.secondExitPct && executed.includes(1) && !executed.includes(2)) {
      const exitQty = position.size * config.secondExitSize;
      
      console.log(`📊 SAÍDA PARCIAL 2: ${position.symbol} - Fechando ${(config.secondExitSize * 100)}% @ ${profitPct.toFixed(2)}% lucro`);
      
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
              qty: exitQty.toString(),
              reduceOnly: true,
              positionIdx: 0,
            }
          }
        });

        if (!error && data?.success) {
          setExitState(prev => {
            const newExecuted = new Map(prev.partialExitsExecuted);
            newExecuted.set(key, [...executed, 2]);
            return { ...prev, partialExitsExecuted: newExecuted };
          });

          toast({
            title: "✅ Posição Totalmente Fechada",
            description: `${position.symbol}: Lucro total de ${profitPct.toFixed(2)}%`,
          });

          await logPartialExit(position, 2, profitPct, exitQty);

          return { executed: true, level: 2 };
        }
      } catch (err) {
        console.error('Erro na saída parcial 2:', err);
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

    // Buscar preços extremos
    const highest = exitState.highestPrice.get(key) || position.entryPrice;
    const lowest = exitState.lowestPrice.get(key) || position.entryPrice;

    // Atualizar preços extremos
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
      if (position.currentPrice < lowest) {
        newLowest = position.currentPrice;
        setExitState(prev => {
          const newMap = new Map(prev.lowestPrice);
          newMap.set(key, newLowest);
          return { ...prev, lowestPrice: newMap };
        });
      }
    }

    // Verificar ativação do break-even
    if (!isBreakeven && profitPct >= config.breakEvenPct) {
      setExitState(prev => {
        const newMap = new Map(prev.breakEvenActivated);
        newMap.set(key, true);
        return { ...prev, breakEvenActivated: newMap };
      });
      
      // Mover stop para breakeven (entry price + pequena margem)
      const breakEvenStop = position.side === 'Buy'
        ? position.entryPrice * 1.001 // +0.1% acima do entry
        : position.entryPrice * 0.999; // -0.1% abaixo do entry

      console.log(`🛡️ BREAKEVEN ${position.symbol}: Stop movido para ${breakEvenStop.toFixed(4)}`);

      return { newStop: breakEvenStop, shouldActivate: false, isBreakeven: true };
    }

    // Verificar ativação do trailing
    if (!isActive && profitPct >= config.activationPct) {
      setExitState(prev => {
        const newMap = new Map(prev.trailingActive);
        newMap.set(key, true);
        return { ...prev, trailingActive: newMap };
      });
      
      console.log(`🎯 TRAILING ATIVADO ${position.symbol}: @ ${profitPct.toFixed(2)}% lucro`);
      
      return { newStop: null, shouldActivate: true, isBreakeven: false };
    }

    // Se trailing ativo, calcular novo stop
    if (isActive) {
      const trailingDistance = config.trailingPct / 100;
      
      const newStop = position.side === 'Buy'
        ? newHighest * (1 - trailingDistance)
        : newLowest * (1 + trailingDistance);

      return { newStop, shouldActivate: false, isBreakeven: false };
    }

    return { newStop: null, shouldActivate: false, isBreakeven: false };
  }, [exitState, calculateProfitPct]);

  // Registrar saída parcial no banco
  const logPartialExit = async (position: PositionData, level: number, profitPct: number, qty: number) => {
    const userId = await getUserId();
    
    await supabase.from('auto_trader_logs').insert({
      user_id: userId,
      log_type: 'PARTIAL_EXIT',
      message: `Saída parcial ${level}: ${position.symbol} - ${qty} unidades @ ${profitPct.toFixed(2)}% lucro`,
      symbol: position.symbol,
      metadata: {
        level,
        profitPct,
        qty,
        side: position.side,
        entryPrice: position.entryPrice,
        exitPrice: position.currentPrice,
      }
    });
  };

  // Processar todas as posições abertas
  const processOpenPositions = useCallback(async (
    positions: PositionData[],
    mlConfig: any,
    volatilityMap: Map<string, number>
  ) => {
    const results = [];

    for (const position of positions) {
      const volatility = volatilityMap.get(position.symbol) || 2;
      const trailingConfig = getAdaptiveTrailingConfig(volatility, mlConfig);
      const partialConfig = getPartialExitConfig(mlConfig);

      // Verificar saída parcial primeiro
      const partialResult = await checkPartialExit(position, partialConfig);
      
      if (partialResult.executed) {
        results.push({
          symbol: position.symbol,
          action: 'PARTIAL_EXIT',
          level: partialResult.level,
        });
        continue; // Não processar trailing se acabou de fazer saída parcial
      }

      // Calcular trailing stop
      const trailingResult = calculateTrailingStop(position, trailingConfig);

      if (trailingResult.newStop) {
        // Atualizar stop loss na Bybit
        try {
          await supabase.functions.invoke('bybit-trading', {
            body: {
              action: 'set_trading_stop',
              isTestnet: false,
              params: {
                category: 'linear',
                symbol: position.symbol,
                stopLoss: trailingResult.newStop.toFixed(4),
                positionIdx: 0,
              }
            }
          });

          results.push({
            symbol: position.symbol,
            action: trailingResult.isBreakeven ? 'BREAKEVEN' : 'TRAILING_UPDATE',
            newStop: trailingResult.newStop,
          });

          console.log(`✅ Stop atualizado ${position.symbol}: ${trailingResult.newStop.toFixed(4)}`);
        } catch (err) {
          console.error(`Erro ao atualizar stop ${position.symbol}:`, err);
        }
      }
    }

    return results;
  }, [getAdaptiveTrailingConfig, getPartialExitConfig, checkPartialExit, calculateTrailingStop]);

  // Limpar estado de uma posição fechada
  const clearPositionState = useCallback((symbol: string) => {
    setExitState(prev => {
      const newHighest = new Map(prev.highestPrice);
      const newLowest = new Map(prev.lowestPrice);
      const newTrailing = new Map(prev.trailingActive);
      const newPartial = new Map(prev.partialExitsExecuted);
      const newBreakeven = new Map(prev.breakEvenActivated);

      newHighest.delete(symbol);
      newLowest.delete(symbol);
      newTrailing.delete(symbol);
      newPartial.delete(symbol);
      newBreakeven.delete(symbol);

      return {
        highestPrice: newHighest,
        lowestPrice: newLowest,
        trailingActive: newTrailing,
        partialExitsExecuted: newPartial,
        breakEvenActivated: newBreakeven,
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
