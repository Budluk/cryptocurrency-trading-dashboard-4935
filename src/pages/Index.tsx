import { BybitPositionsPanel } from "@/components/BybitPositionsPanel";
import { DailyPnLSummary } from "@/components/DailyPnLSummary";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
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
import SmartAlerts from "@/components/SmartAlerts";

const Index = () => {
  return (
    <>
      <div className="h-screen bg-gradient-to-br from-background via-background/95 to-primary/10 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl animate-float" />
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-accent/5 rounded-full blur-3xl animate-float" style={{ animationDelay: '2s' }} />
        </div>
        
        <ScrollArea className="h-full relative z-10">
          <div className="max-w-[1600px] mx-auto p-3 sm:p-4 md:p-6">
            {/* Header */}
            <header className="mb-4 sm:mb-6 md:mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-2">
                <div>
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-5xl font-bold bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-gradient glow-text">
                    AI Trading Platform
                  </h1>
                  <p className="text-muted-foreground mt-1 sm:mt-2 text-sm sm:text-base md:text-lg">Sistema profissional de trading com IA avançada</p>
                </div>
                <Badge variant="default" className="h-8 sm:h-10 px-3 sm:px-6 bg-gradient-to-r from-success to-success/80 border-0 shadow-lg shadow-success/30 animate-glow self-start sm:self-auto">
                  <span className="w-2 h-2 bg-white rounded-full mr-2 animate-pulse" />
                  AO VIVO
                </Badge>
              </div>
            </header>
        
        {/* P&L Summary */}
        <DailyPnLSummary />
        
        <div className="mt-4 sm:mt-6 md:mt-8">
          <Tabs defaultValue="trading" className="w-full">
            <TabsList className="grid w-full grid-cols-4 mb-4 sm:mb-6 bg-card/50 backdrop-blur-sm p-1 border border-border/50 shadow-lg">
              <TabsTrigger 
                value="trading" 
                className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 transition-all duration-300 px-1 sm:px-3"
              >
                <TrendingUp className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Trading</span>
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 transition-all duration-300 px-1 sm:px-3"
              >
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger 
                value="advanced" 
                className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 transition-all duration-300 px-1 sm:px-3"
              >
                <Activity className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Advanced</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="text-xs sm:text-sm data-[state=active]:bg-gradient-to-r data-[state=active]:from-primary data-[state=active]:to-primary/80 data-[state=active]:shadow-lg data-[state=active]:shadow-primary/30 transition-all duration-300 px-1 sm:px-3"
              >
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>
            
            {/* Trading Tab */}
            <TabsContent value="trading" className="space-y-6">
              <BybitPositionsPanel />
              <SmartAlerts />
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
    </>
  );
};

export default Index;