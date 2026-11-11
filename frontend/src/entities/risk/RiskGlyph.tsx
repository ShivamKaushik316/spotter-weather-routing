import type { RiskLevelKey } from "./riskLevels";

const GLYPH_PATHS: Record<RiskLevelKey, string> = {
  Low: "M6 1.5a4.5 4.5 0 110 9 4.5 4.5 0 010-9z",
  Moderate: "M6 1.5l5 9H1z",
  High: "M6 1l5 5-5 5-5-5z",
  Severe: "M2 2h8v8H2z",
  "No Travel": "M6 1a5 5 0 110 10A5 5 0 016 1zm-3 4v2h6V5z",
  Unknown:
    "M6 1a5 5 0 110 10A5 5 0 016 1zm0 2.5a1.5 1.5 0 00-1.5 1.5h1.2a.3.3 0 11.6 0c0 .5-.9.6-.9 1.6v.4h1.2c0-.7.9-.8.9-2A1.5 1.5 0 006 3.5zM5.4 8h1.2v1.2H5.4z",
};

interface RiskGlyphProps {
  level: RiskLevelKey;
  color: string;
  size?: number;
}

export function RiskGlyph({ level, color, size = 10 }: RiskGlyphProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 12 12" aria-hidden="true" focusable="false">
      <path d={GLYPH_PATHS[level]} fill={color} fillRule="evenodd" />
    </svg>
  );
}
