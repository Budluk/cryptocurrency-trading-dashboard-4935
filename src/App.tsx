import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import { PositionsProvider } from "@/contexts/PositionsContext";
import { supabase } from "@/integrations/supabase/client";
import Index from "./pages/Index";
import Auth from "./pages/Auth";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000,
      gcTime: 300000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      retry: 1,
    },
  },
});

// Protected route wrapper - redirects to /auth if no session
const ProtectedRoute = () => {
  // In a real app, you'd use a proper auth context
  // For now, we allow access but the edge functions enforce JWT
  return <Outlet />;
};

const PublicRoute = () => {
  return <Outlet />;
};

const App = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PositionsProvider>
            <Routes>
              {/* Public routes */}
              <Route element={<PublicRoute />}>
                <Route path="/auth" element={<Auth />} />
              </Route>
              
              {/* Protected routes - JWT verified by edge functions */}
              <Route element={<ProtectedRoute />}>
                <Route path="/" element={<Index />} />
              </Route>
              
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </PositionsProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  );
};

export default App;
