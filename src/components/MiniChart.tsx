import TradingViewWidget from 'react-tradingview-widget';
import { useEffect, useState } from 'react';

interface MiniChartProps {
  symbol: string;
  height?: number;
}

const MiniChart = ({ symbol, height = 250 }: MiniChartProps) => {
  // State para forçar remount quando símbolo mudar
  const [key, setKey] = useState(`${symbol}_${Date.now()}`);
  
  // Forçar remount do widget quando o símbolo mudar
  useEffect(() => {
    setKey(`${symbol}_${Date.now()}`);
  }, [symbol]);
  
  // Converte símbolo Bybit para TradingView (ex: BTCUSDT -> BINANCE:BTCUSDT)
  const tvSymbol = `BINANCE:${symbol}`;
  
  return (
    <div 
      key={key}
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
        container_id={`chart_${symbol}_${key}`}
        withdateranges={true}
        hide_legend={false}
        style="1"
        studies={["RSI@tv-basicstudies"]}
      />
    </div>
  );
};

MiniChart.displayName = 'MiniChart';

export default MiniChart;
