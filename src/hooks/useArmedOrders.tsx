import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { getUserId } from '@/lib/anonymousUser';

// 📊 Estrutura de S/R e ordens armadas
interface SupportResistance {
  level: number;
  type: 'support' | 'resistance';
  strength: number; // 1-5 baseado em toques
  lastTouch: Date;
}

interface ArmedOrder {
  id: string;
  symbol: string;
  side: 'Buy' | 'Sell';
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  qty: string;
  leverage: number;
  srLevel: number;
  srType: 'support' | 'resistance';
  status: 'armed' | 'triggered' | 'cancelled';
  createdAt: Date;
  expectedProfit: number;
}

interface HourlyPerformance {
  symbol: string;
  hour: number;
  trades: number;
  wins: number;
  losses: number;
  totalPnl: number;
  avgPnl: number;
  winRate: number;
}

// 🎯 CONFIGURAÇÕES PARA $0.20 MÍNIMO
const MIN_PROFIT_TARGET = 0.20; // $0.20 mínimo por trade
const MIN_RR_RATIO = 2.5; // 1:2.5 risco/recompensa
const SR_DISTANCE_PCT = 0.15; // Stop 0.15% além do S/R
const TP_DISTANCE_PCT = 0.50; // TP 0.50% do entry (2.5x+ do SL)

