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
    <div className="flex gap-3">
      {/* Painel de Preços */}
      <div className="w-28 flex-shrink-0 bg-muted/50 rounded-lg p-2 space-y-2 text-xs">
        <div className="text-center pb-1 border-b border-border">
          <span className="font-bold text-primary">{symbol.replace('USDT', '')}</span>
        </div>
        
        {entryPrice && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Entrada</span>
            <span className="font-mono font-medium text-blue-400">${entryPrice.toFixed(4)}</span>
          </div>
        )}
        
        {currentPrice && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Atual</span>
            <span className={`font-mono font-bold ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              ${currentPrice.toFixed(4)}
            </span>
          </div>
        )}
        
        {stopLoss && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">SL</span>
            <span className="font-mono text-red-500">${stopLoss.toFixed(4)}</span>
          </div>
        )}
        
        {takeProfit && (
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">TP</span>
            <span className="font-mono text-green-500">${takeProfit.toFixed(4)}</span>
          </div>
        )}
        
        {entryPrice && currentPrice && (
          <div className="pt-1 border-t border-border text-center">
            <span className={`font-bold text-sm ${pnl >= 0 ? 'text-green-400' : 'text-red-400'}`}>
              {pnl >= 0 ? '+' : ''}{pnl.toFixed(2)}%
            </span>
          </div>
        )}
      </div>
      
      {/* Gráfico TradingView */}
      <div 
        style={{ height: `${height}px` }} 
        className="flex-1 rounded-lg overflow-hidden border border-border bg-background"
      >
        <TradingViewWidget
          symbol={tvSymbol}
          theme="Dark"
          locale="pt_BR"
          autosize
          hide_side_toolbar={false}
          allow_symbol_change={true}
          interval="5"
          toolbar_bg="#1a1a2e"
          enable_publishing={false}
          hide_top_toolbar={false}
          save_image={false}
          container_id={`tv_chart_${symbol}`}
          withdateranges={true}
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
