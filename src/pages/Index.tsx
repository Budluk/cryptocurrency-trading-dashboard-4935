import { BybitPositionsPanel } from "@/components/BybitPositionsPanel";
import { DailyPnLSummary } from "@/components/DailyPnLSummary";
import { SystemStatusBar } from "@/components/SystemStatusBar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Activity, Clock, Search, Settings, LayoutDashboard, ChevronDown, BarChart3 } from "lucide-react";
import {
  LazyAdvancedAISignals, LazyPerformanceDashboard, LazyMultiAssetTrader,
  LazyAdvancedAnalytics, LazySentimentDashboard, LazyPortfolioRebalancer,
  LazyOrderFlowDashboard, LazyTrailingStopVisual, LazyLiveMetricsPanel,
  LazyTradeHistoryTimeline, LazyAutoTraderSettings, LazyMLAdaptiveSettings,
  LazyTraderProfileSettings, LazyResearchTab,
} from "@/pages/Index.lazy";
import SmartAlerts from "@/components/SmartAlerts";
import { TradingChat } from "@/components/TradingChat";

const navigation = [
  { value: "trading", label: "Visão geral", icon: LayoutDashboard },
  { value: "robot", label: "Robô", icon: Activity },
  { value: "history", label: "Histórico", icon: Clock },
  { value: "research", label: "Pesquisa", icon: Search },
  { value: "settings", label: "Ajustes", icon: Settings },
];

const Index = () => (
  <div className="trading-workspace min-h-screen bg-background">
    <TradingChat />
    <header className="border-b border-border bg-card/70 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1440px] flex-wrap items-center justify-between gap-3 px-4 py-4 sm:px-8">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" aria-hidden="true" />
          <h1 className="text-xl font-semibold">AI Trading</h1>
          <span className="hidden border-l border-border pl-3 text-xs text-muted-foreground sm:inline">Bybit · USDT</span>
        </div>
        <SystemStatusBar />
      </div>
    </header>
    <main className="mx-auto max-w-[1440px] px-4 pb-24 pt-5 sm:px-8 sm:pt-7">
      <Tabs defaultValue="trading" className="w-full">
        <TabsList aria-label="Navegação principal" className="workspace-navigation mb-6 grid h-auto w-full grid-cols-5 gap-1 rounded-none border-b border-border bg-transparent p-0 pb-2 sm:w-fit sm:gap-2">
          {navigation.map(({ value, label, icon: Icon }) => (
            <TabsTrigger key={value} value={value} className="min-h-12 min-w-0 flex-col gap-1 rounded-md px-1 py-2 text-xs data-[state=active]:bg-secondary data-[state=active]:text-primary data-[state=active]:shadow-none sm:min-h-10 sm:flex-row sm:gap-2 sm:px-4 sm:text-sm">
              <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="trading" className="space-y-6">
          <BybitPositionsPanel />
          <DailyPnLSummary />
          <details className="workspace-disclosure">
            <summary><Activity className="h-4 w-4 text-primary" />Alertas e acompanhamento<ChevronDown className="disclosure-chevron ml-auto h-4 w-4" /></summary>
            <div className="space-y-5 py-5"><SmartAlerts /><LazyTrailingStopVisual /><LazyLiveMetricsPanel /></div>
          </details>
          <details className="workspace-disclosure">
            <summary><BarChart3 className="h-4 w-4 text-primary" />Análise de mercado<ChevronDown className="disclosure-chevron ml-auto h-4 w-4" /></summary>
            <div className="py-5"><LazyAdvancedAISignals /></div>
          </details>
        </TabsContent>
        <TabsContent value="robot" forceMount className="data-[state=inactive]:hidden">
          <LazyMultiAssetTrader />
        </TabsContent>
        <TabsContent value="history" className="space-y-6">
          <LazyTradeHistoryTimeline />
          <details className="workspace-disclosure">
            <summary>Desempenho<ChevronDown className="disclosure-chevron ml-auto h-4 w-4" /></summary>
            <div className="space-y-5 py-5"><LazyPerformanceDashboard /><LazyAdvancedAnalytics /></div>
          </details>
          <details className="workspace-disclosure">
            <summary>Mais análises<ChevronDown className="disclosure-chevron ml-auto h-4 w-4" /></summary>
            <div className="space-y-5 py-5"><LazyOrderFlowDashboard /><LazySentimentDashboard /><LazyPortfolioRebalancer /></div>
          </details>
        </TabsContent>
        <TabsContent value="research"><LazyResearchTab /></TabsContent>
        <TabsContent value="settings" className="space-y-6">
          <h2 className="text-xl font-semibold">Ajustes</h2>
          <LazyAutoTraderSettings />
          <details className="workspace-disclosure">
            <summary>Aprendizado e perfil<ChevronDown className="disclosure-chevron ml-auto h-4 w-4" /></summary>
            <div className="space-y-5 py-5"><LazyMLAdaptiveSettings /><LazyTraderProfileSettings /></div>
          </details>
        </TabsContent>
      </Tabs>
    </main>
  </div>
);

export default Index;
