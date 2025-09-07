import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, ActivityIcon, AlertTriangleIcon, DollarSignIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";

const fetchRealTimeStats = async () => {
  const response = await fetch('https://api.coingecko.com/api/v3/global');
  if (!response.ok) throw new Error('Failed to fetch market data');
  
  const data = await response.json();
  return {
    marketCap: data.data.total_market_cap.usd,
    marketCapChange: data.data.market_cap_change_percentage_24h_usd,
    volume: data.data.total_volume.usd,
    btcDominance: data.data.market_cap_percentage.btc,
    activeCryptos: data.data.active_cryptocurrencies,
    fearGreedIndex: 45 + Math.random() * 30, // Simulado
    altcoinSeason: data.data.market_cap_percentage.btc < 45
  };
};

const MarketStats = () => {
  const { data: stats, isLoading } = useQuery({
    queryKey: ['marketStats'],
    queryFn: fetchRealTimeStats,
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-fade-in">
        {[1,2,3,4].map(i => (
          <div key={i} className="glass-card p-6 rounded-lg animate-pulse">
            <div className="h-4 bg-muted rounded mb-2"></div>
            <div className="h-8 bg-muted rounded mb-2"></div>
            <div className="h-4 bg-muted rounded w-16"></div>
          </div>
        ))}
      </div>
    );
  }

  const formatLargeNumber = (num: number) => {
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(1)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(1)}M`;
    return `$${num.toLocaleString()}`;
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8 animate-fade-in">
      <div className="glass-card p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Market Cap Total</h3>
          <DollarSignIcon className="w-4 h-4 text-primary" />
        </div>
        <p className="text-2xl font-semibold mt-2">
          {stats ? formatLargeNumber(stats.marketCap) : '$2.1T'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-sm flex items-center gap-1 ${
            (stats?.marketCapChange || 2.4) >= 0 ? "text-success" : "text-destructive"
          }`}>
            {(stats?.marketCapChange || 2.4) >= 0 ? (
              <ArrowUpIcon className="w-3 h-3" />
            ) : (
              <ArrowDownIcon className="w-3 h-3" />
            )}
            {Math.abs(stats?.marketCapChange || 2.4).toFixed(2)}%
          </span>
          <Badge variant="outline" className="text-xs">24h</Badge>
        </div>
      </div>
      
      <div className="glass-card p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Volume 24h</h3>
          <ActivityIcon className="w-4 h-4 text-chart-2" />
        </div>
        <p className="text-2xl font-semibold mt-2">
          {stats ? formatLargeNumber(stats.volume) : '$84.2B'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-success flex items-center gap-1">
            <TrendingUpIcon className="w-3 h-3" />
            Alto Volume
          </span>
          <Badge variant="secondary" className="text-xs">Ativo</Badge>
        </div>
      </div>
      
      <div className="glass-card p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">BTC Dominância</h3>
          <TrendingUpIcon className="w-4 h-4 text-warning" />
        </div>
        <p className="text-2xl font-semibold mt-2">
          {stats ? `${stats.btcDominance.toFixed(1)}%` : '42.1%'}
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className="text-sm text-muted-foreground">
            {stats?.altcoinSeason ? 'Altcoin Season' : 'BTC Season'}
          </span>
          <Badge 
            variant={stats?.altcoinSeason ? "default" : "secondary"} 
            className="text-xs"
          >
            {stats?.altcoinSeason ? 'ALTs' : 'BTC'}
          </Badge>
        </div>
      </div>

      <div className="glass-card p-6 rounded-lg">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-medium text-muted-foreground">Fear & Greed</h3>
          <AlertTriangleIcon className="w-4 h-4 text-chart-3" />
        </div>
        <p className="text-2xl font-semibold mt-2">
          {stats ? Math.round(stats.fearGreedIndex) : '65'}/100
        </p>
        <div className="flex items-center gap-2 mt-1">
          <span className={`text-sm ${
            (stats?.fearGreedIndex || 65) > 75 ? 'text-destructive' : 
            (stats?.fearGreedIndex || 65) > 45 ? 'text-warning' : 'text-success'
          }`}>
            {(stats?.fearGreedIndex || 65) > 75 ? 'Ganância' : 
             (stats?.fearGreedIndex || 65) > 45 ? 'Neutro' : 'Medo'}
          </span>
          <Badge variant="outline" className="text-xs">
            {stats?.activeCryptos ? `${stats.activeCryptos.toLocaleString()} moedas` : '10K+ ativos'}
          </Badge>
        </div>
      </div>
    </div>
  );
};

export default MarketStats;