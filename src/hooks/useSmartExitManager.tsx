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

  // TRAILING PROGRESSIVO v7: mais espaço no início, apertar com lucro alto
  // v6 era ultra-agressivo → stopava no ruído antes de atingir lucro bom
  const getProgressiveTrailingPct = useCallback((profitPct: number, baseTrailingPct: number): number => {
    if (profitPct >= 3.0) return 0.20;
    if (profitPct >= 2.0) return 0.30;
    if (profitPct >= 1.0) return 0.40;
    if (profitPct >= 0.5) return 0.50;
    return baseTrailingPct; // v7: não apertar cedo demais
  }, []);

  // v7: Trailing mais paciente — deixar lucro crescer antes de travar
  const getAdaptiveTrailingConfig = useCallback((volatility: number, mlConfig: any, profitPct?: number): TrailingStopConfig => {
    let baseConfig: TrailingStopConfig;

    // v7: breakeven em 0.5% (era 0.3%), trailing ativa em 0.7-1.0%
    if (volatility < 2) {
      baseConfig = { activationPct: 0.7, trailingPct: 0.50, breakEvenPct: 0.5 };
    } else if (volatility < 5) {
      baseConfig = { activationPct: 0.8, trailingPct: 0.60, breakEvenPct: 0.5 };
    } else {
      baseConfig = { activationPct: 1.0, trailingPct: 0.70, breakEvenPct: 0.6 };
    }

    // Aplicar trailing progressivo se já tem lucro
    if (profitPct && profitPct > 0) {
      baseConfig.trailingPct = getProgressiveTrailingPct(profitPct, baseConfig.trailingPct);
    }

    return baseConfig;
  }, [getProgressiveTrailingPct]);

  // v11: Saídas parciais alinhadas com 0.4% SL / 0.8% TP
  const getPartialExitConfig = useCallback((_mlConfig: any): PartialExitConfig => {
    return {
      firstExitPct: 0.4,   // v11: 0.4% lucro → fecha 50% (metade do TP)
      firstExitSize: 0.5,
      secondExitPct: 0.8,  // v11: 0.8% lucro → fecha resto (= TP)
      secondExitSize: 0.5,
    };
  }, []);

  // Calcular lucro % atual de uma posição
  // IMPORTANTE: usar movimento de preço puro (sem multiplicar por alavancagem)
  // para evitar ativações prematuras de trailing/saídas parciais.
  const calculateProfitPct = useCallback((position: PositionData): number => {
    const priceDiff = position.side === 'Buy' 
      ? position.currentPrice - position.entryPrice
      : position.entryPrice - position.currentPrice;
    
    return (priceDiff / position.entryPrice) * 100;
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
      // Buscar instrumento para obter qtyStep
      const { data: instData } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_instruments', isTestnet: false, params: { category: 'linear', symbol: position.symbol } }
      });
      
      const instrument = instData?.data?.list?.[0];
      const lotSizeFilter = instrument?.lotSizeFilter || {};
      const qtyStep = parseFloat(lotSizeFilter.qtyStep || '0.001');
      const minOrderQty = parseFloat(lotSizeFilter.minOrderQty || '0.001');
      
      // Calcular e formatar qty corretamente
      let exitQty = Math.floor((position.size * config.firstExitSize) / qtyStep) * qtyStep;
      exitQty = Math.max(exitQty, minOrderQty);
      
      const qtyStepStr = qtyStep.toString();
      const decimalPlaces = qtyStepStr.includes('.') ? qtyStepStr.split('.')[1].length : 0;
      const exitQtyStr = exitQty.toFixed(decimalPlaces);
      
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
              qty: exitQtyStr,
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
      // Buscar instrumento para obter qtyStep
      const { data: instData } = await supabase.functions.invoke('bybit-trading', {
        body: { action: 'get_instruments', isTestnet: false, params: { category: 'linear', symbol: position.symbol } }
      });
      
      const instrument = instData?.data?.list?.[0];
      const lotSizeFilter = instrument?.lotSizeFilter || {};
      const qtyStep = parseFloat(lotSizeFilter.qtyStep || '0.001');
      const minOrderQty = parseFloat(lotSizeFilter.minOrderQty || '0.001');
      
      // Calcular e formatar qty corretamente
      let exitQty = Math.floor((position.size * config.secondExitSize) / qtyStep) * qtyStep;
      exitQty = Math.max(exitQty, minOrderQty);
      
      const qtyStepStr = qtyStep.toString();
      const decimalPlaces = qtyStepStr.includes('.') ? qtyStepStr.split('.')[1].length : 0;
      const exitQtyStr = exitQty.toFixed(decimalPlaces);
      
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
              qty: exitQtyStr,
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

  // ⏰ SAÍDA POR TEMPO: fecha posições que ficam abertas demais sem lucro
  const checkTimeBasedExit = useCallback(async (
    position: PositionData & { openedAt?: string }
  ): Promise<boolean> => {
    if (!position.openedAt) return false;
    
    const openTime = new Date(position.openedAt).getTime();
    const now = Date.now();
    const minutesOpen = (now - openTime) / (1000 * 60);
    const profitPct = calculateProfitPct(position);
    
    // v11: Saídas por tempo mais rápidas para scalping
    const shouldClose = 
      (minutesOpen > 8 && profitPct < -0.2) ||  // 8min com loss → fechar
      (minutesOpen > 6 && profitPct < 0.05) ||   // 6min flat → fechar
      (minutesOpen > 15);                         // 15min hard cap
    
    if (!shouldClose) return false;
    
    const reason = profitPct < 0 
      ? `⏰ TIME EXIT: ${position.symbol} aberta ${minutesOpen.toFixed(0)}min com ${profitPct.toFixed(2)}% prejuízo`
      : `⏰ TIME EXIT: ${position.symbol} aberta ${minutesOpen.toFixed(0)}min - lucro insuficiente (${profitPct.toFixed(2)}%)`;
    
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
          metadata: { minutesOpen, profitPct, side: position.side }
        });
        
        toast({
          title: "⏰ Saída por Tempo",
          description: `${position.symbol}: fechada após ${minutesOpen.toFixed(0)}min (${profitPct.toFixed(2)}%)`,
        });
        return true;
      }
    } catch (err) {
      console.error('Erro na saída por tempo:', err);
    }
    return false;
  }, [calculateProfitPct, toast]);

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
      // ⏰ Verificar saída por tempo PRIMEIRO (prioridade máxima)
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

      // Verificar saída parcial primeiro (se habilitado)
      if (shouldUsePartialExit) {
        const partialResult = await checkPartialExit(position, partialConfig);
        
        if (partialResult.executed) {
          results.push({
            symbol: position.symbol,
            action: 'PARTIAL_EXIT',
            level: partialResult.level,
          });
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
  }, [getAdaptiveTrailingConfig, getPartialExitConfig, checkPartialExit, calculateTrailingStop, checkTimeBasedExit, calculateProfitPct]);

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
