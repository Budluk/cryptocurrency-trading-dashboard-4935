import { lazy, Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

// Lazy load dos componentes pesados
const AdvancedAISignals = lazy(() => import("@/components/AdvancedAISignals"));
const PerformanceDashboard = lazy(() => import("@/components/PerformanceDashboard"));
const MultiAssetTrader = lazy(() => import("@/components/MultiAssetTrader").then(m => ({ default: m.MultiAssetTrader })));
const AdvancedAnalytics = lazy(() => import("@/components/AdvancedAnalytics").then(m => ({ default: m.AdvancedAnalytics })));
const SentimentDashboard = lazy(() => import("@/components/SentimentDashboard").then(m => ({ default: m.SentimentDashboard })));
const PortfolioRebalancer = lazy(() => import("@/components/PortfolioRebalancer").then(m => ({ default: m.PortfolioRebalancer })));
const OrderFlowDashboard = lazy(() => import("@/components/OrderFlowDashboard").then(m => ({ default: m.OrderFlowDashboard })));
const TrailingStopVisual = lazy(() => import("@/components/TrailingStopVisual").then(m => ({ default: m.TrailingStopVisual })));

const AutoTraderSettings = lazy(() => import("@/components/AutoTraderSettings").then(m => ({ default: m.AutoTraderSettings })));
const MLAdaptiveSettings = lazy(() => import("@/components/MLAdaptiveSettings").then(m => ({ default: m.MLAdaptiveSettings })));
const TraderProfileSettings = lazy(() => import("@/components/TraderProfileSettings").then(m => ({ default: m.TraderProfileSettings })));

// Loading placeholder otimizado
const ComponentSkeleton = () => (
  <Card className="p-6">
    <Skeleton className="h-8 w-48 mb-4" />
    <Skeleton className="h-64 w-full" />
  </Card>
);

export const LazyAdvancedAISignals = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <AdvancedAISignals />
  </Suspense>
);

export const LazyPerformanceDashboard = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <PerformanceDashboard />
  </Suspense>
);

export const LazyMultiAssetTrader = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <MultiAssetTrader />
  </Suspense>
);

export const LazyAdvancedAnalytics = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <AdvancedAnalytics />
  </Suspense>
);

export const LazySentimentDashboard = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <SentimentDashboard />
  </Suspense>
);

export const LazyPortfolioRebalancer = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <PortfolioRebalancer />
  </Suspense>
);

export const LazyOrderFlowDashboard = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <OrderFlowDashboard />
  </Suspense>
);

export const LazyTrailingStopVisual = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <TrailingStopVisual />
  </Suspense>
);


export const LazyAutoTraderSettings = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <AutoTraderSettings />
  </Suspense>
);

export const LazyMLAdaptiveSettings = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <MLAdaptiveSettings />
  </Suspense>
);

export const LazyTraderProfileSettings = () => (
  <Suspense fallback={<ComponentSkeleton />}>
    <TraderProfileSettings />
  </Suspense>
);
