import MarketStats from "@/components/MarketStats";
import CryptoChart from "@/components/CryptoChart";
import PortfolioCard from "@/components/PortfolioCard";
import CryptoList from "@/components/CryptoList";
import TradingSignals from "@/components/TradingSignals";
import MarketNews from "@/components/MarketNews";
import AdvancedAnalytics from "@/components/AdvancedAnalytics";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";

const Index = () => {
  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Dashboard Cripto Profissional</h1>
              <p className="text-muted-foreground">Análise técnica avançada e sinais em tempo real</p>
            </div>
            <Badge variant="default" className="animate-pulse">
              AO VIVO
            </Badge>
          </div>
        </header>
        
        <MarketStats />
        
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Visão Geral</TabsTrigger>
            <TabsTrigger value="signals">Sinais Trading</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="news">Notícias</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              <div className="lg:col-span-2">
                <CryptoChart />
              </div>
              <div>
                <PortfolioCard />
              </div>
            </div>
            <CryptoList />
          </TabsContent>

          <TabsContent value="signals" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <TradingSignals />
              <MarketNews />
            </div>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-8">
            <AdvancedAnalytics />
          </TabsContent>

          <TabsContent value="news" className="space-y-8">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
              <MarketNews />
              <div className="space-y-6">
                <TradingSignals />
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default Index;