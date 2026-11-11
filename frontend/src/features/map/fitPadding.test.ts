import { fitPaddingFor } from "./fitPadding";

describe("fitPaddingFor", () => {
  it("leaves room for the planner panel and departure card on wide screens", () => {
    expect(fitPaddingFor({ width: 1600, height: 960 })).toEqual({
      top: 90,
      bottom: 160,
      left: 440,
      right: 340,
    });
  });

  it("drops the side-card padding when the card is hidden", () => {
    expect(fitPaddingFor({ width: 1200, height: 800 }).right).toBe(70);
  });

  it("never lets padding consume the whole map", () => {
    const viewport = { width: 1000, height: 700 };
    const padding = fitPaddingFor(viewport);

    expect(padding.left + padding.right).toBeLessThanOrEqual(viewport.width * 0.7);
    expect(padding.top + padding.bottom).toBeLessThanOrEqual(viewport.height * 0.7);
  });

  it("reserves the bottom sheet on phones", () => {
    const padding = fitPaddingFor({ width: 412, height: 915 });

    expect(padding.left).toBe(30);
    expect(padding.top + padding.bottom).toBeLessThanOrEqual(915 * 0.7);
  });
});
