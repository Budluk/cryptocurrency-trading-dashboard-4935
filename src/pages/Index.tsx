import CryptoChart from "@/components/CryptoChart";
import AdvancedAISignals from "@/components/AdvancedAISignals";
import { AutoTraderSettings } from "@/components/AutoTraderSettings";
import PerformanceDashboard from "@/components/PerformanceDashboard";
import { MultiAssetTrader } from "@/components/MultiAssetTrader";
import { BybitPositionsPanel } from "@/components/BybitPositionsPanel";
import { AdvancedAnalytics } from "@/components/AdvancedAnalytics";
import { TraderProfileSettings } from "@/components/TraderProfileSettings";
import { MLAdaptiveSettings } from "@/components/MLAdaptiveSettings";
import { SentimentDashboard } from "@/components/SentimentDashboard";
import { PortfolioRebalancer } from "@/components/PortfolioRebalancer";
import { OrderFlowDashboard } from "@/components/OrderFlowDashboard";
import { DailyPnLSummary } from "@/components/DailyPnLSummary";
import { TrailingStopVisual } from "@/components/TrailingStopVisual";
import { RiskManagementPanel } from "@/components/RiskManagementPanel";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RealtimePriceProvider } from "@/contexts/RealtimePriceContext";
import { Activity, BarChart3, Settings, TrendingUp, LogOut, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userEmail, setUserEmail] = useState<string | null>(null);

  useEffect(() => {
    // Verificar se usuário está autenticado
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUserEmail(session.user.email || null);
      }
    });

    // Escutar mudanças de autenticação
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!session) {
        navigate('/auth');
      } else {
        setUserEmail(session.user.email || null);
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        title: "❌ Erro ao sair",
        description: error.message,
        variant: "destructive"
      });
    } else {
      toast({
        title: "✅ Logout realizado",
        description: "Até logo!"
      });
      navigate('/auth');
    }
  };

  return (
    <RealtimePriceProvider>
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
            <div className="flex items-center gap-4">
              <Badge variant="default" className="h-8 px-4">
                <span className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
                AO VIVO
              </Badge>
              {userEmail && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="h-8 px-3">
                    <User className="w-3 h-3 mr-2" />
                    {userEmail}
                  </Badge>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleLogout}
                    className="h-8"
                  >
                    <LogOut className="w-4 h-4 mr-2" />
                    Sair
                  </Button>
                </div>
              )}
            </div>
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
                  <MultiAssetTrader />
                  <TrailingStopVisual />
                </div>
                <div className="space-y-6">
                  <RiskManagementPanel />
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
    </RealtimePriceProvider>
  );
};

export default Index;