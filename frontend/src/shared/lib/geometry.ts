export type LngLat = readonly [longitude: number, latitude: number];

const EARTH_RADIUS_MILES = 3958.7613;

const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
const toDegrees = (radians: number) => (radians * 180) / Math.PI;
const clampUnit = (value: number) => Math.min(Math.max(value, 0), 1);

export function toLngLat(position: readonly number[]): LngLat {
  return [position[0] ?? 0, position[1] ?? 0];
}

export function haversineMiles(start: LngLat, end: LngLat): number {
  const startLatitude = toRadians(start[1]);
  const endLatitude = toRadians(end[1]);
  const latitudeDelta = endLatitude - startLatitude;
  const longitudeDelta = toRadians(end[0] - start[0]);
  const halfChordSquared =
    Math.sin(latitudeDelta / 2) ** 2 +
    Math.cos(startLatitude) * Math.cos(endLatitude) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * EARTH_RADIUS_MILES * Math.asin(Math.sqrt(Math.min(1, halfChordSquared)));
}

export function bearingDegrees(start: LngLat, end: LngLat): number {
  const startLatitude = toRadians(start[1]);
  const endLatitude = toRadians(end[1]);
  const longitudeDelta = toRadians(end[0] - start[0]);
  const eastward = Math.sin(longitudeDelta) * Math.cos(endLatitude);
  const northward =
    Math.cos(startLatitude) * Math.sin(endLatitude) -
    Math.sin(startLatitude) * Math.cos(endLatitude) * Math.cos(longitudeDelta);
  return (toDegrees(Math.atan2(eastward, northward)) + 360) % 360;
}

export function interpolateLngLat(start: LngLat, end: LngLat, fraction: number): LngLat {
  return [start[0] + (end[0] - start[0]) * fraction, start[1] + (end[1] - start[1]) * fraction];
}

export function findSpanIndex(ascendingValues: readonly number[], target: number): number {
  let low = 1;
  let high = ascendingValues.length - 1;
  while (low < high) {
    const middle = (low + high) >> 1;
    if ((ascendingValues[middle] ?? 0) < target) low = middle + 1;
    else high = middle;
  }
  return low;
}

export class PolylineMeasure {
  private readonly cumulativeMiles: number[];

  constructor(private readonly coordinates: readonly LngLat[]) {
    if (coordinates.length < 2) throw new Error("A polyline needs at least two coordinates.");
    this.cumulativeMiles = [0];
    for (let index = 1; index < coordinates.length; index += 1) {
      const previousTotal = this.cumulativeMiles[index - 1] ?? 0;
      this.cumulativeMiles.push(previousTotal + haversineMiles(this.at(index - 1), this.at(index)));
    }
  }

  get totalMiles(): number {
    return this.cumulativeMiles[this.cumulativeMiles.length - 1] ?? 0;
  }

  pointAtFraction(fraction: number): LngLat {
    const targetMiles = clampUnit(fraction) * this.totalMiles;
    const segmentIndex = findSpanIndex(this.cumulativeMiles, targetMiles);
    return this.interpolateWithinSegment(segmentIndex, targetMiles);
  }

  bearingAtFraction(fraction: number): number {
    const segmentIndex = findSpanIndex(this.cumulativeMiles, clampUnit(fraction) * this.totalMiles);
    return bearingDegrees(this.at(segmentIndex - 1), this.at(segmentIndex));
  }

  slice(startFraction: number, endFraction: number): LngLat[] {
    const startMiles = clampUnit(startFraction) * this.totalMiles;
    const endMiles = clampUnit(endFraction) * this.totalMiles;
    const startSegment = findSpanIndex(this.cumulativeMiles, startMiles);
    const endSegment = findSpanIndex(this.cumulativeMiles, endMiles);
    const interiorVertices = this.coordinates.slice(startSegment, endSegment);
    return [
      this.interpolateWithinSegment(startSegment, startMiles),
      ...interiorVertices,
      this.interpolateWithinSegment(endSegment, endMiles),
    ];
  }

  private at(index: number): LngLat {
    return this.coordinates[index] ?? [0, 0];
  }

  private interpolateWithinSegment(segmentIndex: number, targetMiles: number): LngLat {
    const segmentStartMiles = this.cumulativeMiles[segmentIndex - 1] ?? 0;
    const segmentEndMiles = this.cumulativeMiles[segmentIndex] ?? segmentStartMiles;
    const segmentLength = segmentEndMiles - segmentStartMiles;
    const progress = segmentLength === 0 ? 0 : (targetMiles - segmentStartMiles) / segmentLength;
    return interpolateLngLat(this.at(segmentIndex - 1), this.at(segmentIndex), progress);
  }
}
