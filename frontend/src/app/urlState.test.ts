import { DALLAS_PLACE, DENVER_PLACE } from "@/test/server";
import { decodeTripSearch, encodeTripSearch, type SharedTrip } from "./urlState";

const sharedTrip: SharedTrip = {
  origin: DENVER_PLACE,
  destination: DALLAS_PLACE,
  departure: new Date("2026-11-12T06:00:00.000Z"),
  loadPounds: 42_000,
  intervalMiles: 25,
};

describe("urlState", () => {
  it("round-trips a trip through the query string", () => {
    expect(decodeTripSearch(encodeTripSearch(sharedTrip))).toEqual(sharedTrip);
  });

  it("ignores incomplete or tampered query strings", () => {
    const tampered = new URLSearchParams(encodeTripSearch(sharedTrip));
    tampered.set("every", "15");

    expect(decodeTripSearch("")).toBeNull();
    expect(decodeTripSearch("?from=1,2")).toBeNull();
    expect(decodeTripSearch(tampered.toString())).toBeNull();
  });

  it("rejects coordinates outside valid ranges", () => {
    const outOfRange = new URLSearchParams(encodeTripSearch(sharedTrip));
    outOfRange.set("from", "120.0,10.0");

    expect(decodeTripSearch(outOfRange.toString())).toBeNull();
  });
});
