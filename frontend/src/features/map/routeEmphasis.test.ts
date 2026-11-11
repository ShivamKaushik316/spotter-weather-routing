import {
  checkpointRadiusExpression,
  focusedRouteValue,
  routeSortKey,
  visibleRoutesFilter,
} from "./routeEmphasis";

describe("routeEmphasis", () => {
  it("emphasises the focused route", () => {
    expect(focusedRouteValue("B", 1, 0.3)).toEqual([
      "case",
      ["==", ["get", "routeId"], "B"],
      1,
      0.3,
    ]);
  });

  it("draws the focused route above the recommended one", () => {
    expect(routeSortKey("B", "A")).toEqual([
      "case",
      ["==", ["get", "routeId"], "B"],
      2,
      ["==", ["get", "routeId"], "A"],
      1,
      0,
    ]);
  });

  it("hides alternates except the focused route when alternates are off", () => {
    expect(visibleRoutesFilter(true, "A", "B")).toBeNull();
    expect(visibleRoutesFilter(false, "A", "B")).toEqual([
      "in",
      ["get", "routeId"],
      ["literal", ["A", "B"]],
    ]);
  });

  it("enlarges only the selected checkpoint", () => {
    const withoutSelection = JSON.stringify(checkpointRadiusExpression(null));
    const withSelection = JSON.stringify(checkpointRadiusExpression({ routeId: "A", sequence: 3 }));

    expect(withoutSelection).toContain('["boolean",false]');
    expect(withSelection).toContain('["==",["get","sequence"],3]');
  });
});
