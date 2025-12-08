import { BybitPositionsPanel } from "@/components/BybitPositionsPanel";
import { DailyPnLSummary } from "@/components/DailyPnLSummary";

import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Activity, BarChart3, Settings, TrendingUp, Zap } from "lucide-react";

import {
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
    <div className="min-h-screen bg-background relative">
      {/* Background Effects */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 left-1/4 w-[600px] h-[600px] bg-primary/5 rounded-full blur-[120px] animate-float" />
        <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-accent/5 rounded-full blur-[100px] animate-float" style={{ animationDelay: '2.5s' }} />
        <div className="absolute top-1/2 left-0 w-[300px] h-[300px] bg-success/3 rounded-full blur-[80px]" />
      </div>
      
      <div className="relative z-10 overflow-y-auto h-screen">
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {/* Header */}
          <header className="mb-8 sm:mb-10">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-2">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/20">
                    <Zap className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
                  </div>
                  <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">
                    <span className="gradient-text">AI Trading</span>
                    <span className="text-foreground/90"> Platform</span>
                  </h1>
                </div>
                <p className="text-muted-foreground text-sm sm:text-base max-w-md">
                  Sistema profissional de trading com inteligência artificial avançada
                </p>
              </div>
              
              <div className="badge-live self-start sm:self-center">
                <span className="font-semibold tracking-wide">AO VIVO</span>
              </div>
            </div>
          </header>
      
          {/* P&L Summary */}
          <section className="mb-8">
            <DailyPnLSummary />
          </section>
          
          {/* Main Content */}
          <Tabs defaultValue="trading" className="w-full">
            <TabsList className="w-full grid grid-cols-4 mb-8 p-1.5 bg-card/50 backdrop-blur-sm border border-border/40 rounded-xl h-auto">
              <TabsTrigger 
                value="trading" 
                className="py-3 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-glow-sm transition-all"
              >
                <TrendingUp className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Trading</span>
              </TabsTrigger>
              <TabsTrigger 
                value="analytics" 
                className="py-3 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-glow-sm transition-all"
              >
                <BarChart3 className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Analytics</span>
              </TabsTrigger>
              <TabsTrigger 
                value="advanced" 
                className="py-3 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-glow-sm transition-all"
              >
                <Activity className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Advanced</span>
              </TabsTrigger>
              <TabsTrigger 
                value="settings" 
                className="py-3 px-4 text-sm font-medium rounded-lg data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-glow-sm transition-all"
              >
                <Settings className="h-4 w-4 sm:mr-2" />
                <span className="hidden sm:inline">Settings</span>
              </TabsTrigger>
            </TabsList>
            
            {/* Trading Tab */}
            <TabsContent value="trading" className="space-y-6 animate-fade-in">
              <BybitPositionsPanel />
              <SmartAlerts />
              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 space-y-6">
                  <LazyMultiAssetTrader />
                  <LazyTrailingStopVisual />
                </div>
                <div className="space-y-6">
                  <LazyRiskManagementPanel />
                  <LazyAdvancedAISignals />
                </div>
              </div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6 animate-fade-in">
              <LazyPerformanceDashboard />
              <LazyAdvancedAnalytics />
            </TabsContent>

            {/* Advanced Tab */}
            <TabsContent value="advanced" className="space-y-6 animate-fade-in">
              <LazyOrderFlowDashboard />
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LazySentimentDashboard />
                <LazyPortfolioRebalancer />
              </div>
            </TabsContent>
            
            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-6 animate-fade-in">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <LazyAutoTraderSettings />
                <LazyMLAdaptiveSettings />
              </div>
              <LazyTraderProfileSettings />
            </TabsContent>
          </Tabs>
          
          {/* Footer Spacing */}
          <div className="h-8" />
        </div>
      </div>
    </div>
  );
};

export default Index;