export const useArmedOrders = () => {
  const [armedOrders, setArmedOrders] = useState<ArmedOrder[]>([]);
  const [hourlyPerformance, setHourlyPerformance] = useState<HourlyPerformance[]>([]);
  const [srLevels, setSrLevels] = useState<Map<string, SupportResistance[]>>(new Map());
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  
  const lastAnalysis = useRef<Map<string, number>>(new Map());

  // 📈 Detectar níveis de S/R a partir de candles
  const detectSupportResistance = useCallback(async (
    symbol: string,
    candles: { high: number; low: number; close: number; open: number }[]
  ): Promise<SupportResistance[]> => {
    if (candles.length < 20) return [];
    
    const levels: SupportResistance[] = [];
    const tolerance = 0.001; // 0.1% de tolerância para agrupar níveis
    
    // Encontrar pivots (swing highs/lows)
    for (let i = 2; i < candles.length - 2; i++) {
      const curr = candles[i];
      const prev1 = candles[i - 1];
      const prev2 = candles[i - 2];
      const next1 = candles[i + 1];
      const next2 = candles[i + 2];
      
      // Swing High (Resistência)
      if (curr.high > prev1.high && curr.high > prev2.high &&
          curr.high > next1.high && curr.high > next2.high) {
        const existingLevel = levels.find(l => 
          l.type === 'resistance' && 
          Math.abs(l.level - curr.high) / l.level < tolerance
        );
        
        if (existingLevel) {
          existingLevel.strength = Math.min(5, existingLevel.strength + 1);
          existingLevel.lastTouch = new Date();
        } else {
          levels.push({
            level: curr.high,
            type: 'resistance',
            strength: 1,
            lastTouch: new Date()
          });
        }
      }
      
      // Swing Low (Suporte)
      if (curr.low < prev1.low && curr.low < prev2.low &&
          curr.low < next1.low && curr.low < next2.low) {
        const existingLevel = levels.find(l => 
          l.type === 'support' && 
          Math.abs(l.level - curr.low) / l.level < tolerance
        );
        
        if (existingLevel) {
          existingLevel.strength = Math.min(5, existingLevel.strength + 1);
          existingLevel.lastTouch = new Date();
        } else {
          levels.push({
            level: curr.low,
            type: 'support',
            strength: 1,
            lastTouch: new Date()
          });
        }
      }
    }
    
    // Ordenar por força e retornar top níveis
    return levels
      .filter(l => l.strength >= 2) // Pelo menos 2 toques
      .sort((a, b) => b.strength - a.strength)
      .slice(0, 5); // Top 5 níveis
  }, []);

  // 💰 Calcular qty para garantir $0.20 mínimo de profit
  const calculateQtyForMinProfit = useCallback((
    entryPrice: number,
    takeProfit: number,
    leverage: number,
    minOrderQty: number,
    qtyStep: number
  ): { qty: string; expectedProfit: number } => {
    // profit = (|TP - entry| / entry) * qty * entry * leverage
    // MIN_PROFIT = (tpDist%) * qty * entry * leverage
    // qty = MIN_PROFIT / (tpDist% * entry * leverage)
    
    const tpDistPct = Math.abs(takeProfit - entryPrice) / entryPrice;
    const minQty = MIN_PROFIT_TARGET / (tpDistPct * entryPrice * leverage);
    
    // Arredondar para qtyStep (usar floor para evitar qty inválido)
    const adjustedQty = Math.floor(minQty / qtyStep) * qtyStep;
    const finalQty = Math.max(adjustedQty, minOrderQty);
    
    // Recalcular expected profit
    const expectedProfit = tpDistPct * finalQty * entryPrice * leverage;
    
    // Calcular casas decimais corretas baseado no qtyStep
    const decimalPlaces = qtyStep.toString().includes('.') 
      ? qtyStep.toString().split('.')[1].length 
      : 0;
    
    return {
      qty: finalQty.toFixed(decimalPlaces),
      expectedProfit
    };
  }, []);

  // 🎯 Criar ordem armada em nível S/R
  const createArmedOrder = useCallback(async (
    symbol: string,
    srLevel: SupportResistance,
    currentPrice: number,
    leverage: number,
    instrument: any
  ): Promise<ArmedOrder | null> => {
    // Determinar lado baseado no tipo de S/R
    // Suporte = comprar quando preço chega, Resistência = vender quando preço chega
    const side: 'Buy' | 'Sell' = srLevel.type === 'support' ? 'Buy' : 'Sell';
    
    // Entry no nível S/R
    const entryPrice = srLevel.level;
    
    // Verificar se preço está próximo o suficiente (máx 1% de distância)
    const distanceFromCurrent = Math.abs(currentPrice - entryPrice) / currentPrice;
    if (distanceFromCurrent > 0.01) {
      console.log(`⚠️ ${symbol}: S/R ${entryPrice.toFixed(4)} muito longe do preço atual ${currentPrice.toFixed(4)} (${(distanceFromCurrent * 100).toFixed(2)}%)`);
      return null;
    }
    
    // Stop Loss: 0.15% além do S/R
    // Take Profit: 0.50% na direção favorável (R:R ~3.3:1)
    let stopLoss: number;
    let takeProfit: number;
    
    if (side === 'Buy') {
      // Comprando no suporte: SL abaixo, TP acima
      stopLoss = entryPrice * (1 - SR_DISTANCE_PCT / 100);
      takeProfit = entryPrice * (1 + TP_DISTANCE_PCT / 100);
    } else {
      // Vendendo na resistência: SL acima, TP abaixo
      stopLoss = entryPrice * (1 + SR_DISTANCE_PCT / 100);
      takeProfit = entryPrice * (1 - TP_DISTANCE_PCT / 100);
    }
    
    // Calcular qty para $0.20 mínimo
    const lotSizeFilter = instrument.lotSizeFilter || {};
    const minOrderQty = parseFloat(lotSizeFilter.minOrderQty || '0.01');
    const qtyStep = parseFloat(lotSizeFilter.qtyStep || '0.01');
    
    const { qty, expectedProfit } = calculateQtyForMinProfit(
      entryPrice, takeProfit, leverage, minOrderQty, qtyStep
    );
    
    const armedOrder: ArmedOrder = {
      id: `${symbol}-${Date.now()}`,
      symbol,
      side,
      entryPrice,
      stopLoss,
      takeProfit,
      qty,
      leverage,
      srLevel: srLevel.level,
      srType: srLevel.type,
      status: 'armed',
      createdAt: new Date(),
      expectedProfit
    };
    
    console.log(`🎯 ORDEM ARMADA: ${symbol} ${side} @ ${entryPrice.toFixed(4)} | SL: ${stopLoss.toFixed(4)} | TP: ${takeProfit.toFixed(4)} | Profit esperado: $${expectedProfit.toFixed(2)}`);
    
    return armedOrder;
  }, [calculateQtyForMinProfit]);

  // 🔫 Disparar ordem armada (quando preço atinge o nível)
  const triggerArmedOrder = useCallback(async (order: ArmedOrder): Promise<boolean> => {
    try {
      console.log(`🔫 DISPARANDO ordem armada: ${order.symbol} ${order.side} @ ${order.entryPrice}`);
      
      // Configurar alavancagem
      await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'set_leverage',
          isTestnet: false,
          params: {
            category: 'linear',
            symbol: order.symbol,
            buyLeverage: order.leverage.toString(),
            sellLeverage: order.leverage.toString()
          }
        }
      });
      
      // Colocar ordem limite no nível S/R
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'place_order',
          isTestnet: false,
          params: {
            category: 'linear',
            symbol: order.symbol,
            side: order.side,
            orderType: 'Limit',
            price: order.entryPrice.toFixed(4),
            qty: order.qty,
            stopLoss: order.stopLoss.toFixed(4),
            takeProfit: order.takeProfit.toFixed(4),
            timeInForce: 'GTC',
            positionIdx: 0,
            reduceOnly: false
          }
        }
      });
      
      if (error) {
        console.error(`❌ Erro ao disparar ordem armada:`, error);
        return false;
      }
      
      if (data?.success) {
        console.log(`✅ Ordem armada disparada com sucesso: ${order.symbol}`);
        
        // Salvar no banco
        const userId = await getUserId();
        await supabase.from('auto_trader_positions').insert({
          user_id: userId,
          symbol: order.symbol,
          side: order.side,
          entry_price: order.entryPrice,
          qty: parseFloat(order.qty),
          leverage: order.leverage,
          stop_loss: order.stopLoss,
          take_profit: order.takeProfit,
          status: 'OPEN',
          order_source: 'armed_sr',
          confidence: order.srType === 'support' ? 75 : 70
        });
        
        return true;
      }
      
      return false;
    } catch (err) {
      console.error(`❌ Erro ao disparar ordem armada:`, err);
      return false;
    }
  }, []);

  // 📊 Analisar performance por hora/ativo
  const analyzeHourlyPerformance = useCallback(async (): Promise<HourlyPerformance[]> => {
    try {
      setIsAnalyzing(true);
      
      const userId = await getUserId();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      
      const { data: trades, error } = await supabase
        .from('auto_trader_positions')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'CLOSED')
        .gte('closed_at', thirtyDaysAgo.toISOString())
        .not('realized_pnl', 'is', null);
      
      if (error || !trades) {
        console.error('Erro ao buscar trades:', error);
        return [];
      }
      
      // Agrupar por símbolo + hora
      const grouped = new Map<string, HourlyPerformance>();
      
      for (const trade of trades) {
        const closedAt = new Date(trade.closed_at || trade.opened_at);
        const hour = closedAt.getUTCHours();
        const key = `${trade.symbol}-${hour}`;
        
        if (!grouped.has(key)) {
          grouped.set(key, {
            symbol: trade.symbol,
            hour,
            trades: 0,
            wins: 0,
            losses: 0,
            totalPnl: 0,
            avgPnl: 0,
            winRate: 0
          });
        }
        
        const perf = grouped.get(key)!;
        perf.trades++;
        perf.totalPnl += trade.realized_pnl || 0;
        
        if ((trade.realized_pnl || 0) > 0) {
          perf.wins++;
        } else {
          perf.losses++;
        }
        
        perf.avgPnl = perf.totalPnl / perf.trades;
        perf.winRate = (perf.wins / perf.trades) * 100;
      }
      
      const performances = Array.from(grouped.values())
        .filter(p => p.trades >= 3) // Mínimo 3 trades
        .sort((a, b) => b.winRate - a.winRate);
      
      setHourlyPerformance(performances);
      return performances;
    } catch (err) {
      console.error('Erro na análise por hora:', err);
      return [];
    } finally {
      setIsAnalyzing(false);
    }
  }, []);

  // 🏆 Obter melhores ativos para hora atual
  const getBestAssetsForCurrentHour = useCallback((): HourlyPerformance[] => {
    const currentHour = new Date().getUTCHours();
    
    return hourlyPerformance
      .filter(p => p.hour === currentHour && p.winRate >= 50 && p.totalPnl > 0)
      .sort((a, b) => {
        // Priorizar por: 1) PnL total, 2) Win rate
        const scoreA = a.totalPnl * (a.winRate / 100);
        const scoreB = b.totalPnl * (b.winRate / 100);
        return scoreB - scoreA;
      })
      .slice(0, 10);
  }, [hourlyPerformance]);

  // 🔄 Buscar candles e atualizar S/R
  const updateSRLevels = useCallback(async (symbol: string): Promise<SupportResistance[]> => {
    try {
      // Rate limit: 1 análise por símbolo a cada 5 min
      const lastTime = lastAnalysis.current.get(symbol) || 0;
      if (Date.now() - lastTime < 5 * 60 * 1000) {
        return srLevels.get(symbol) || [];
      }
      
      lastAnalysis.current.set(symbol, Date.now());
      
      // Buscar klines da Bybit
      const { data, error } = await supabase.functions.invoke('bybit-trading', {
        body: {
          action: 'get_klines',
          isTestnet: false,
          params: {
            category: 'linear',
            symbol,
            interval: '5', // 5 minutos
            limit: 100
          }
        }
      });
      
      if (error || !data?.data?.list) {
        console.error(`Erro ao buscar klines para ${symbol}:`, error);
        return [];
      }
      
      // Converter klines para formato de candles
      const candles = data.data.list.map((k: any) => ({
        high: parseFloat(k[2]),
        low: parseFloat(k[3]),
        open: parseFloat(k[1]),
        close: parseFloat(k[4])
      })).reverse(); // Mais antigo primeiro
      
      const levels = await detectSupportResistance(symbol, candles);
      
      setSrLevels(prev => {
        const newMap = new Map(prev);
        newMap.set(symbol, levels);
        return newMap;
      });
      
      console.log(`📊 ${symbol}: ${levels.length} níveis S/R detectados`);
      levels.forEach(l => {
        console.log(`   ${l.type === 'support' ? '🟢' : '🔴'} ${l.level.toFixed(4)} (força: ${l.strength})`);
      });
      
      return levels;
    } catch (err) {
      console.error(`Erro ao atualizar S/R para ${symbol}:`, err);
      return [];
    }
  }, [detectSupportResistance, srLevels]);

  // 🎯 Verificar e armar ordens próximas de S/R
  const checkAndArmOrders = useCallback(async (
    assets: { symbol: string; ticker: any; instrument: any }[],
    leverage: number
  ): Promise<ArmedOrder[]> => {
    const newArmedOrders: ArmedOrder[] = [];
    
    for (const asset of assets.slice(0, 5)) { // Top 5 ativos
      const { symbol, ticker, instrument } = asset;
      const currentPrice = parseFloat(ticker.lastPrice);
      
      // Atualizar S/R
      const levels = await updateSRLevels(symbol);
      
      // Encontrar S/R mais próximo
      const nearestSR = levels
        .map(l => ({
          ...l,
          distance: Math.abs(currentPrice - l.level) / currentPrice
        }))
        .filter(l => l.distance <= 0.01) // Máx 1% de distância
        .sort((a, b) => a.distance - b.distance)[0];
      
      if (nearestSR) {
        // Verificar se já não tem ordem armada para este nível
        const existing = armedOrders.find(o => 
          o.symbol === symbol && 
          Math.abs(o.srLevel - nearestSR.level) / nearestSR.level < 0.001 &&
          o.status === 'armed'
        );
        
        if (!existing) {
          const order = await createArmedOrder(symbol, nearestSR, currentPrice, leverage, instrument);
          if (order) {
            newArmedOrders.push(order);
          }
        }
      }
    }
    
    if (newArmedOrders.length > 0) {
      setArmedOrders(prev => [...prev.filter(o => o.status === 'armed'), ...newArmedOrders]);
    }
    
    return newArmedOrders;
  }, [updateSRLevels, armedOrders, createArmedOrder]);

  // 🔍 Verificar ordens armadas para disparo
  const checkArmedOrdersForTrigger = useCallback(async (
    tickers: Map<string, { lastPrice: string }>
  ): Promise<void> => {
    for (const order of armedOrders) {
      if (order.status !== 'armed') continue;
      
      const ticker = tickers.get(order.symbol);
      if (!ticker) continue;
      
      const currentPrice = parseFloat(ticker.lastPrice);
      const triggerDistance = Math.abs(currentPrice - order.entryPrice) / order.entryPrice;
      
      // Disparar quando preço estiver a 0.05% do nível S/R
      if (triggerDistance <= 0.0005) {
        console.log(`🎯 ${order.symbol}: Preço ${currentPrice.toFixed(4)} próximo do S/R ${order.entryPrice.toFixed(4)} - DISPARANDO!`);
        
        const success = await triggerArmedOrder(order);
        
        setArmedOrders(prev => prev.map(o => 
          o.id === order.id 
            ? { ...o, status: success ? 'triggered' : 'armed' }
            : o
        ));
      }
    }
  }, [armedOrders, triggerArmedOrder]);

  // Limpar ordens antigas
  const cleanupOldOrders = useCallback(() => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    
    setArmedOrders(prev => prev.filter(o => 
      o.status === 'triggered' || o.createdAt > oneHourAgo
    ));
  }, []);

  // Carregar análise inicial
  useEffect(() => {
    analyzeHourlyPerformance();
  }, []);

  return {
    // Estado
    armedOrders,
    hourlyPerformance,
    srLevels,
    isAnalyzing,
    
    // Ações
    detectSupportResistance,
    createArmedOrder,
    triggerArmedOrder,
    analyzeHourlyPerformance,
    getBestAssetsForCurrentHour,
    updateSRLevels,
    checkAndArmOrders,
    checkArmedOrdersForTrigger,
    cleanupOldOrders,
    calculateQtyForMinProfit,
    
    // Constantes
    MIN_PROFIT_TARGET,
    MIN_RR_RATIO,
  };
};
