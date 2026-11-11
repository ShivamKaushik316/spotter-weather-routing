import type { PlannedRoute } from "@/shared/api/types";
import { findSpanIndex, PolylineMeasure, toLngLat, type LngLat } from "@/shared/lib/geometry";

export interface TruckPosition {
  routeId: string;
  coordinate: LngLat;
  bearing: number;
  progress: number;
  hasArrived: boolean;
}

export class RouteTimeline {
  readonly routeId: string;
  private readonly arrivalTimes: number[];
  private readonly distanceFractions: number[];
  private readonly polyline: PolylineMeasure;

  constructor(route: PlannedRoute) {
    this.routeId = route.route_id;
    this.polyline = new PolylineMeasure(route.geometry.coordinates.map(toLngLat));
    const totalMiles = route.summary.distance_miles;
    this.arrivalTimes = route.checkpoints.map((checkpoint) =>
      new Date(checkpoint.estimated_arrival).getTime(),
    );
    this.distanceFractions = route.checkpoints.map((checkpoint) =>
      totalMiles > 0 ? checkpoint.distance_from_origin_miles / totalMiles : 0,
    );
  }

  get departureTime(): number {
    return this.arrivalTimes[0] ?? 0;
  }

  get arrivalTime(): number {
    return this.arrivalTimes[this.arrivalTimes.length - 1] ?? 0;
  }

  progressAt(momentMilliseconds: number): number {
    if (this.arrivalTimes.length < 2 || momentMilliseconds <= this.departureTime) return 0;
    if (momentMilliseconds >= this.arrivalTime) return 1;
    const spanIndex = findSpanIndex(this.arrivalTimes, momentMilliseconds);
    const spanStartTime = this.arrivalTimes[spanIndex - 1] ?? 0;
    const spanEndTime = this.arrivalTimes[spanIndex] ?? spanStartTime;
    const spanStartFraction = this.distanceFractions[spanIndex - 1] ?? 0;
    const spanEndFraction = this.distanceFractions[spanIndex] ?? spanStartFraction;
    const spanDuration = spanEndTime - spanStartTime;
    const timeProgress =
      spanDuration === 0 ? 1 : (momentMilliseconds - spanStartTime) / spanDuration;
    return spanStartFraction + (spanEndFraction - spanStartFraction) * timeProgress;
  }

  positionAt(momentMilliseconds: number): TruckPosition {
    const progress = this.progressAt(momentMilliseconds);
    return {
      routeId: this.routeId,
      coordinate: this.polyline.pointAtFraction(progress),
      bearing: this.polyline.bearingAtFraction(progress),
      progress,
      hasArrived: progress >= 1,
    };
  }
}
