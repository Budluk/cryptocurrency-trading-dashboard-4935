import { useEffect, useRef, useCallback, useState } from 'react';
import { supabase } from "@/integrations/supabase/client";
import { getUserId } from "@/lib/anonymousUser";
import { useToast } from "@/hooks/use-toast";

interface CorrectionAction {
  type: 'adjust_sl' | 'adjust_tp' | 'reduce_leverage' | 'block_symbol' | 'block_hour' | 'change_strategy';
  reason: string;
  oldValue?: number | string;
  newValue?: number | string;
  confidence: number;
}

interface AutoCorrectionConfig {
  stopLossPct: number;
  takeProfitPct: number;
  maxLeverage: number;
  blockedSymbols: string[];
  blockedHours: number[];
  minConfidence: number;
  positionSizeMultiplier: number;
}

interface CorrectionAnalysis {
  tradesAnalyzed: number;
  winRate: number;
  profitFactor: number;
  avgRR: number;
  consecutiveLosses: number;
  criticalIssues: string[];
}

// Intervalo de auto-correção: 5 minutos
const AUTO_CORRECTION_INTERVAL = 5 * 60 * 1000;

// Cache global para evitar múltiplas instâncias
let globalLastCorrection = 0;
let globalCorrectionConfig: AutoCorrectionConfig | null = null;
let globalIsRunning = false;

