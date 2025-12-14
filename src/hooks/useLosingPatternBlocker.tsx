import { useCallback, useEffect, useState } from 'react';
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

// DADOS GLOBAIS - persistem entre re-renders e remounts do componente
const globalBlockedSymbols = new Map<string, { count: number; lastLoss: number }>();
const globalBlockedPatterns = new Map<string, BlockedPattern>();
const globalHourLosses = new Map<number, { count: number; lastLoss: number }>();
const globalLeverageLosses = new Map<string, { count: number; lastLoss: number }>();
const globalPatternStats = new Map<string, PatternStats>();
let globalInitialized = false;

// Configurações
const MAX_SYMBOL_LOSSES = 2;
const MAX_HOUR_LOSSES = 4;
const MAX_LEVERAGE_LOSSES = 3;
const BLOCK_DURATION = 30 * 60 * 1000;
const COOL_DOWN_DURATION = 60 * 60 * 1000;

export const useLosingPatternBlocker = () => {
  const [, forceUpdate] = useState(0);
  const triggerUpdate = useCallback(() => forceUpdate(n => n + 1), []);

  const getPatternKey = (symbol: string, side: string, hour: number, leverageRange: string) => {
    return `${symbol}:${side}:${hour}:${leverageRange}`;
  };

  const getLeverageRange = (leverage: number): string => {
    if (leverage <= 10) return 'low';
    if (leverage <= 25) return 'medium';
    if (leverage <= 50) return 'high';
    return 'extreme';
  };

  const loadHistoricalPatterns = useCallback(async () => {
    try {
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

      // Agrupar por símbolo
      const symbolGroups: Record<string, typeof recentTrades> = {};
      for (const t of recentTrades) {
        const sym = t.symbol;
        if (!symbolGroups[sym]) symbolGroups[sym] = [];
        symbolGroups[sym].push(t);
      }

      for (const [symbol, trades] of Object.entries(symbolGroups)) {
        let consecutiveLosses = 0;
        for (const trade of trades) {
          const actualPnl = trade.realized_pnl ?? trade.pnl ?? 0;
          if (actualPnl < 0) {
            consecutiveLosses++;
          } else {
            break;
          }
        }
        
        console.log(`📊 ${symbol}: ${consecutiveLosses} perdas consecutivas (limite: ${MAX_SYMBOL_LOSSES})`);
        
        if (consecutiveLosses >= MAX_SYMBOL_LOSSES) {
          console.log(`🚫 BLOQUEANDO símbolo: ${symbol} (${consecutiveLosses} perdas consecutivas)`);
          globalBlockedSymbols.set(symbol, {
            count: consecutiveLosses,
            lastLoss: Date.now(),
          });
        }
      }

      globalInitialized = true;
      console.log(`🔒 ${globalBlockedSymbols.size} símbolos bloqueados após análise histórica`);
      triggerUpdate();

    } catch (error) {
      console.error('Erro ao carregar padrões:', error);
    }
  }, [triggerUpdate]);

  const isPatternBlocked = useCallback((
    symbol: string,
    side: string,
    leverage: number
  ): LosingPatternResult => {
    const now = Date.now();

    // PRIORIDADE 1: Símbolo bloqueado
    const symbolData = globalBlockedSymbols.get(symbol);
    if (symbolData && symbolData.count >= MAX_SYMBOL_LOSSES) {
      if (now - symbolData.lastLoss < COOL_DOWN_DURATION) {
        console.log(`🚫 BLOQUEADO: ${symbol} (${symbolData.count} perdas consecutivas)`);
        return {
          blocked: true,
          reason: `${symbol} bloqueado: ${symbolData.count} perdas consecutivas`,
        };
      } else {
        globalBlockedSymbols.delete(symbol);
        triggerUpdate();
      }
    }

    // PRIORIDADE 2: Hora bloqueada
    const hour = new Date().getUTCHours();
    const hourData = globalHourLosses.get(hour);
    if (hourData && hourData.count >= MAX_HOUR_LOSSES) {
      if (now - hourData.lastLoss < COOL_DOWN_DURATION) {
        return {
          blocked: true,
          reason: `Hora ${hour}:00 UTC bloqueada: ${hourData.count} perdas`,
        };
      } else {
        globalHourLosses.delete(hour);
      }
    }

    // PRIORIDADE 3: Leverage bloqueado
    const leverageRange = getLeverageRange(leverage);
    const leverageData = globalLeverageLosses.get(leverageRange);
    if (leverageData && leverageData.count >= MAX_LEVERAGE_LOSSES) {
      if (now - leverageData.lastLoss < COOL_DOWN_DURATION) {
        return {
          blocked: true,
          reason: `Leverage ${leverageRange} bloqueado: ${leverageData.count} perdas`,
        };
      } else {
        globalLeverageLosses.delete(leverageRange);
      }
    }

    // PRIORIDADE 4: Padrão específico
    const key = getPatternKey(symbol, side, hour, leverageRange);
    const blocked = globalBlockedPatterns.get(key);
    if (blocked && blocked.blockedUntil > now) {
      return {
        blocked: true,
        reason: blocked.reason,
        pattern: blocked,
      };
    }

    return { blocked: false, reason: '' };
  }, [triggerUpdate]);

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

    const existing = globalPatternStats.get(key) || {
      symbol, side, hour, leverage,
      losses: 0, wins: 0, totalPnL: 0, lastLoss: '', streak: 0,
    };

    if (isLoss) {
      existing.losses++;
      existing.streak++;
      existing.lastLoss = new Date().toISOString();
      
      console.log(`🔴 PERDA registrada: ${symbol} | Streak: ${existing.streak}`);
      
      // Atualizar símbolo
      const current = globalBlockedSymbols.get(symbol) || { count: 0, lastLoss: now };
      current.count++;
      current.lastLoss = now;
      globalBlockedSymbols.set(symbol, current);
      
      if (current.count >= MAX_SYMBOL_LOSSES) {
        console.log(`🚫 BLOQUEANDO ${symbol}: ${current.count} perdas consecutivas`);
      }

      // Atualizar hora
      const hourData = globalHourLosses.get(hour) || { count: 0, lastLoss: now };
      hourData.count++;
      hourData.lastLoss = now;
      globalHourLosses.set(hour, hourData);

      // Atualizar leverage
      const leverageData = globalLeverageLosses.get(leverageRange) || { count: 0, lastLoss: now };
      leverageData.count++;
      leverageData.lastLoss = now;
      globalLeverageLosses.set(leverageRange, leverageData);

      // Bloquear padrão se limite atingido
      if (existing.streak >= MAX_SYMBOL_LOSSES) {
        console.log(`🚫 Bloqueando padrão: ${key} após ${existing.streak} perdas consecutivas`);
        globalBlockedPatterns.set(key, {
          key,
          reason: `Padrão bloqueado: ${symbol} ${side} às ${hour}h (${existing.streak} perdas seguidas)`,
          blockedUntil: now + BLOCK_DURATION,
          stats: existing,
        });
      }
    } else {
      existing.wins++;
      existing.streak = 0;
      
      console.log(`🟢 VITÓRIA registrada: ${symbol} | Streak resetado`);
      
      // Resetar símbolo em vitória
      globalBlockedSymbols.delete(symbol);
    }

    existing.totalPnL += pnl;
    globalPatternStats.set(key, existing);
    triggerUpdate();

    console.log(`📊 Padrão ${key}: W${existing.wins}/L${existing.losses} | Streak: ${existing.streak}`);
  }, [triggerUpdate]);

  const getBlockedStats = useCallback(() => {
    const blockedSymbols = Array.from(globalBlockedSymbols.entries())
      .filter(([_, d]) => d.count >= MAX_SYMBOL_LOSSES)
      .map(([s]) => s);
      
    console.log(`📊 Stats: ${blockedSymbols.length} símbolos bloqueados, ${globalBlockedPatterns.size} padrões`);
    
    return {
      blockedPatterns: Array.from(globalBlockedPatterns.values()),
      totalBlocked: globalBlockedPatterns.size + blockedSymbols.length,
      blockedSymbols,
      blockedHours: Array.from(globalHourLosses.entries())
        .filter(([_, d]) => d.count >= MAX_HOUR_LOSSES)
        .map(([h]) => h),
    };
  }, []);

  const forceUnblock = useCallback((key: string) => {
    globalBlockedPatterns.delete(key);
    triggerUpdate();
    console.log(`✅ Padrão desbloqueado: ${key}`);
  }, [triggerUpdate]);

  // Carregar apenas uma vez globalmente
  useEffect(() => {
    if (!globalInitialized) {
      loadHistoricalPatterns();
    }
  }, [loadHistoricalPatterns]);

  return {
    isPatternBlocked,
    recordTradeResult,
    getBlockedStats,
    forceUnblock,
    loadHistoricalPatterns,
    blockedCount: globalBlockedPatterns.size + globalBlockedSymbols.size,
  };
};
