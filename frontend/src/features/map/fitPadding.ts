export interface FitPadding {
  top: number;
  bottom: number;
  left: number;
  right: number;
}

export interface ViewportSize {
  width: number;
  height: number;
}

const MOBILE_BREAKPOINT_PIXELS = 960;
const SIDE_CARD_BREAKPOINT_PIXELS = 1240;
const MAXIMUM_PADDING_SHARE = 0.7;

function desiredPadding({ width, height }: ViewportSize): FitPadding {
  if (width < MOBILE_BREAKPOINT_PIXELS) {
    return { top: 70, bottom: Math.round(height * 0.48) + 140, left: 30, right: 30 };
  }
  return {
    top: 90,
    bottom: 160,
    left: 440,
    right: width > SIDE_CARD_BREAKPOINT_PIXELS ? 340 : 70,
  };
}

function shrinkToFit(first: number, second: number, available: number): [number, number] {
  const allowed = available * MAXIMUM_PADDING_SHARE;
  const total = first + second;
  if (total <= allowed) return [first, second];
  const scale = allowed / total;
  return [Math.floor(first * scale), Math.floor(second * scale)];
}

export function fitPaddingFor(viewport: ViewportSize): FitPadding {
  const padding = desiredPadding(viewport);
  const [left, right] = shrinkToFit(padding.left, padding.right, viewport.width);
  const [top, bottom] = shrinkToFit(padding.top, padding.bottom, viewport.height);
  return { top, bottom, left, right };
}
