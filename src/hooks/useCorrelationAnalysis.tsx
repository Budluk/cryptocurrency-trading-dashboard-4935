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

    // Mesmo ativo - não conta como correlação (será tratado separadamente)
    if (base1 === base2) return false;

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
    const baseSymbol = getBaseAsset(symbol);
    
    // Verificar se já existe posição no mesmo ativo e mesma direção
    const sameAssetPositions = openPositions.filter(p => 
      getBaseAsset(p.symbol) === baseSymbol && p.side === side
    );
    
    if (sameAssetPositions.length >= 3) {
      return {
        allowed: false,
        reason: `Limite de 3 posições ${side === 'Buy' ? 'LONG' : 'SHORT'} no mesmo ativo (${baseSymbol}) atingido`,
        correlatedPositions: [symbol],
      };
    }

    // Verificar correlação com outros ativos (usando Set para símbolos únicos)
    const correlatedSymbols = new Set<string>();

    for (const position of openPositions) {
      if (isHighlyCorrelated(symbol, position.symbol) && position.side === side) {
        correlatedSymbols.add(getBaseAsset(position.symbol));
      }
    }

    if (correlatedSymbols.size >= 2) {
      return {
        allowed: false,
        reason: `Alta correlação com ${correlatedSymbols.size} ativos: ${Array.from(correlatedSymbols).join(', ')}`,
        correlatedPositions: Array.from(correlatedSymbols),
      };
    }

    // Limitar posições na mesma direção (usando Set para contar ativos únicos)
    const uniqueSymbolsBySide = new Set(
      openPositions.filter(p => p.side === side).map(p => getBaseAsset(p.symbol))
    );
    
    if (uniqueSymbolsBySide.size >= 5) {
      return {
        allowed: false,
        reason: `Limite de 5 ativos ${side === 'Buy' ? 'LONG' : 'SHORT'} simultâneos atingido`,
      };
    }

    return { allowed: true };
  };

  const getCorrelationRisk = (): {
    level: 'low' | 'medium' | 'high';
    message: string;
  } => {
    // Usar apenas ativos únicos para análise
    const uniquePositions = Array.from(
      new Map(openPositions.map(p => [getBaseAsset(p.symbol) + p.side, p])).values()
    );
    
    let correlatedPairs = 0;
    
    for (let i = 0; i < uniquePositions.length; i++) {
      for (let j = i + 1; j < uniquePositions.length; j++) {
        if (isHighlyCorrelated(uniquePositions[i].symbol, uniquePositions[j].symbol)) {
          if (uniquePositions[i].side === uniquePositions[j].side) {
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
