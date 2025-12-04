import TradingViewWidget from 'react-tradingview-widget';
import { memo } from 'react';

interface MiniChartProps {
  symbol: string;
  height?: number;
}

const MiniChart = memo(({ symbol, height = 200 }: MiniChartProps) => {
  // Converte símbolo Bybit para TradingView (ex: BTCUSDT -> BINANCE:BTCUSDT)
  const tvSymbol = `BINANCE:${symbol}`;
  
  return (
    <div style={{ height: `${height}px` }} className="w-full rounded-lg overflow-hidden border border-border">
      <TradingViewWidget
        symbol={tvSymbol}
        theme="Dark"
        locale="pt_BR"
        autosize
        hide_side_toolbar={true}
        allow_symbol_change={false}
        interval="5"
        toolbar_bg="#0a0a0a"
        enable_publishing={false}
        hide_top_toolbar={true}
        save_image={false}
        container_id={`chart_${symbol}`}
        withdateranges={false}
        hide_legend={true}
        style="1"
      />
    </div>
  );
});

MiniChart.displayName = 'MiniChart';

export default MiniChart;