export const useMLAutoCorrector = () => {
  const { toast } = useToast();
  const [isEnabled, setIsEnabled] = useState(true);
  const [lastCorrections, setLastCorrections] = useState<CorrectionAction[]>([]);
  const [currentConfig, setCurrentConfig] = useState<AutoCorrectionConfig | null>(null);
  const [analysis, setAnalysis] = useState<CorrectionAnalysis | null>(null);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Executar auto-correção
  const runAutoCorrection = useCallback(async (force = false): Promise<boolean> => {
    const now = Date.now();
    
    // Evitar execuções muito frequentes (a menos que forçado)
    if (!force && now - globalLastCorrection < AUTO_CORRECTION_INTERVAL) {
      console.log('⏳ Auto-correção em cooldown');
      return false;
    }

    // Evitar execuções simultâneas
    if (globalIsRunning) {
      console.log('⏳ Auto-correção já em execução');
      return false;
    }

    try {
      globalIsRunning = true;
      globalLastCorrection = now;
      
      const userId = await getUserId();
      console.log('🔄 Iniciando auto-correção ML...');

      const { data, error } = await supabase.functions.invoke('ml-auto-corrector', {
        body: { userId }
      });

      if (error) {
        console.error('❌ Erro na auto-correção:', error);
        return false;
      }

      if (data?.success) {
        const corrections = data.corrections as CorrectionAction[];
        const newConfig = data.newConfig as AutoCorrectionConfig;
        const analysisData = data.analysis as CorrectionAnalysis;

        // Atualizar cache global
        globalCorrectionConfig = newConfig;

        // Atualizar estado
        setLastCorrections(corrections);
        setCurrentConfig(newConfig);
        setAnalysis(analysisData);

        // Notificar apenas se houver correções críticas
        if (corrections.length > 0) {
          const criticalCount = analysisData.criticalIssues.length;
          
          if (criticalCount > 0) {
            toast({
              title: "⚠️ ML Auto-Correção Ativada",
              description: `${corrections.length} ajustes aplicados. ${criticalCount} problemas críticos detectados.`,
              variant: "destructive",
            });
          } else {
            console.log(`✅ ${corrections.length} correções aplicadas silenciosamente`);
          }
        }

        console.log(`✅ Auto-correção concluída: ${corrections.length} correções`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('❌ Erro na auto-correção:', error);
      return false;
    } finally {
      globalIsRunning = false;
    }
  }, [toast]);

  // Verificar se trade deve ser bloqueado
  const shouldBlockTrade = useCallback((
    symbol: string,
    leverage: number
  ): { blocked: boolean; reason: string } => {
    const config = globalCorrectionConfig || currentConfig;
    
    if (!config) {
      return { blocked: false, reason: '' };
    }

    // Verificar símbolo bloqueado
    if (config.blockedSymbols.includes(symbol)) {
      return {
        blocked: true,
        reason: `${symbol} bloqueado pela auto-correção ML (win rate muito baixo)`
      };
    }

    // Verificar hora bloqueada
    const currentHour = new Date().getUTCHours();
    if (config.blockedHours.includes(currentHour)) {
      return {
        blocked: true,
        reason: `Hora ${currentHour}:00 UTC bloqueada pela auto-correção ML`
      };
    }

    // Verificar alavancagem máxima
    if (leverage > config.maxLeverage) {
      return {
        blocked: true,
        reason: `Alavancagem ${leverage}x excede máximo permitido ${config.maxLeverage}x`
      };
    }

    return { blocked: false, reason: '' };
  }, [currentConfig]);

  // Obter parâmetros corrigidos para trade
  const getCorrectedParams = useCallback((
    originalSL: number,
    originalTP: number,
    originalLeverage: number,
    originalQty: number
  ): {
    stopLoss: number;
    takeProfit: number;
    leverage: number;
    quantity: number;
  } => {
    const config = globalCorrectionConfig || currentConfig;
    
    if (!config) {
      return {
        stopLoss: originalSL,
        takeProfit: originalTP,
        leverage: originalLeverage,
        quantity: originalQty
      };
    }

    // Aplicar correções
    let stopLoss = originalSL;
    let takeProfit = originalTP;
    let leverage = Math.min(originalLeverage, config.maxLeverage);
    let quantity = originalQty * config.positionSizeMultiplier;

    // Se SL/TP são em percentual, aplicar correções
    // Isso é útil quando os valores originais não estão alinhados com a config ML
    
    console.log(`🔧 Parâmetros corrigidos: SL=${stopLoss}, TP=${takeProfit}, Lev=${leverage}x, Qty=${quantity.toFixed(4)}`);

    return { stopLoss, takeProfit, leverage, quantity };
  }, [currentConfig]);

  // Obter configuração atual
  const getConfig = useCallback((): AutoCorrectionConfig | null => {
    return globalCorrectionConfig || currentConfig;
  }, [currentConfig]);

  // Carregar configuração do banco ao iniciar
  const loadConfig = useCallback(async () => {
    try {
      const userId = await getUserId();
      
      const { data, error } = await supabase
        .from('ml_adaptive_config')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        // Primeira execução - rodar auto-correção
        console.log('📊 Primeira execução, rodando auto-correção...');
        await runAutoCorrection(true);
        return;
      }

      const patterns = data.optimal_patterns as any || {};
      
      const config: AutoCorrectionConfig = {
        stopLossPct: data.recommended_stop_loss_pct || 1.5,
        takeProfitPct: data.recommended_take_profit_pct || 3.0,
        maxLeverage: data.recommended_leverage || 20,
        blockedSymbols: patterns.blockedSymbols || [],
        blockedHours: patterns.blockedHours || [],
        minConfidence: (data as any).min_confidence_threshold || 80,
        positionSizeMultiplier: patterns.positionSizeMultiplier || 1.0
      };

      globalCorrectionConfig = config;
      setCurrentConfig(config);
      setLastCorrections(patterns.autoCorrections || []);

      if (patterns.criticalIssues?.length > 0) {
        setAnalysis({
          tradesAnalyzed: data.trades_analyzed || 0,
          winRate: 0,
          profitFactor: 0,
          avgRR: 0,
          consecutiveLosses: 0,
          criticalIssues: patterns.criticalIssues
        });
      }

      console.log('📊 Config ML carregada:', config);
    } catch (error) {
      console.error('❌ Erro ao carregar config ML:', error);
    }
  }, [runAutoCorrection]);

  // Iniciar auto-correção periódica
  useEffect(() => {
    if (!isEnabled) return;

    // Carregar config inicial
    loadConfig();

    // Executar auto-correção periodicamente
    intervalRef.current = setInterval(() => {
      if (isEnabled) {
        runAutoCorrection();
      }
    }, AUTO_CORRECTION_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isEnabled, loadConfig, runAutoCorrection]);

  return {
    isEnabled,
    setIsEnabled,
    runAutoCorrection,
    shouldBlockTrade,
    getCorrectedParams,
    getConfig,
    lastCorrections,
    currentConfig,
    analysis,
    isRunning: globalIsRunning
  };
};
