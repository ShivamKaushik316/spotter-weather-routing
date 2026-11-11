import type {
  DataDrivenPropertyValueSpecification,
  ExpressionSpecification,
  FilterSpecification,
} from "maplibre-gl";
import type { CheckpointSelection } from "@/stores/selectionStore";

const routeIdOfFeature: ExpressionSpecification = ["get", "routeId"];

export function focusedRouteValue<Value extends number>(
  focusedRouteId: string,
  focusedValue: Value,
  otherValue: Value,
): DataDrivenPropertyValueSpecification<number> {
  return ["case", ["==", routeIdOfFeature, focusedRouteId], focusedValue, otherValue];
}

export function routeSortKey(
  focusedRouteId: string,
  recommendedRouteId: string,
): DataDrivenPropertyValueSpecification<number> {
  return [
    "case",
    ["==", routeIdOfFeature, focusedRouteId],
    2,
    ["==", routeIdOfFeature, recommendedRouteId],
    1,
    0,
  ];
}

function isSelectedCheckpoint(selection: CheckpointSelection | null): ExpressionSpecification {
  if (!selection) return ["boolean", false];
  return [
    "all",
    ["==", routeIdOfFeature, selection.routeId],
    ["==", ["get", "sequence"], selection.sequence],
  ];
}

export function checkpointRadiusExpression(
  selection: CheckpointSelection | null,
): DataDrivenPropertyValueSpecification<number> {
  const selected = isSelectedCheckpoint(selection);
  return [
    "interpolate",
    ["linear"],
    ["zoom"],
    4,
    ["case", selected, 8, ["get", "isRecommended"], 4.5, 3.5],
    10,
    ["case", selected, 13, ["get", "isRecommended"], 8, 6],
  ];
}

export function visibleRoutesFilter(
  showAlternates: boolean,
  recommendedRouteId: string,
  focusedRouteId: string,
): FilterSpecification | null {
  if (showAlternates) return null;
  return ["in", routeIdOfFeature, ["literal", [recommendedRouteId, focusedRouteId]]];
}
