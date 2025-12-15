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
let lastLoadTime = 0;

// Configurações - MELHORADO
const MAX_SYMBOL_LOSSES = 2; // Bloquear após 2 perdas consecutivas
const MAX_HOUR_LOSSES = 5;   // Bloquear hora após 5 perdas
const MAX_LEVERAGE_LOSSES = 4; // Bloquear range de leverage após 4 perdas
const BLOCK_DURATION = 30 * 60 * 1000; // 30 min bloqueio
const COOL_DOWN_DURATION = 45 * 60 * 1000; // 45 min cooldown
const ADAPTIVE_COOLDOWN_MULTIPLIER = 1.5; // Aumenta cooldown após múltiplos bloqueios

// Cache de volatilidade perdedora
const volatilityLossPatterns = new Map<string, { losses: number; avgVolatility: number }>();
const symbolBlockHistory = new Map<string, number>(); // Quantas vezes foi bloqueado

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

  const loadHistoricalPatterns = useCallback(async (force = false) => {
    const now = Date.now();
    
    // Se forçado, limpar tudo primeiro
    if (force) {
      console.log('🧹 Limpando cache de bloqueios...');
      globalBlockedSymbols.clear();
      globalBlockedPatterns.clear();
      globalHourLosses.clear();
      globalLeverageLosses.clear();
      globalPatternStats.clear();
      globalInitialized = false;
    }
    
    // Evitar recarregar se já carregou nos últimos 30 segundos
    if (!force && globalInitialized && now - lastLoadTime < 30000) {
      console.log(`⏭️ Usando cache de bloqueios (${globalBlockedSymbols.size} símbolos)`);
      return;
    }
    
    try {
      lastLoadTime = now;
      
      // Buscar trades fechados dos últimos 7 dias para análise mais completa
      // Usar opened_at como fallback se closed_at estiver NULL
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      
      const { data: recentTrades, error } = await supabase
        .from('auto_trader_positions')
        .select('symbol, side, leverage, opened_at, closed_at, realized_pnl, pnl')
        .eq('status', 'CLOSED')
        .gte('opened_at', sevenDaysAgo)
        .order('opened_at', { ascending: false })
        .limit(500);

      if (error) {
        console.error('❌ Erro ao buscar trades:', error);
        return;
      }
      
      if (!recentTrades?.length) {
        console.log('🔍 Nenhum trade fechado encontrado nos últimos 7 dias');
        globalInitialized = true;
        return;
      }

      console.log(`🔍 Analisando ${recentTrades.length} trades fechados (últimos 7 dias)...`);

      // Agrupar por símbolo
      const symbolGroups: Record<string, typeof recentTrades> = {};
      for (const t of recentTrades) {
        const sym = t.symbol;
        if (!symbolGroups[sym]) symbolGroups[sym] = [];
        symbolGroups[sym].push(t);
      }

      let totalBlocked = 0;
      for (const [symbol, trades] of Object.entries(symbolGroups)) {
        // Ordenar por closed_at DESC (usar opened_at como fallback)
        trades.sort((a, b) => {
          const dateA = new Date(a.closed_at || a.opened_at || 0).getTime();
          const dateB = new Date(b.closed_at || b.opened_at || 0).getTime();
          return dateB - dateA;
        });
        
        let consecutiveLosses = 0;
        for (const trade of trades) {
          // Usar pnl se realized_pnl não existir
          const actualPnl = typeof trade.realized_pnl === 'number' ? trade.realized_pnl : (trade.pnl ?? 0);
          if (actualPnl < 0) {
            consecutiveLosses++;
          } else {
            break; // Parar no primeiro lucro
          }
        }
        
        if (consecutiveLosses >= MAX_SYMBOL_LOSSES) {
          console.log(`🚫 BLOQUEANDO ${symbol}: ${consecutiveLosses} perdas consecutivas`);
          globalBlockedSymbols.set(symbol, {
            count: consecutiveLosses,
            lastLoss: Date.now(),
          });
          totalBlocked++;
        } else if (consecutiveLosses > 0) {
          console.log(`⚠️ ${symbol}: ${consecutiveLosses}/${MAX_SYMBOL_LOSSES} perdas`);
        }
      }

      globalInitialized = true;
      console.log(`🔒 ${totalBlocked} símbolos bloqueados de ${Object.keys(symbolGroups).length} analisados`);
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
    pnl: number,
    volatility?: number // NOVO: volatilidade opcional
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
      
      console.log(`🔴 PERDA registrada: ${symbol} | Streak: ${existing.streak} | PnL: ${pnl.toFixed(4)}`);
      
      // 🆕 Rastrear padrões de volatilidade perdedora
      if (volatility) {
        const volPattern = volatilityLossPatterns.get(symbol) || { losses: 0, avgVolatility: 0 };
        volPattern.avgVolatility = (volPattern.avgVolatility * volPattern.losses + volatility) / (volPattern.losses + 1);
        volPattern.losses++;
        volatilityLossPatterns.set(symbol, volPattern);
        
        if (volPattern.losses >= 3 && volPattern.avgVolatility > 8) {
          console.log(`⚠️ ${symbol}: ${volPattern.losses} perdas com volatilidade média ${volPattern.avgVolatility.toFixed(1)}%`);
        }
      }
      
      // Atualizar símbolo com histórico de bloqueios
      const current = globalBlockedSymbols.get(symbol) || { count: 0, lastLoss: now };
      current.count++;
      current.lastLoss = now;
      globalBlockedSymbols.set(symbol, current);
      
      if (current.count >= MAX_SYMBOL_LOSSES) {
        // 🆕 Cooldown adaptativo: aumenta se já foi bloqueado antes
        const previousBlocks = symbolBlockHistory.get(symbol) || 0;
        symbolBlockHistory.set(symbol, previousBlocks + 1);
        const adaptiveCooldown = COOL_DOWN_DURATION * Math.pow(ADAPTIVE_COOLDOWN_MULTIPLIER, Math.min(previousBlocks, 3));
        
        console.log(`🚫 BLOQUEANDO ${symbol}: ${current.count} perdas (cooldown: ${(adaptiveCooldown/60000).toFixed(0)}min)`);
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
        const previousBlocks = symbolBlockHistory.get(symbol) || 0;
        const adaptiveBlockDuration = BLOCK_DURATION * Math.pow(ADAPTIVE_COOLDOWN_MULTIPLIER, Math.min(previousBlocks, 3));
        
        console.log(`🚫 Bloqueando padrão: ${key} após ${existing.streak} perdas (${(adaptiveBlockDuration/60000).toFixed(0)}min)`);
        globalBlockedPatterns.set(key, {
          key,
          reason: `${symbol} ${side} às ${hour}h (${existing.streak} perdas seguidas)`,
          blockedUntil: now + adaptiveBlockDuration,
          stats: existing,
        });
      }
    } else {
      existing.wins++;
      
      // 🆕 Só resetar streak após 2 vitórias consecutivas para evitar falsos positivos
      if (existing.wins >= 2) {
        existing.streak = 0;
        globalBlockedSymbols.delete(symbol);
        console.log(`🟢 VITÓRIA x2: ${symbol} | Streak resetado`);
      } else {
        console.log(`🟢 VITÓRIA: ${symbol} | Aguardando confirmação (${existing.wins}/2)`);
      }
    }

    existing.totalPnL += pnl;
    globalPatternStats.set(key, existing);
    triggerUpdate();

    console.log(`📊 Padrão ${key}: W${existing.wins}/L${existing.losses} | Streak: ${existing.streak}`);
  }, [triggerUpdate]);

  const getBlockedStats = useCallback(() => {
    const now = Date.now();
    const blockedSymbols = Array.from(globalBlockedSymbols.entries())
      .filter(([_, d]) => d.count >= MAX_SYMBOL_LOSSES)
      .map(([s]) => s);
    
    // 🆕 Estatísticas de volatilidade perdedora
    const highVolatilityLosers = Array.from(volatilityLossPatterns.entries())
      .filter(([_, d]) => d.losses >= 3 && d.avgVolatility > 8)
      .map(([s, d]) => ({ symbol: s, losses: d.losses, avgVol: d.avgVolatility.toFixed(1) }));
    
    // 🆕 Símbolos com múltiplos bloqueios históricos
    const repeatOffenders = Array.from(symbolBlockHistory.entries())
      .filter(([_, count]) => count >= 2)
      .map(([s, count]) => ({ symbol: s, blockCount: count }));
      
    console.log(`📊 Stats: ${blockedSymbols.length} símbolos, ${globalBlockedPatterns.size} padrões, ${highVolatilityLosers.length} vol-losers`);
    
    return {
      blockedPatterns: Array.from(globalBlockedPatterns.values()),
      totalBlocked: globalBlockedPatterns.size + blockedSymbols.length,
      blockedSymbols,
      blockedHours: Array.from(globalHourLosses.entries())
        .filter(([_, d]) => d.count >= MAX_HOUR_LOSSES)
        .map(([h]) => h),
      highVolatilityLosers,
      repeatOffenders,
    };
  }, []);

  const forceUnblock = useCallback((key: string) => {
    globalBlockedPatterns.delete(key);
    triggerUpdate();
    console.log(`✅ Padrão desbloqueado: ${key}`);
  }, [triggerUpdate]);

  // Carregar ao iniciar - forçar se nunca foi inicializado
  useEffect(() => {
    if (!globalInitialized) {
      loadHistoricalPatterns(true);
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
