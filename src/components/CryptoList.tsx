import { ArrowUpIcon, ArrowDownIcon, TrendingUpIcon, AlertCircleIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";

const fetchCryptoData = async () => {
  const response = await fetch('https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=10&page=1&sparkline=true&price_change_percentage=1h%2C24h%2C7d');
  if (!response.ok) {
    throw new Error('Network response was not ok');
  }
  return response.json();
};

const calculateTechnicalScore = (crypto: any) => {
  // Algoritmo simples para calcular score técnico baseado em múltiplos fatores
  const change1h = crypto.price_change_percentage_1h_in_currency || 0;
  const change24h = crypto.price_change_percentage_24h || 0;
  const change7d = crypto.price_change_percentage_7d_in_currency || 0;
  const volume = crypto.total_volume;
  const marketCap = crypto.market_cap;
  
  let score = 50; // Score base neutro
  
  // Volume factor (0-20 pontos)
  const volumeRatio = volume / marketCap;
  if (volumeRatio > 0.1) score += 15;
  else if (volumeRatio > 0.05) score += 10;
  else if (volumeRatio > 0.02) score += 5;
  
  // Momentum factor (0-30 pontos)
  const avgChange = (change1h + change24h + change7d) / 3;
  if (avgChange > 5) score += 20;
  else if (avgChange > 2) score += 15;
  else if (avgChange > 0) score += 10;
  else if (avgChange > -2) score += 5;
  else score -= 10;
  
  // Volatilidade factor (-10 a +10 pontos)
  const volatility = Math.abs(change24h - change1h);
  if (volatility > 10) score -= 5;
  else if (volatility < 2) score += 5;
  
  return Math.max(0, Math.min(100, Math.round(score)));
};

const CryptoList = () => {
  const { data: cryptos, isLoading } = useQuery({
    queryKey: ['cryptos'],
    queryFn: fetchCryptoData,
    refetchInterval: 15000, // Atualização mais frequente
  });

  if (isLoading) {
    return (
      <div className="glass-card rounded-lg p-6 animate-pulse">
        <div className="h-6 bg-muted rounded mb-4"></div>
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => (
            <div key={i} className="h-12 bg-muted rounded"></div>
          ))}
        </div>
      </div>
    );
  }

  const getScoreColor = (score: number) => {
    if (score >= 75) return 'text-success';
    if (score >= 60) return 'text-warning';
    if (score >= 40) return 'text-muted-foreground';
    return 'text-destructive';
  };

  const getSignalBadge = (score: number) => {
    if (score >= 75) return { text: 'COMPRA FORTE', variant: 'default' as const };
    if (score >= 65) return { text: 'COMPRA', variant: 'secondary' as const };
    if (score >= 55) return { text: 'NEUTRO+', variant: 'outline' as const };
    if (score >= 45) return { text: 'NEUTRO', variant: 'outline' as const };
    if (score >= 35) return { text: 'VENDA', variant: 'destructive' as const };
    return { text: 'VENDA FORTE', variant: 'destructive' as const };
  };

  return (
    <div className="glass-card rounded-lg p-6 animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold">Top Criptomoedas - Análise Técnica</h2>
        <Badge variant="outline" className="animate-pulse">
          Atualização: 15s
        </Badge>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="text-left text-sm text-muted-foreground">
              <th className="pb-4">Moeda</th>
              <th className="pb-4">Preço</th>
              <th className="pb-4">1h / 24h / 7d</th>
              <th className="pb-4">Volume</th>
              <th className="pb-4">Score Técnico</th>
              <th className="pb-4">Sinal</th>
            </tr>
          </thead>
          <tbody>
            {cryptos?.map((crypto: any) => {
              const technicalScore = calculateTechnicalScore(crypto);
              const signal = getSignalBadge(technicalScore);
              
              return (
                <tr key={crypto.symbol} className="border-t border-secondary hover:bg-muted/20 transition-colors">
                  <td className="py-4">
                    <div className="flex items-center gap-3">
                      <img src={crypto.image} alt={crypto.name} className="w-8 h-8 rounded-full" />
                      <div>
                        <p className="font-medium">{crypto.name}</p>
                        <p className="text-sm text-muted-foreground">
                          {crypto.symbol.toUpperCase()} 
                          <span className="ml-1">#{crypto.market_cap_rank}</span>
                        </p>
                      </div>
                    </div>
                  </td>
                  
                  <td className="py-4">
                    <div className="font-mono">
                      ${crypto.current_price >= 1 
                        ? crypto.current_price.toLocaleString(undefined, {maximumFractionDigits: 2})
                        : crypto.current_price.toFixed(6)
                      }
                    </div>
                  </td>
                  
                  <td className="py-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`flex items-center gap-1 ${
                          (crypto.price_change_percentage_1h_in_currency || 0) >= 0 ? "text-success" : "text-destructive"
                        }`}>
                          {(crypto.price_change_percentage_1h_in_currency || 0) >= 0 ? (
                            <ArrowUpIcon className="w-2 h-2" />
                          ) : (
                            <ArrowDownIcon className="w-2 h-2" />
                          )}
                          {Math.abs(crypto.price_change_percentage_1h_in_currency || 0).toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-sm">
                        <span className={`flex items-center gap-1 ${
                          crypto.price_change_percentage_24h >= 0 ? "text-success" : "text-destructive"
                        }`}>
                          {crypto.price_change_percentage_24h >= 0 ? (
                            <ArrowUpIcon className="w-3 h-3" />
                          ) : (
                            <ArrowDownIcon className="w-3 h-3" />
                          )}
                          {Math.abs(crypto.price_change_percentage_24h).toFixed(1)}%
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-2 text-xs">
                        <span className={`flex items-center gap-1 ${
                          (crypto.price_change_percentage_7d_in_currency || 0) >= 0 ? "text-success" : "text-destructive"
                        }`}>
                          {(crypto.price_change_percentage_7d_in_currency || 0) >= 0 ? (
                            <TrendingUpIcon className="w-2 h-2" />
                          ) : (
                            <TrendingUpIcon className="w-2 h-2 rotate-180" />
                          )}
                          {Math.abs(crypto.price_change_percentage_7d_in_currency || 0).toFixed(1)}%
                        </span>
                      </div>
                    </div>
                  </td>
                  
                  <td className="py-4">
                    <div className="text-sm">
                      ${(crypto.total_volume / 1e9).toFixed(2)}B
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Vol/MC: {((crypto.total_volume / crypto.market_cap) * 100).toFixed(1)}%
                    </div>
                  </td>
                  
                  <td className="py-4">
                    <div className="flex items-center gap-2">
                      <div className={`text-lg font-bold ${getScoreColor(technicalScore)}`}>
                        {technicalScore}
                      </div>
                      <div className="w-16">
                        <Progress value={technicalScore} className="h-2" />
                      </div>
                    </div>
                  </td>
                  
                  <td className="py-4">
                    <Badge variant={signal.variant} className="text-xs whitespace-nowrap">
                      {signal.text}
                    </Badge>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1">
            <AlertCircleIcon className="w-3 h-3" />
            Score técnico baseado em volume, momentum e volatilidade
          </div>
          <div>• Atualização automática a cada 15 segundos</div>
          <div>• Dados em tempo real via CoinGecko</div>
        </div>
      </div>
    </div>
  );
};

export default CryptoList;