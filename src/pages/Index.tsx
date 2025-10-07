import CryptoChart from "@/components/CryptoChart";
import AdvancedAISignals from "@/components/AdvancedAISignals";
import { BybitModeToggle } from "@/components/BybitModeToggle";
import { Badge } from "@/components/ui/badge";

const Index = () => {
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
        
        <div className="space-y-8">
          <BybitModeToggle />
          <AdvancedAISignals />
          <CryptoChart />
        </div>
      </div>
    </div>
  );
};

export default Index;