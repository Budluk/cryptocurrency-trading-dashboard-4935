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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useRealtimePrice } from "@/hooks/useRealtimePrice";
import { Activity, BarChart3, Settings, TrendingUp, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User, Session } from "@supabase/supabase-js";
import { useToast } from "@/hooks/use-toast";

const Index = () => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();
  
  // Hook para preços em tempo real
  useRealtimePrice();

  useEffect(() => {
    // Set up auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setLoading(false);
        
        if (!session) {
          navigate('/auth');
        }
      }
    );

    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      
      if (!session) {
        navigate('/auth');
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    toast({
      title: "Logout realizado",
      description: "Você saiu da plataforma",
    });
    navigate('/auth');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/5">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

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
            <div className="flex items-center gap-4">
              <Badge variant="default" className="h-8 px-4">
                <span className="w-2 h-2 bg-success rounded-full mr-2 animate-pulse" />
                AO VIVO
              </Badge>
              <Button variant="outline" size="sm" onClick={handleLogout}>
                <LogOut className="h-4 w-4 mr-2" />
                Sair
              </Button>
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
  );
};

export default Index;