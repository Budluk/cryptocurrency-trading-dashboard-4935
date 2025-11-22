import { usePositions } from "@/contexts/PositionsContext";

// Pares de ativos conhecidos com alta correlação (>0.7)
const HIGH_CORRELATION_PAIRS: { [key: string]: string[] } = {
  'BTC': ['BCH', 'BTT', 'BSV'],
  'ETH': ['ETC', 'MATIC', 'LINK', 'UNI'],
  'BNB': ['CAKE', 'XVS'],
  'SOL': ['RAY', 'SRM'],
  'DOT': ['KSM'],
  'ADA': ['ERG'],
  'AVAX': ['JOE', 'PNG'],
};

export const useCorrelationAnalysis = () => {
  const { openPositions } = usePositions();

  const getBaseAsset = (symbol: string): string => {
    // Remove /USD, /USDT, USDT suffix
    return symbol.replace(/\/USD.*|USDT/g, '').trim();
  };

  const isHighlyCorrelated = (asset1: string, asset2: string): boolean => {
    const base1 = getBaseAsset(asset1);
    const base2 = getBaseAsset(asset2);

    // Mesmo ativo
    if (base1 === base2) return true;

    // Verifica pares conhecidos
    for (const [key, correlatedAssets] of Object.entries(HIGH_CORRELATION_PAIRS)) {
      if (base1 === key && correlatedAssets.includes(base2)) return true;
      if (base2 === key && correlatedAssets.includes(base1)) return true;
      if (correlatedAssets.includes(base1) && correlatedAssets.includes(base2)) return true;
    }

    return false;
  };

  const checkNewPosition = (symbol: string, side: string): {
    allowed: boolean;
    reason?: string;
    correlatedPositions?: string[];
  } => {
    const correlatedPositions: string[] = [];

    for (const position of openPositions) {
      if (isHighlyCorrelated(symbol, position.symbol)) {
        // Se mesma direção (Long/Long ou Short/Short), há risco de correlação
        if (position.side === side) {
          correlatedPositions.push(position.symbol);
        }
      }
    }

    if (correlatedPositions.length >= 2) {
      return {
        allowed: false,
        reason: `Alta correlação detectada com ${correlatedPositions.length} posições abertas: ${correlatedPositions.join(', ')}`,
        correlatedPositions,
      };
    }

    // Limitar posições na mesma direção
    const sameSideCount = openPositions.filter(p => p.side === side).length;
    if (sameSideCount >= 5) {
      return {
        allowed: false,
        reason: `Limite de 5 posições ${side === 'Buy' ? 'LONG' : 'SHORT'} simultâneas atingido (diversificação)`,
      };
    }

    return { allowed: true };
  };

  const getCorrelationRisk = (): {
    level: 'low' | 'medium' | 'high';
    message: string;
  } => {
    let correlatedPairs = 0;
    
    for (let i = 0; i < openPositions.length; i++) {
      for (let j = i + 1; j < openPositions.length; j++) {
        if (isHighlyCorrelated(openPositions[i].symbol, openPositions[j].symbol)) {
          if (openPositions[i].side === openPositions[j].side) {
            correlatedPairs++;
          }
        }
      }
    }

    if (correlatedPairs === 0) {
      return { level: 'low', message: 'Portfólio bem diversificado' };
    } else if (correlatedPairs <= 2) {
      return { level: 'medium', message: `${correlatedPairs} par(es) correlacionado(s) detectado(s)` };
    } else {
      return { level: 'high', message: `RISCO: ${correlatedPairs} pares altamente correlacionados` };
    }
  };

  return {
    openPositions,
    checkNewPosition,
    getCorrelationRisk,
    isHighlyCorrelated,
  };
};
