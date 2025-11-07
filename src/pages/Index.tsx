import CryptoChart from "@/components/CryptoChart";
import AdvancedAISignals from "@/components/AdvancedAISignals";
import { BybitModeToggle } from "@/components/BybitModeToggle";
import { AutoTrader } from "@/components/AutoTrader";
import { OpenPositionsMonitor } from "@/components/OpenPositionsMonitor";
import { FloatingPositionsWidget } from "@/components/FloatingPositionsWidget";
import { AutoTraderSettings } from "@/components/AutoTraderSettings";
import { BacktestingPanel } from "@/components/BacktestingPanel";
import PerformanceDashboard from "@/components/PerformanceDashboard";
import { TradingViewWebhookStatus } from "@/components/TradingViewWebhookStatus";
import { WebhookTester } from "@/components/WebhookTester";
import { MultiAssetTrader } from "@/components/MultiAssetTrader";
import { TradeHistory } from "@/components/TradeHistory";
import { AdvancedAnalytics } from "@/components/AdvancedAnalytics";
import { TrailingStopConfig } from "@/components/TrailingStopConfig";
import { AdvancedPerformanceMetrics } from "@/components/AdvancedPerformanceMetrics";
import { DailyPnLSummary } from "@/components/DailyPnLSummary";
import { CorrelationHeatmap } from "@/components/CorrelationHeatmap";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { usePositionMonitor } from "@/hooks/usePositionMonitor";
import { usePriceUpdater } from "@/hooks/usePriceUpdater";

const Index = () => {
  // Ativar monitoramento automático de posições e atualização de preços
  usePositionMonitor();
  usePriceUpdater();

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        <header className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Sinais de Trading IA</h1>
              <p className="text-muted-foreground">Sinais precisos com IA avançada e análise técnica</p>
            </div>
            <Badge variant="default" className="animate-pulse">
              AO VIVO
            </Badge>
          </div>
        </header>
        
        {/* P&L Diário */}
        <DailyPnLSummary />
        
        <div className="space-y-8 mt-8">
          <BybitModeToggle />
          
          <Tabs defaultValue="trader" className="w-full">
            <TabsList className="grid w-full grid-cols-10">
              <TabsTrigger value="trader">Auto Trader</TabsTrigger>
              <TabsTrigger value="tradingview">TradingView</TabsTrigger>
              <TabsTrigger value="positions">Posições</TabsTrigger>
              <TabsTrigger value="correlation">Correlação</TabsTrigger>
              <TabsTrigger value="trailing">Trailing Stop</TabsTrigger>
              <TabsTrigger value="history">Histórico</TabsTrigger>
              <TabsTrigger value="performance">Performance</TabsTrigger>
              <TabsTrigger value="analytics">Analytics</TabsTrigger>
              <TabsTrigger value="settings">Config</TabsTrigger>
              <TabsTrigger value="backtesting">Backtest</TabsTrigger>
            </TabsList>
            
            <TabsContent value="trader" className="space-y-8">
              <MultiAssetTrader />
              <OpenPositionsMonitor />
              <div className="pt-8 border-t border-border">
                <h3 className="text-lg font-semibold mb-4">Trader Clássico</h3>
                <AutoTrader />
              </div>
              <AdvancedAISignals />
            </TabsContent>

            <TabsContent value="tradingview" className="space-y-8">
              <TradingViewWebhookStatus />
              <WebhookTester />
              <div className="grid gap-4 md:grid-cols-2">
                <CryptoChart />
                <AdvancedAISignals />
              </div>
            </TabsContent>
            
            <TabsContent value="positions">
              <OpenPositionsMonitor />
            </TabsContent>
            
            <TabsContent value="correlation">
              <CorrelationHeatmap />
            </TabsContent>
            
            <TabsContent value="trailing">
              <TrailingStopConfig />
            </TabsContent>
            
            <TabsContent value="history">
              <TradeHistory />
            </TabsContent>
            
            <TabsContent value="performance">
              <PerformanceDashboard />
              <div className="mt-8">
                <AdvancedPerformanceMetrics />
              </div>
            </TabsContent>
            
            <TabsContent value="analytics">
              <AdvancedAnalytics />
            </TabsContent>
            
            <TabsContent value="settings">
              <AutoTraderSettings />
            </TabsContent>
            
            <TabsContent value="backtesting">
              <BacktestingPanel />
            </TabsContent>
          </Tabs>
        </div>
      </div>
      
      {/* Widget Flutuante de Posições */}
      <FloatingPositionsWidget />
    </div>
  );
};

export default Index;