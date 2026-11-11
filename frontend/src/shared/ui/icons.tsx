import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function StrokeIcon({ size = 16, children, ...props }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

export const TrendIcon = (props: IconProps) => (
  <StrokeIcon strokeWidth={2.4} {...props}>
    <path d="M3 17l5-5 4 4 8-8" />
    <path d="M14 8h6v6" />
  </StrokeIcon>
);

export const SwapIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M7 4v16M7 20l-3-3M7 20l3-3M17 20V4M17 4l-3 3M17 4l3 3" />
  </StrokeIcon>
);

export const CrosshairIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2v4M12 18v4M2 12h4M18 12h4" />
  </StrokeIcon>
);

export const LinkIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M10 13a5 5 0 007.5.5l3-3a5 5 0 00-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 00-7.5-.5l-3 3a5 5 0 007 7l1.7-1.7" />
  </StrokeIcon>
);

export const SunIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </StrokeIcon>
);

export const MoonIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z" />
  </StrokeIcon>
);

export const AlertIcon = (props: IconProps) => (
  <StrokeIcon strokeWidth={2.4} {...props}>
    <path d="M12 9v4M12 17h.01" />
    <path d="M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z" />
  </StrokeIcon>
);

export const InfoIcon = (props: IconProps) => (
  <StrokeIcon strokeWidth={2.4} {...props}>
    <circle cx="12" cy="12" r="10" />
    <path d="M12 16v-4M12 8h.01" />
  </StrokeIcon>
);

export const CloseIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <path d="M18 6L6 18M6 6l12 12" />
  </StrokeIcon>
);

export const ArrowRightIcon = (props: IconProps) => (
  <StrokeIcon strokeWidth={2.4} {...props}>
    <path d="M9 18l6-6-6-6" />
  </StrokeIcon>
);

export const ClockIcon = (props: IconProps) => (
  <StrokeIcon {...props}>
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </StrokeIcon>
);

export const PlayIcon = (props: IconProps) => (
  <svg
    width={props.size ?? 18}
    height={props.size ?? 18}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <path d="M7 5v14l12-7z" />
  </svg>
);

export const PauseIcon = (props: IconProps) => (
  <svg
    width={props.size ?? 18}
    height={props.size ?? 18}
    viewBox="0 0 24 24"
    fill="currentColor"
    aria-hidden="true"
  >
    <rect x="6" y="5" width="4" height="14" rx="1" />
    <rect x="14" y="5" width="4" height="14" rx="1" />
  </svg>
);
