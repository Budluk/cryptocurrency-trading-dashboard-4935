import CryptoChart from "@/components/CryptoChart";
import AdvancedAISignals from "@/components/AdvancedAISignals";
import { AutoTraderSettings } from "@/components/AutoTraderSettings";
import PerformanceDashboard from "@/components/PerformanceDashboard";
import { MultiAssetTrader } from "@/components/MultiAssetTrader";
import { AdvancedAnalytics } from "@/components/AdvancedAnalytics";
import { TraderProfileSettings } from "@/components/TraderProfileSettings";
import { MLAdaptiveSettings } from "@/components/MLAdaptiveSettings";
import { SentimentDashboard } from "@/components/SentimentDashboard";
import { PortfolioRebalancer } from "@/components/PortfolioRebalancer";
import { OrderFlowDashboard } from "@/components/OrderFlowDashboard";
import { DailyPnLSummary } from "@/components/DailyPnLSummary";
import { ActiveTradesPanel } from "@/components/ActiveTradesPanel";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { usePositionMonitor } from "@/hooks/usePositionMonitor";
import { usePriceUpdater } from "@/hooks/usePriceUpdater";
import { useSuspiciousPatternDetector } from "@/hooks/useSuspiciousPatternDetector";
import { useReversalMonitor } from "@/hooks/useReversalMonitor";
import { useBybitSync } from "@/hooks/useBybitSync";
import { Activity, BarChart3, Settings, TrendingUp } from "lucide-react";

const Index = () => {
  const { patterns } = useSuspiciousPatternDetector();
  
  // Filtrar apenas padrões de reversão de alta severidade
  const reversalPatterns = patterns
    .filter(p => p.type === 'REVERSAL_SIGNAL' && p.severity === 'HIGH')
    .map(p => ({
      symbol: p.symbol,
      direction: p.reversal_direction!,
      severity: p.severity as 'HIGH' | 'MEDIUM',
      timestamp: p.detected_at,
    }));

  usePositionMonitor(reversalPatterns);
  useReversalMonitor(reversalPatterns);
  usePriceUpdater();
  useBybitSync(true); // Sincronizar com Bybit a cada 30 segundos

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <div className="max-w-[1600px] mx-auto p-6">
        {/* Header */}
        <header className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-primary/60 bg-clip-text text-transparent">
                AI Trading Platform
              </h1>
              <p className="text-muted-foreground mt-1">Sistema profissional de trading com IA avançada</p>
            </div>
            <Badge variant="default" className="h-8 px-4">
              <span className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
              AO VIVO
            </Badge>
          </div>
        </header>
        
        {/* P&L Summary */}
        <DailyPnLSummary />
        
        <div className="mt-8">
          <Tabs defaultValue="trading" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-6">
              <TabsTrigger value="trading" className="data-[state=active]:bg-primary">
                <TrendingUp className="h-4 w-4 mr-2" />
                Trading
              </TabsTrigger>
              <TabsTrigger value="analytics" className="data-[state=active]:bg-primary">
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </TabsTrigger>
              <TabsTrigger value="advanced" className="data-[state=active]:bg-primary">
                <Activity className="h-4 w-4 mr-2" />
                Advanced
              </TabsTrigger>
              <TabsTrigger value="settings" className="data-[state=active]:bg-primary">
                <Settings className="h-4 w-4 mr-2" />
                Settings
              </TabsTrigger>
            </TabsList>
            
            {/* Trading Tab */}
            <TabsContent value="trading" className="space-y-6">
              <ActiveTradesPanel />
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <MultiAssetTrader />
                <div className="space-y-6">
                  <CryptoChart />
                  <AdvancedAISignals />
                </div>
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <PerformanceDashboard />
              <AdvancedAnalytics />
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-6">
              <OrderFlowDashboard />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <SentimentDashboard />
                <PortfolioRebalancer />
              </div>
            </TabsContent>
            
            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <AutoTraderSettings />
                <MLAdaptiveSettings />
              </div>
              <TraderProfileSettings />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
};

export default Index;