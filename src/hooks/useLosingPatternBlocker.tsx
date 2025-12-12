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
  const patternStats = useRef<Map<string, PatternStats>>(new Map());
  const symbolLosses = useRef<Map<string, { count: number; lastLoss: number }>>(new Map());
  const hourLosses = useRef<Map<number, { count: number; lastLoss: number }>>(new Map());
  const leverageLosses = useRef<Map<string, { count: number; lastLoss: number }>>(new Map());
  
  // Configurações
  const MAX_SYMBOL_LOSSES = 3; // Bloquear símbolo após 3 perdas consecutivas
  const MAX_HOUR_LOSSES = 5; // Bloquear hora após 5 perdas
  const MAX_LEVERAGE_LOSSES = 4; // Bloquear faixa de alavancagem após 4 perdas
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
      // Buscar trades perdedores recentes (últimas 24h) - usar pnl OU realized_pnl
      const { data: recentLosses, error } = await supabase
        .from('auto_trader_positions')
        .select('symbol, side, leverage, opened_at, realized_pnl, pnl')
        .eq('status', 'CLOSED')
        .gte('opened_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('opened_at', { ascending: false });

      if (error || !recentLosses) {
        console.log('🔍 Nenhum trade encontrado para análise');
        return;
      }

      // Filtrar trades com PnL negativo (usar pnl se realized_pnl estiver null)
      const losingTrades = recentLosses.filter(t => {
        const actualPnl = t.realized_pnl ?? t.pnl ?? 0;
        return actualPnl < 0;
      });

      console.log(`🔍 Analisando ${losingTrades.length} trades perdedores de ${recentLosses.length} totais...`);

      // Analisar padrões usando losingTrades filtrados
      for (const trade of losingTrades) {
        const actualPnl = trade.realized_pnl ?? trade.pnl ?? 0;
        const hour = new Date(trade.opened_at).getUTCHours();
        const leverageRange = getLeverageRange(trade.leverage || 10);
        const key = getPatternKey(trade.symbol, trade.side, hour, leverageRange);

        const existing = patternStats.current.get(key) || {
          symbol: trade.symbol,
          side: trade.side,
          hour,
          leverage: trade.leverage || 10,
          losses: 0,
          wins: 0,
          totalPnL: 0,
          lastLoss: '',
          streak: 0,
        };

        existing.losses++;
        existing.totalPnL += actualPnl;
        existing.lastLoss = trade.opened_at;
        existing.streak++;
        
        patternStats.current.set(key, existing);

        // Verificar se deve bloquear
        if (existing.losses >= MAX_SYMBOL_LOSSES) {
          console.log(`🚫 Padrão bloqueado: ${trade.symbol} ${trade.side} ${hour}h ${leverageRange} (${existing.losses} perdas)`);
          setBlockedPatterns(prev => {
            const newMap = new Map(prev);
            newMap.set(key, {
              key,
              reason: `Padrão perdedor: ${trade.symbol} ${trade.side} às ${hour}h com ${leverageRange} leverage (${existing.losses} perdas)`,
              blockedUntil: Date.now() + BLOCK_DURATION,
              stats: existing,
            });
            return newMap;
          });
        }
      }

      // Atualizar contadores de símbolo - usar losingTrades
      const symbolGroups = losingTrades.reduce((acc, t) => {
        if (!acc[t.symbol]) acc[t.symbol] = [];
        acc[t.symbol].push(t);
        return acc;
      }, {} as Record<string, typeof losingTrades>);

      for (const [symbol, trades] of Object.entries(symbolGroups)) {
        const consecutiveLosses = countConsecutiveLosses(trades);
        if (consecutiveLosses >= MAX_SYMBOL_LOSSES) {
          console.log(`🚫 Símbolo bloqueado: ${symbol} (${consecutiveLosses} perdas consecutivas)`);
          symbolLosses.current.set(symbol, {
            count: consecutiveLosses,
            lastLoss: Date.now(),
          });
        }
      }

      console.log(`🔍 Carregados ${patternStats.current.size} padrões, ${blockedPatterns.size} bloqueados`);

    } catch (error) {
      console.error('Erro ao carregar padrões:', error);
    }
  }, []);

  const countConsecutiveLosses = (trades: any[]) => {
    let count = 0;
    for (const trade of trades) {
      const actualPnl = trade.realized_pnl ?? trade.pnl ?? 0;
      if (actualPnl < 0) count++;
      else break;
    }
    return count;
  };

  // Verificar se padrão está bloqueado
  const isPatternBlocked = useCallback((
    symbol: string,
    side: string,
    leverage: number
  ): LosingPatternResult => {
    const now = Date.now();
    const hour = new Date().getUTCHours();
    const leverageRange = getLeverageRange(leverage);
    const key = getPatternKey(symbol, side, hour, leverageRange);

    // Limpar padrões expirados
    setBlockedPatterns(prev => {
      const newMap = new Map(prev);
      for (const [k, pattern] of newMap) {
        if (pattern.blockedUntil < now) {
          newMap.delete(k);
        }
      }
      return newMap;
    });

    // Verificar padrão específico
    const blocked = blockedPatterns.get(key);
    if (blocked && blocked.blockedUntil > now) {
      return {
        blocked: true,
        reason: blocked.reason,
        pattern: blocked,
      };
    }

    // Verificar símbolo
    const symbolData = symbolLosses.current.get(symbol);
    if (symbolData) {
      if (now - symbolData.lastLoss < COOL_DOWN_DURATION && symbolData.count >= MAX_SYMBOL_LOSSES) {
        return {
          blocked: true,
          reason: `${symbol} bloqueado: ${symbolData.count} perdas consecutivas`,
        };
      } else if (now - symbolData.lastLoss >= COOL_DOWN_DURATION) {
        symbolLosses.current.delete(symbol);
      }
    }

    // Verificar hora
    const hourData = hourLosses.current.get(hour);
    if (hourData) {
      if (now - hourData.lastLoss < COOL_DOWN_DURATION && hourData.count >= MAX_HOUR_LOSSES) {
        return {
          blocked: true,
          reason: `Hora ${hour}:00 UTC bloqueada: ${hourData.count} perdas`,
        };
      } else if (now - hourData.lastLoss >= COOL_DOWN_DURATION) {
        hourLosses.current.delete(hour);
      }
    }

    // Verificar faixa de alavancagem
    const leverageData = leverageLosses.current.get(leverageRange);
    if (leverageData) {
      if (now - leverageData.lastLoss < COOL_DOWN_DURATION && leverageData.count >= MAX_LEVERAGE_LOSSES) {
        return {
          blocked: true,
          reason: `Leverage ${leverageRange} bloqueado: ${leverageData.count} perdas`,
        };
      } else if (now - leverageData.lastLoss >= COOL_DOWN_DURATION) {
        leverageLosses.current.delete(leverageRange);
      }
    }

    return { blocked: false, reason: '' };
  }, [blockedPatterns]);

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
      
      // Atualizar contador de símbolo
      const symbolData = symbolLosses.current.get(symbol) || { count: 0, lastLoss: now };
      symbolData.count++;
      symbolData.lastLoss = now;
      symbolLosses.current.set(symbol, symbolData);

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
      
      // Resetar contadores em vitória
      symbolLosses.current.delete(symbol);
    }

    existing.totalPnL += pnl;
    patternStats.current.set(key, existing);

    console.log(`📊 Padrão ${key}: W${existing.wins}/L${existing.losses} | Streak: ${existing.streak}`);
  }, []);

  // Obter estatísticas de bloqueio
  const getBlockedStats = useCallback(() => {
    return {
      blockedPatterns: Array.from(blockedPatterns.values()),
      totalBlocked: blockedPatterns.size,
      blockedSymbols: Array.from(symbolLosses.current.entries())
        .filter(([_, d]) => d.count >= MAX_SYMBOL_LOSSES)
        .map(([s]) => s),
      blockedHours: Array.from(hourLosses.current.entries())
        .filter(([_, d]) => d.count >= MAX_HOUR_LOSSES)
        .map(([h]) => h),
    };
  }, [blockedPatterns]);

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
