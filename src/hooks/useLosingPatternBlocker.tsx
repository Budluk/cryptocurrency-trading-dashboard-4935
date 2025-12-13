import { useCallback, useRef, useEffect, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";

interface PatternStats {
  symbol: string;
  side: string;
  hour: number;
  leverage: number;
  losses: number;
  wins: number;
  totalPnL: number;
  lastLoss: string;
  streak: number;
}

interface BlockedPattern {
  key: string;
  reason: string;
  blockedUntil: number;
  stats: PatternStats;
}

interface LosingPatternResult {
  blocked: boolean;
  reason: string;
  pattern?: BlockedPattern;
}

export const useLosingPatternBlocker = () => {
  const [blockedPatterns, setBlockedPatterns] = useState<Map<string, BlockedPattern>>(new Map());
  const [symbolLossesState, setSymbolLossesState] = useState<Map<string, { count: number; lastLoss: number }>>(new Map());
  const patternStats = useRef<Map<string, PatternStats>>(new Map());
  const hourLosses = useRef<Map<number, { count: number; lastLoss: number }>>(new Map());
  const leverageLosses = useRef<Map<string, { count: number; lastLoss: number }>>(new Map());
  
  // Configurações - mais agressivas para testar
  const MAX_SYMBOL_LOSSES = 2; // Bloquear símbolo após 2 perdas consecutivas
  const MAX_HOUR_LOSSES = 4; // Bloquear hora após 4 perdas
  const MAX_LEVERAGE_LOSSES = 3; // Bloquear faixa de alavancagem após 3 perdas
  const BLOCK_DURATION = 30 * 60 * 1000; // 30 minutos de bloqueio
  const COOL_DOWN_DURATION = 60 * 60 * 1000; // 1 hora para resetar contador

  // Gerar chave do padrão
  const getPatternKey = (symbol: string, side: string, hour: number, leverageRange: string) => {
    return `${symbol}:${side}:${hour}:${leverageRange}`;
  };

  const getLeverageRange = (leverage: number): string => {
    if (leverage <= 10) return 'low';
    if (leverage <= 25) return 'medium';
    if (leverage <= 50) return 'high';
    return 'extreme';
  };

  // Carregar padrões históricos do banco
  const loadHistoricalPatterns = useCallback(async () => {
    try {
      // Buscar TODOS trades fechados recentes (últimas 24h) ordenados por tempo
      const { data: recentTrades, error } = await supabase
        .from('auto_trader_positions')
        .select('symbol, side, leverage, opened_at, closed_at, realized_pnl, pnl')
        .eq('status', 'CLOSED')
        .gte('opened_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('closed_at', { ascending: false });

      if (error || !recentTrades?.length) {
        console.log('🔍 Nenhum trade encontrado para análise');
        return;
      }

      console.log(`🔍 Analisando ${recentTrades.length} trades fechados...`);

      // Agrupar por símbolo para contar perdas consecutivas
      const symbolGroups: Record<string, typeof recentTrades> = {};
      for (const t of recentTrades) {
        const sym = t.symbol;
        if (!symbolGroups[sym]) symbolGroups[sym] = [];
        symbolGroups[sym].push(t);
      }

      const newSymbolLosses = new Map<string, { count: number; lastLoss: number }>();
      
      for (const [symbol, trades] of Object.entries(symbolGroups)) {
        // Trades já vêm ordenados do mais recente ao mais antigo
        let consecutiveLosses = 0;
        for (const trade of trades) {
          const actualPnl = trade.realized_pnl ?? trade.pnl ?? 0;
          if (actualPnl < 0) {
            consecutiveLosses++;
          } else {
            break; // Encontrou uma vitória, para de contar
          }
        }
        
        console.log(`📊 ${symbol}: ${consecutiveLosses} perdas consecutivas (limite: ${MAX_SYMBOL_LOSSES})`);
        
        if (consecutiveLosses >= MAX_SYMBOL_LOSSES) {
          console.log(`🚫 BLOQUEANDO símbolo: ${symbol} (${consecutiveLosses} perdas consecutivas)`);
          newSymbolLosses.set(symbol, {
            count: consecutiveLosses,
            lastLoss: Date.now(),
          });
        }
      }
      
      // Atualizar state para persistir bloqueios
      setSymbolLossesState(prev => {
        // Manter bloqueios existentes e adicionar novos
        const merged = new Map(prev);
        for (const [sym, data] of newSymbolLosses) {
          merged.set(sym, data);
        }
        return merged;
      });

      console.log(`🔒 ${newSymbolLosses.size} símbolos bloqueados após análise histórica`);

    } catch (error) {
      console.error('Erro ao carregar padrões:', error);
    }
  }, []);

  // Verificar se padrão está bloqueado
  const isPatternBlocked = useCallback((
    symbol: string,
    side: string,
    leverage: number
  ): LosingPatternResult => {
    const now = Date.now();

    // PRIORIDADE 1: Verificar símbolo bloqueado (independente de side/hour/leverage)
    const symbolData = symbolLossesState.get(symbol);
    if (symbolData && symbolData.count >= MAX_SYMBOL_LOSSES) {
      if (now - symbolData.lastLoss < COOL_DOWN_DURATION) {
        console.log(`🚫 BLOQUEADO: ${symbol} (${symbolData.count} perdas consecutivas)`);
        return {
          blocked: true,
          reason: `${symbol} bloqueado: ${symbolData.count} perdas consecutivas`,
        };
      } else {
        // Cooldown expirado, remover bloqueio
        setSymbolLossesState(prev => {
          const newMap = new Map(prev);
          newMap.delete(symbol);
          return newMap;
        });
      }
    }

    // PRIORIDADE 2: Verificar hora
    const hour = new Date().getUTCHours();
    const hourData = hourLosses.current.get(hour);
    if (hourData && hourData.count >= MAX_HOUR_LOSSES) {
      if (now - hourData.lastLoss < COOL_DOWN_DURATION) {
        return {
          blocked: true,
          reason: `Hora ${hour}:00 UTC bloqueada: ${hourData.count} perdas`,
        };
      } else {
        hourLosses.current.delete(hour);
      }
    }

    // PRIORIDADE 3: Verificar faixa de alavancagem
    const leverageRange = getLeverageRange(leverage);
    const leverageData = leverageLosses.current.get(leverageRange);
    if (leverageData && leverageData.count >= MAX_LEVERAGE_LOSSES) {
      if (now - leverageData.lastLoss < COOL_DOWN_DURATION) {
        return {
          blocked: true,
          reason: `Leverage ${leverageRange} bloqueado: ${leverageData.count} perdas`,
        };
      } else {
        leverageLosses.current.delete(leverageRange);
      }
    }

    // PRIORIDADE 4: Verificar padrões específicos bloqueados
    const key = getPatternKey(symbol, side, hour, leverageRange);
    const blocked = blockedPatterns.get(key);
    if (blocked && blocked.blockedUntil > now) {
      return {
        blocked: true,
        reason: blocked.reason,
        pattern: blocked,
      };
    }

    return { blocked: false, reason: '' };
  }, [blockedPatterns, symbolLossesState]);

  // Registrar resultado de trade
  const recordTradeResult = useCallback((
    symbol: string,
    side: string,
    leverage: number,
    pnl: number
  ) => {
    const now = Date.now();
    const hour = new Date().getUTCHours();
    const leverageRange = getLeverageRange(leverage);
    const key = getPatternKey(symbol, side, hour, leverageRange);
    const isLoss = pnl < 0;

    // Atualizar estatísticas do padrão
    const existing = patternStats.current.get(key) || {
      symbol, side, hour, leverage,
      losses: 0, wins: 0, totalPnL: 0, lastLoss: '', streak: 0,
    };

    if (isLoss) {
      existing.losses++;
      existing.streak++;
      existing.lastLoss = new Date().toISOString();
      
      console.log(`🔴 PERDA registrada: ${symbol} | Streak: ${existing.streak}`);
      
      // Atualizar contador de símbolo (usar state para persistência)
      setSymbolLossesState(prev => {
        const newMap = new Map(prev);
        const current = newMap.get(symbol) || { count: 0, lastLoss: now };
        current.count++;
        current.lastLoss = now;
        newMap.set(symbol, current);
        
        if (current.count >= MAX_SYMBOL_LOSSES) {
          console.log(`🚫 BLOQUEANDO ${symbol}: ${current.count} perdas consecutivas`);
        }
        
        return newMap;
      });

      // Atualizar contador de hora
      const hourData = hourLosses.current.get(hour) || { count: 0, lastLoss: now };
      hourData.count++;
      hourData.lastLoss = now;
      hourLosses.current.set(hour, hourData);

      // Atualizar contador de leverage
      const leverageData = leverageLosses.current.get(leverageRange) || { count: 0, lastLoss: now };
      leverageData.count++;
      leverageData.lastLoss = now;
      leverageLosses.current.set(leverageRange, leverageData);

      // Bloquear se atingiu limite
      if (existing.streak >= MAX_SYMBOL_LOSSES) {
        console.log(`🚫 Bloqueando padrão: ${key} após ${existing.streak} perdas consecutivas`);
        setBlockedPatterns(prev => {
          const newMap = new Map(prev);
          newMap.set(key, {
            key,
            reason: `Padrão bloqueado: ${symbol} ${side} às ${hour}h (${existing.streak} perdas seguidas)`,
            blockedUntil: now + BLOCK_DURATION,
            stats: existing,
          });
          return newMap;
        });
      }
    } else {
      existing.wins++;
      existing.streak = 0; // Reset streak em vitória
      
      console.log(`🟢 VITÓRIA registrada: ${symbol} | Streak resetado`);
      
      // Resetar contadores em vitória
      setSymbolLossesState(prev => {
        const newMap = new Map(prev);
        newMap.delete(symbol);
        return newMap;
      });
    }

    existing.totalPnL += pnl;
    patternStats.current.set(key, existing);

    console.log(`📊 Padrão ${key}: W${existing.wins}/L${existing.losses} | Streak: ${existing.streak}`);
  }, []);

  // Obter estatísticas de bloqueio
  const getBlockedStats = useCallback(() => {
    const blockedSymbols = Array.from(symbolLossesState.entries())
      .filter(([_, d]) => d.count >= MAX_SYMBOL_LOSSES)
      .map(([s]) => s);
      
    console.log(`📊 Stats: ${blockedSymbols.length} símbolos bloqueados, ${blockedPatterns.size} padrões`);
    
    return {
      blockedPatterns: Array.from(blockedPatterns.values()),
      totalBlocked: blockedPatterns.size + blockedSymbols.length,
      blockedSymbols,
      blockedHours: Array.from(hourLosses.current.entries())
        .filter(([_, d]) => d.count >= MAX_HOUR_LOSSES)
        .map(([h]) => h),
    };
  }, [blockedPatterns, symbolLossesState]);

  // Forçar desbloqueio
  const forceUnblock = useCallback((key: string) => {
    setBlockedPatterns(prev => {
      const newMap = new Map(prev);
      newMap.delete(key);
      return newMap;
    });
    console.log(`✅ Padrão desbloqueado: ${key}`);
  }, []);

  // Carregar padrões ao iniciar
  useEffect(() => {
    loadHistoricalPatterns();
  }, [loadHistoricalPatterns]);

  return {
    isPatternBlocked,
    recordTradeResult,
    getBlockedStats,
    forceUnblock,
    loadHistoricalPatterns,
    blockedCount: blockedPatterns.size,
  };
};
