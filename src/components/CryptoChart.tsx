import TradingViewWidget from 'react-tradingview-widget';

const CryptoChart = () => {
  return (
    <div className="glass-card p-6 rounded-lg mb-8 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Bitcoin Price Chart</h2>
      </div>
      <div className="h-[500px] w-full">
        <TradingViewWidget
          symbol="BINANCE:BTCUSDT"
          theme="Dark"
          locale="en"
          autosize
          hide_side_toolbar={false}
          allow_symbol_change={false}
          interval="15"
          toolbar_bg="#1A1A1A"
          enable_publishing={false}
          hide_top_toolbar={false}
          save_image={false}
          container_id="tradingview_btc_chart"
          studies={[
            "RSI@tv-basicstudies",
            "MACD@tv-basicstudies",
            "Volume@tv-basicstudies"
          ]}
          withdateranges={true}
          range="1D"
        />
      </div>
    </div>
  );
};

export default CryptoChart;