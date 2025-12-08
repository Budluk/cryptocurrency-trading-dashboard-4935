import TradingViewWidget from 'react-tradingview-widget';
import { memo } from 'react';

interface MiniChartProps {
  symbol: string;
  height?: number;
}

// Memo com comparação por symbol para evitar re-renders desnecessários
const MiniChart = memo(({ symbol, height = 220 }: MiniChartProps) => {
  // Converte símbolo Bybit para TradingView (ex: BTCUSDT -> BINANCE:BTCUSDT)
  const tvSymbol = `BINANCE:${symbol}`;
  
  return (
    <div 
      style={{ height: `${height}px` }} 
      className="w-full rounded-lg overflow-hidden border border-border bg-background"
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
  );
}, (prevProps, nextProps) => prevProps.symbol === nextProps.symbol && prevProps.height === nextProps.height);

MiniChart.displayName = 'MiniChart';

export default MiniChart;
