import { useQuery } from "@tanstack/react-query";
import { Newspaper, ExternalLinkIcon, TrendingUpIcon, TrendingDownIcon, ClockIcon } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  impact: 'HIGH' | 'MEDIUM' | 'LOW';
  sentiment: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  timestamp: string;
  source: string;
  priceImpact: number;
  relevantSymbols: string[];
}

const fetchCryptoNews = async (): Promise<NewsItem[]> => {
  // Simulando notícias reais com impacto no mercado
  const newsItems: NewsItem[] = [
    {
      id: '1',
      title: 'MicroStrategy adiciona mais 5.262 BTC ao portfólio institucional',
      summary: 'A empresa de software aumentou suas reservas de Bitcoin, sinalizando confiança continuada na criptomoeda como reserva de valor corporativa.',
      impact: 'HIGH',
      sentiment: 'POSITIVE',
      timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
      source: 'CoinDesk',
      priceImpact: 2.4,
      relevantSymbols: ['BTC', 'MSTR']
    },
    {
      id: '2',
      title: 'SEC aprova primeiro ETF de Ethereum Staking',
      summary: 'Aprovação histórica pode abrir caminho para maior adoção institucional de ETH e produtos de staking.',
      impact: 'HIGH',
      sentiment: 'POSITIVE',
      timestamp: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
      source: 'Reuters',
      priceImpact: 5.7,
      relevantSymbols: ['ETH']
    },
    {
      id: '3',
      title: 'Whale movimenta $2.1B em Bitcoin para exchanges',
      summary: 'Grande transferência detectada pode indicar pressão de venda iminente no mercado.',
      impact: 'MEDIUM',
      sentiment: 'NEGATIVE',
      timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
      source: 'Whale Alert',
      priceImpact: -1.8,
      relevantSymbols: ['BTC']
    },
    {
      id: '4',
      title: 'DeFi Total Value Locked ultrapassa $200B',
      summary: 'Protocolos DeFi continuam crescimento, com novos produtos atraindo capital institucional.',
      impact: 'MEDIUM',
      sentiment: 'POSITIVE',
      timestamp: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
      source: 'DeFi Pulse',
      priceImpact: 1.2,
      relevantSymbols: ['ETH', 'UNI', 'AAVE']
    },
    {
      id: '5',
      title: 'Fed mantém taxa de juros, mercado cripto reage positivamente',
      summary: 'Decisão do Federal Reserve de manter taxas estáveis beneficia ativos de risco como criptomoedas.',
      impact: 'HIGH',
      sentiment: 'POSITIVE',
      timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
      source: 'Bloomberg',
      priceImpact: 3.2,
      relevantSymbols: ['BTC', 'ETH', 'XRP']
    }
  ];

  return newsItems;
};

const MarketNews = () => {
  const { data: news, isLoading, error } = useQuery({
    queryKey: ['cryptoNews'],
    queryFn: fetchCryptoNews,
    refetchInterval: 60000,
    retry: 1,
    retryOnMount: false
  });

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case 'HIGH': return 'destructive';
      case 'MEDIUM': return 'secondary';
      default: return 'outline';
    }
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'POSITIVE': return <TrendingUpIcon className="w-4 h-4 text-success" />;
      case 'NEGATIVE': return <TrendingDownIcon className="w-4 h-4 text-destructive" />;
      default: return <Newspaper className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getTimeAgo = (timestamp: string) => {
    const now = new Date();
    const newsTime = new Date(timestamp);
    const diffMinutes = Math.floor((now.getTime() - newsTime.getTime()) / (1000 * 60));
    
    if (diffMinutes < 60) {
      return `${diffMinutes}m atrás`;
    }
    return `${Math.floor(diffMinutes / 60)}h atrás`;
  };

  if (isLoading) {
    return (
      <Card className="p-6 animate-pulse">
        <div className="h-6 bg-muted rounded mb-4"></div>
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="space-y-2">
              <div className="h-4 bg-muted rounded"></div>
              <div className="h-3 bg-muted/60 rounded w-3/4"></div>
            </div>
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-6">
        <Newspaper className="w-5 h-5" />
        <h3 className="text-lg font-semibold">Notícias & Análise de Impacto</h3>
        <Badge variant="outline" className="ml-auto">
          Tempo Real
        </Badge>
      </div>

      <div className="space-y-4">
        {news?.map((item) => (
          <div key={item.id} className="border rounded-lg p-4 hover:bg-muted/30 transition-colors">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 mt-1">
                {getSentimentIcon(item.sentiment)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <Badge variant={getImpactColor(item.impact)} className="text-xs">
                    {item.impact}
                  </Badge>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    <ClockIcon className="w-3 h-3" />
                    {getTimeAgo(item.timestamp)}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {item.source}
                  </span>
                </div>
                
                <h4 className="font-medium text-sm mb-2 line-clamp-2">
                  {item.title}
                </h4>
                
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {item.summary}
                </p>
                
                <div className="flex items-center justify-between">
                  <div className="flex gap-1">
                    {item.relevantSymbols.map(symbol => (
                      <Badge key={symbol} variant="outline" className="text-xs px-2 py-0">
                        {symbol}
                      </Badge>
                    ))}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-mono ${
                      item.priceImpact > 0 ? 'text-success' : 'text-destructive'
                    }`}>
                      {item.priceImpact > 0 ? '+' : ''}{item.priceImpact}%
                    </span>
                    <ExternalLinkIcon className="w-3 h-3 text-muted-foreground hover:text-primary cursor-pointer" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      <div className="mt-4 pt-4 border-t text-center">
        <button className="text-sm text-primary hover:underline">
          Ver todas as notícias
        </button>
      </div>
    </Card>
  );
};

export default MarketNews;