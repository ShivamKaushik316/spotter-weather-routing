import type { TripRequest } from "@/shared/api/types";
import { formatClock, formatPounds } from "@/shared/lib/format";
import type { TripDraft } from "@/stores/tripDraftStore";
import { validateTripDraft } from "./tripSchema";

export type PlanActionKind = "missing-endpoints" | "first-plan" | "inputs-changed" | "up-to-date";

export interface PlanActionState {
  kind: PlanActionKind;
  label: string;
  summary: string;
}

const LABELS: Record<PlanActionKind, string> = {
  "missing-endpoints": "Find safest route",
  "first-plan": "Find safest route",
  "inputs-changed": "Update routes",
  "up-to-date": "Refresh forecast",
};

function shortPlaceName(label: string): string {
  return label.split(",")[0]?.trim() ?? label;
}

function isSameRequest(first: TripRequest, second: TripRequest): boolean {
  return JSON.stringify(first) === JSON.stringify(second);
}

export function describePlanAction(
  draft: TripDraft,
  submittedRequest: TripRequest | null,
  now: Date = new Date(),
): PlanActionState {
  const { origin, destination } = draft;
  if (!origin || !destination) {
    return {
      kind: "missing-endpoints",
      label: LABELS["missing-endpoints"],
      summary: "Choose where the truck starts and where it is going.",
    };
  }
  const summary = `${shortPlaceName(origin.label)} → ${shortPlaceName(destination.label)} · ${formatPounds(draft.loadPounds)} lb · leaves ${formatClock(draft.departure)}`;
  const validation = validateTripDraft(draft, now);
  const kind: PlanActionKind =
    submittedRequest === null
      ? "first-plan"
      : validation.success && isSameRequest(validation.trip.request, submittedRequest)
        ? "up-to-date"
        : "inputs-changed";
  return { kind, label: LABELS[kind], summary };
}
