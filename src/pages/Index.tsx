import { BybitPositionsPanel } from "@/components/BybitPositionsPanel";
import { DailyPnLSummary } from "@/components/DailyPnLSummary";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RealtimePriceProvider } from "@/contexts/RealtimePriceContext";
import { Activity, BarChart3, Settings, TrendingUp } from "lucide-react";

// Lazy loaded components
import {
  LazyCryptoChart,
  LazyAdvancedAISignals,
  LazyPerformanceDashboard,
  LazyMultiAssetTrader,
  LazyAdvancedAnalytics,
  LazySentimentDashboard,
  LazyPortfolioRebalancer,
  LazyOrderFlowDashboard,
  LazyTrailingStopVisual,
  LazyRiskManagementPanel,
  LazyAutoTraderSettings,
  LazyMLAdaptiveSettings,
  LazyTraderProfileSettings,
} from "@/pages/Index.lazy";

const Index = () => {
  return (
    <RealtimePriceProvider>
      <div className="h-screen bg-gradient-to-br from-background via-background to-primary/5">
        <ScrollArea className="h-full">
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
              <BybitPositionsPanel />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <LazyMultiAssetTrader />
                  <LazyTrailingStopVisual />
                </div>
                <div className="space-y-6">
                  <LazyRiskManagementPanel />
                  <LazyCryptoChart />
                  <LazyAdvancedAISignals />
                </div>
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <LazyPerformanceDashboard />
              <LazyAdvancedAnalytics />
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-6">
              <LazyOrderFlowDashboard />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LazySentimentDashboard />
                <LazyPortfolioRebalancer />
              </div>
            </TabsContent>
            
            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LazyAutoTraderSettings />
                <LazyMLAdaptiveSettings />
              </div>
              <LazyTraderProfileSettings />
            </TabsContent>
          </Tabs>
        </div>
          </div>
        </ScrollArea>
      </div>
    </RealtimePriceProvider>
  );
};

export default Index;