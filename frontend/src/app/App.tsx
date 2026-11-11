import { lazy, Suspense } from "react";
import { useTripPlan } from "@/entities/trip";
import { CheckpointDrawer } from "@/features/checkpoint-details";
import { DepartureWindowCard } from "@/features/departure-window";
import { MapStatusPill } from "@/features/map-status";
import { RouteList } from "@/features/route-list";
import { TimelineDock } from "@/features/timeline";
import { MapToolbar } from "@/features/toolbar";
import { PlanTripBar, TripForm } from "@/features/trip-form";
import { WarningBanner } from "@/features/warnings";
import { useApplyTheme } from "@/shared/theme/useApplyTheme";
import { Panel } from "@/shared/ui/Panel";
import { ToastViewport } from "@/shared/ui/ToastViewport";
import { Brand } from "./Brand";
import { ErrorBoundary } from "./ErrorBoundary";
import { useKeyboardShortcuts } from "./hooks/useKeyboardShortcuts";
import { usePlanLifecycle } from "./hooks/usePlanLifecycle";
import { useUrlSync } from "./hooks/useUrlSync";

const MapView = lazy(() => import("@/features/map/MapView"));

function MapUnavailable() {
  return (
    <div className="absolute inset-0 grid place-items-center bg-canvas text-sm text-muted">
      The map could not be displayed. Route results are still available in the panel.
    </div>
  );
}

export function App() {
  const { data: plan } = useTripPlan();
  useApplyTheme();
  useUrlSync();
  usePlanLifecycle();
  useKeyboardShortcuts(Boolean(plan));

  return (
    <div className="relative h-dvh w-full overflow-hidden">
      <a href="#trip-planner" className="skip-link">
        Skip to trip planner
      </a>

      <ErrorBoundary fallback={<MapUnavailable />}>
        <Suspense
          fallback={<div className="map-placeholder absolute inset-0" aria-hidden="true" />}
        >
          <MapView />
        </Suspense>
      </ErrorBoundary>

      <Panel
        as="aside"
        id="trip-planner"
        aria-label="Trip planner"
        className="left-panel absolute bottom-[140px] left-4 top-4 flex w-[392px] flex-col overflow-hidden"
      >
        <Brand />
        <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto px-[18px] pb-[18px] pt-4 [scrollbar-width:thin]">
          <TripForm />
          <RouteList />
        </div>
        <PlanTripBar />
      </Panel>

      <WarningBanner />
      <MapStatusPill />
      <MapToolbar />
      <CheckpointDrawer />
      <DepartureWindowCard />
      <TimelineDock />
      <ToastViewport />
    </div>
  );
}
