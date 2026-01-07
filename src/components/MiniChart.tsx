import TradingViewWidget from 'react-tradingview-widget';
import { memo } from 'react';

interface MiniChartProps {
  symbol: string;
  height?: number;
  entryPrice?: number;
  currentPrice?: number;
  stopLoss?: number;
  takeProfit?: number;
  side?: string;
}

const MiniChart = memo(({ 
  symbol, 
  height = 320,
  entryPrice,
  currentPrice,
  stopLoss,
  takeProfit,
  side
}: MiniChartProps) => {
  // Usa BYBIT como exchange no TradingView
  const tvSymbol = `BYBIT:${symbol}.P`;
  
  const pnl = entryPrice && currentPrice 
    ? side === 'Buy' 
      ? ((currentPrice - entryPrice) / entryPrice) * 100
      : ((entryPrice - currentPrice) / entryPrice) * 100
    : 0;
  
  return (
    <div className="flex flex-col gap-2">
      {/* Painel de Preços - Mobile: Horizontal / Desktop: Lateral */}
      <div className="flex flex-wrap gap-2 sm:gap-3 bg-muted/50 rounded-lg p-2 text-xs">
        <div className="text-center px-2 py-1 border-r border-border/50 sm:border-r-0">
          <span className="font-bold text-primary text-sm">{symbol.replace('USDT', '')}</span>
        </div>
        
        {entryPrice && (
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className="text-muted-foreground">Entrada:</span>
            <span className="font-mono font-medium text-blue-400">${entryPrice.toFixed(4)}</span>
          </div>
        )}
        
        {currentPrice && (
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className="text-muted-foreground">Atual:</span>
            <span className={`font-mono font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${currentPrice.toFixed(4)}
            </span>
          </div>
        )}
        
        {stopLoss && (
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className="text-muted-foreground">SL:</span>
            <span className="font-mono text-red-500">${stopLoss.toFixed(4)}</span>
          </div>
        )}
        
        {takeProfit && (
          <div className="flex items-center gap-1.5 px-2 py-1">
            <span className="text-muted-foreground">TP:</span>
            <span className="font-mono text-green-500">${takeProfit.toFixed(4)}</span>
          </div>
        )}
        
        {entryPrice && currentPrice && (
          <div className="flex items-center gap-1.5 px-2 py-1 ml-auto">
            <span className={`font-bold text-sm ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
      
      {/* Gráfico TradingView - Largura Total */}
      <div 
        style={{ height: `${height}px` }} 
        className="w-full rounded-lg overflow-hidden border border-border bg-background"
      >
        <TradingViewWidget
          symbol={tvSymbol}
          theme="Dark"
          locale="pt_BR"
          autosize
          hide_side_toolbar={true}
          allow_symbol_change={false}
          interval="5"
          toolbar_bg="#1a1a2e"
          enable_publishing={false}
          hide_top_toolbar={false}
          save_image={false}
          container_id={`tv_chart_${symbol}`}
          withdateranges={false}
          hide_legend={false}
          style="1"
        />
      </div>
    </div>
  );
}, (prevProps, nextProps) => 
  prevProps.symbol === nextProps.symbol && 
  prevProps.height === nextProps.height &&
  prevProps.entryPrice === nextProps.entryPrice &&
  prevProps.currentPrice === nextProps.currentPrice
);

MiniChart.displayName = 'MiniChart';

export default MiniChart;
