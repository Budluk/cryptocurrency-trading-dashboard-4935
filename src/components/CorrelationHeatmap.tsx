import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useCorrelationAnalysis } from "@/hooks/useCorrelationAnalysis";
import { Network, AlertTriangle, CheckCircle } from "lucide-react";

export const CorrelationHeatmap = () => {
  const { openPositions, isHighlyCorrelated, getCorrelationRisk } = useCorrelationAnalysis();
  const [correlationMatrix, setCorrelationMatrix] = useState<{ [key: string]: { [key: string]: boolean } }>({});
  const riskLevel = getCorrelationRisk();

  useEffect(() => {
    // Construir matriz de correlação
    const matrix: { [key: string]: { [key: string]: boolean } } = {};
    
    openPositions.forEach((pos1) => {
      if (!matrix[pos1.symbol]) matrix[pos1.symbol] = {};
      
      openPositions.forEach((pos2) => {
        const isCorrelated = isHighlyCorrelated(pos1.symbol, pos2.symbol);
        matrix[pos1.symbol][pos2.symbol] = isCorrelated && pos1.side === pos2.side;
      });
    });

    setCorrelationMatrix(matrix);
  }, [openPositions, isHighlyCorrelated]);

  const getColorForCorrelation = (isCorrelated: boolean, isSameAsset: boolean) => {
    if (isSameAsset) return "bg-primary/40";
    if (isCorrelated) return "bg-red-500/60";
    return "bg-green-500/20";
  };

  const getRiskBadgeVariant = () => {
    switch (riskLevel.level) {
      case 'high': return 'destructive';
      case 'medium': return 'default';
      default: return 'secondary';
    }
  };

  const getRiskIcon = () => {
    switch (riskLevel.level) {
      case 'high': return <AlertTriangle className="w-4 h-4" />;
      case 'medium': return <Network className="w-4 h-4" />;
      default: return <CheckCircle className="w-4 h-4" />;
    }
  };

  if (openPositions.length === 0) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2 mb-4">
          <Network className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Análise de Correlação</h3>
        </div>
        <p className="text-sm text-muted-foreground text-center py-8">
          Nenhuma posição aberta para análise
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <Network className="w-5 h-5 text-primary" />
          <h3 className="text-lg font-semibold">Matriz de Correlação</h3>
        </div>
        <Badge variant={getRiskBadgeVariant()} className="flex items-center gap-2">
          {getRiskIcon()}
          {riskLevel.message}
        </Badge>
      </div>

      <div className="space-y-4">
        {/* Legenda */}
        <div className="flex items-center gap-4 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-500/60 rounded"></div>
            <span>Alta Correlação (Risco)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-500/20 rounded"></div>
            <span>Baixa Correlação (OK)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-primary/40 rounded"></div>
            <span>Mesmo Ativo</span>
          </div>
        </div>

        {/* Heatmap */}
        <div className="overflow-x-auto">
          <div className="inline-block min-w-full">
            <div className="grid gap-1" style={{ gridTemplateColumns: `80px repeat(${openPositions.length}, 60px)` }}>
              {/* Header */}
              <div className="text-xs font-semibold"></div>
              {openPositions.map((pos) => (
                <div key={`header-${pos.symbol}`} className="text-xs font-semibold text-center truncate p-1">
                  {pos.symbol.replace('USDT', '').replace('/USD', '')}
                </div>
              ))}

              {/* Matrix rows */}
              {openPositions.map((pos1, i) => (
                <>
                  <div key={`label-${pos1.symbol}`} className="text-xs font-semibold flex items-center truncate pr-2">
                    {pos1.symbol.replace('USDT', '').replace('/USD', '')}
                    <Badge variant={pos1.side === 'Buy' ? 'default' : 'destructive'} className="ml-1 text-[10px] px-1 py-0">
                      {pos1.side === 'Buy' ? 'L' : 'S'}
                    </Badge>
                  </div>
                  {openPositions.map((pos2, j) => {
                    const isCorrelated = correlationMatrix[pos1.symbol]?.[pos2.symbol] || false;
                    const isSameAsset = pos1.symbol === pos2.symbol;
                    return (
                      <div
                        key={`cell-${i}-${j}`}
                        className={`${getColorForCorrelation(isCorrelated, isSameAsset)} rounded border border-border/40 h-12 flex items-center justify-center text-xs font-semibold transition-all hover:scale-105`}
                        title={`${pos1.symbol} x ${pos2.symbol}`}
                      >
                        {isSameAsset ? '●' : isCorrelated ? '⚠' : '✓'}
                      </div>
                    );
                  })}
                </>
              ))}
            </div>
          </div>
        </div>

        {/* Resumo de Risco */}
        <div className="pt-4 border-t border-border">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-muted-foreground">Posições Totais</p>
              <p className="text-xl font-bold">{openPositions.length}</p>
            </div>
            <div>
              <p className="text-muted-foreground">Long</p>
              <p className="text-xl font-bold text-green-500">
                {openPositions.filter(p => p.side === 'Buy').length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Short</p>
              <p className="text-xl font-bold text-red-500">
                {openPositions.filter(p => p.side === 'Sell').length}
              </p>
            </div>
            <div>
              <p className="text-muted-foreground">Nível de Risco</p>
              <p className={`text-xl font-bold ${
                riskLevel.level === 'high' ? 'text-red-500' : 
                riskLevel.level === 'medium' ? 'text-yellow-500' : 'text-green-500'
              }`}>
                {riskLevel.level === 'high' ? 'Alto' : riskLevel.level === 'medium' ? 'Médio' : 'Baixo'}
              </p>
            </div>
          </div>
        </div>
      </div>
    </Card>
  );
};
