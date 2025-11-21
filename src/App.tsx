import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { PositionsProvider } from "@/contexts/PositionsContext";
import Index from "./pages/Index";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 minuto antes de considerar dados stale
      gcTime: 300000, // 5 minutos de cache
      refetchOnWindowFocus: false, // Desabilitar refetch ao focar janela
      refetchOnReconnect: false, // Desabilitar refetch ao reconectar
      retry: 1, // Apenas 1 retry
    },
  },
});

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <PositionsProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
              <Route path="/" element={<Index />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </PositionsProvider>
    </QueryClientProvider>
  );
};

export default App;
