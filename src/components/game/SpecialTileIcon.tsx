import type React from "react";
import type { SpecialTileType } from "@/types/game";
import { cn } from "@/lib/utils";

interface SpecialTileIconProps extends Omit<React.SVGProps<SVGSVGElement>, "ref"> {
  type: NonNullable<SpecialTileType>;
  /** Accepted for drop-in compatibility with LucideIcon call sites. */
  size?: number | string;
  strokeWidth?: number;
}

function renderGlyph(type: NonNullable<SpecialTileType>, strokeWidth: number) {
  switch (type) {
    case "stone":
      // Unified faceted crag boulder with a top-right fracture notch and 120° sunlit face
      return (
        <>
          <path
            fill="currentColor"
            fillOpacity="0.62"
            d="M4.5,20 L2.5,15.5 L5,8.5 L10.5,3.5 L14.2,5 L11.8,10.8 L13.2,13.4 L16.4,6.4 L19.5,10 L21.5,15.5 L19.5,20 Z"
          />
          <polygon
            points="4.5,20 2.5,15.5 5,8.5 10.5,3.5 14.2,5 11.8,10.8 13.2,13.4 10.2,20"
            fill="currentColor"
          />
        </>
      );

    case "wild":
      // 4-point faceted star (0.313 inner/outer ratio, synced to Wild Wizard & Chaos Conductor) + sparkle
      return (
        <>
          <polygon points="11,4 13.8,10.2 20,13 13.8,15.8 11,22 8.2,15.8 2,13 8.2,10.2" fill="currentColor" />
          <polygon points="18.5,2.5 19.5,4.5 21.5,5.5 19.5,6.5 18.5,8.5 17.5,6.5 15.5,5.5 17.5,4.5" fill="currentColor" fillOpacity="0.82" />
        </>
      );

    case "xfactor":
      // Bold chamfered X with recessed diamond eye
      return (
        <path
          fillRule="evenodd"
          fill="currentColor"
          d="M6,3 L12,9 L18,3 L21,6 L15,12 L21,18 L18,21 L12,15 L6,21 L3,18 L9,12 L3,6 Z M12,9.8 L14.2,12 L12,14.2 L9.8,12 Z"
        />
      );

    case "multiplier":
      // Solid faceted lightning bolt (keeps players' existing Zap cue)
      return (
        <>
          <polygon points="14,2 4.5,13.5 11.5,13.5 10,22 19.5,10.5 12.5,10.5" fill="currentColor" />
          <polygon points="14,2 4.5,13.5 11.5,13.5 12.5,10.5" fill="currentColor" fillOpacity="0.25" />
        </>
      );

    case "shuffle":
      // Crossing faceted swap arrows with butt caps (strictly inside [3.2, 21.6])
      return (
        <>
          <path
            d="M3.2,17.2 H7.6 L15.4,6.8 H17.4"
            fill="none"
            stroke="currentColor"
            strokeWidth={Math.max(2.3, strokeWidth)}
            strokeLinecap="butt"
            strokeLinejoin="bevel"
          />
          <polygon points="16,3.2 21.6,6.8 16,10.4" fill="currentColor" />
          <path
            d="M3.2,6.8 H7.6 L9.9,9.8 M13.1,14.2 L15.4,17.2 H17.4"
            fill="none"
            stroke="currentColor"
            strokeWidth={Math.max(2.3, strokeWidth)}
            strokeLinecap="butt"
            strokeLinejoin="bevel"
            strokeOpacity="0.82"
          />
          <polygon points="16,13.6 21.6,17.2 16,20.8" fill="currentColor" fillOpacity="0.82" />
        </>
      );

    case "freeze":
      // Geometric 6-spoke crystal with butt caps (strictly inside [2.4, 21.6])
      return (
        <>
          <g
            fill="none"
            stroke="currentColor"
            strokeWidth={Math.max(2.1, strokeWidth * 0.92)}
            strokeLinecap="butt"
            strokeLinejoin="bevel"
          >
            <line x1="12" y1="2.4" x2="12" y2="21.6" />
            <line x1="3.7" y1="7.2" x2="20.3" y2="16.8" />
            <line x1="20.3" y1="7.2" x2="3.7" y2="16.8" />
            <polyline points="9.2,4.8 12,7.5 14.8,4.8" />
            <polyline points="9.2,19.2 12,16.5 14.8,19.2" />
          </g>
          <polygon points="12,9.2 14.8,12 12,14.8 9.2,12" fill="currentColor" />
        </>
      );

    case "decay":
      // Classic 3-lobe open-horn biohazard trefoil around a negative-space eye (inside [2.7, 21.3])
      return (
        <g transform="translate(12 12.8)">
          <polygon
            fill="currentColor"
            points="-2.6,-9.2 -4.8,-6.8 -4.0,-3.8 -1.4,-1.8 1.4,-1.8 4.0,-3.8 4.8,-6.8 2.6,-9.2 2.8,-6.0 1.4,-4.3 -1.4,-4.3 -2.8,-6.0"
          />
          <polygon
            transform="rotate(120)"
            fill="currentColor"
            points="-2.6,-9.2 -4.8,-6.8 -4.0,-3.8 -1.4,-1.8 1.4,-1.8 4.0,-3.8 4.8,-6.8 2.6,-9.2 2.8,-6.0 1.4,-4.3 -1.4,-4.3 -2.8,-6.0"
          />
          <polygon
            transform="rotate(240)"
            fill="currentColor"
            points="-2.6,-9.2 -4.8,-6.8 -4.0,-3.8 -1.4,-1.8 1.4,-1.8 4.0,-3.8 4.8,-6.8 2.6,-9.2 2.8,-6.0 1.4,-4.3 -1.4,-4.3 -2.8,-6.0"
          />
          <path
            fillRule="evenodd"
            fill="currentColor"
            fillOpacity="0.82"
            d="M0,-3.8 L3.3,-1.9 V1.9 L0,3.8 L-3.3,1.9 V-1.9 Z M0,-1.8 L1.55,-0.9 V0.9 L0,1.8 L-1.55,0.9 V-0.9 Z"
          />
        </g>
      );

    case "mirror":
      // Vertical glass axis with solid source triangle & faceted reflected ghost
      return (
        <>
          <rect x="10.9" y="2.5" width="2.2" height="19" fill="currentColor" />
          <polygon points="2.8,12 9.4,5.2 9.4,18.8" fill="currentColor" />
          <polygon points="21.2,12 14.6,5.2 14.6,18.8" fill="currentColor" fillOpacity="0.28" />
          <polygon
            points="20.4,12 15.2,6.6 15.2,17.4"
            fill="none"
            stroke="currentColor"
            strokeWidth={Math.max(1.9, strokeWidth * 0.85)}
            strokeLinejoin="bevel"
          />
        </>
      );

    case "magnet":
      // Chamfered U-magnet with separated pole tips (pairs cleanly with .tile-magnet-tug)
      return (
        <>
          <rect x="4" y="3.5" width="4.5" height="3.8" fill="currentColor" fillOpacity="0.72" />
          <rect x="15.5" y="3.5" width="4.5" height="3.8" fill="currentColor" fillOpacity="0.72" />
          <path
            fill="currentColor"
            d="M4,9 H8.5 V14.2 L10.3,16 H13.7 L15.5,14.2 V9 H20 V15.8 L15.8,20 H8.2 L4,15.8 Z"
          />
        </>
      );

    case "bomb":
      // Faceted octagonal bomb with diagonal fuse & 4-point diamond spark (inside [2.2, 21.8])
      return (
        <>
          <path
            fillRule="evenodd"
            fill="currentColor"
            d="M7.5,7.5 H13.5 L17.5,11.5 V17.5 L13.5,21.5 H7.5 L3.5,17.5 V11.5 Z M7.8,10.2 L5.8,12.2 V14.8 L7.5,14.8 V12.8 L9.5,10.8 H11.2 V10.2 Z"
          />
          <polygon points="13.8,7.2 15.4,5.6 18.0,8.2 16.4,9.8" fill="currentColor" />
          <polygon points="19,2.2 19.9,4.1 21.8,5 19.9,5.9 19,7.8 18.1,5.9 16.2,5 18.1,4.1" fill="currentColor" />
        </>
      );

    case "chain":
      // Two separated chamfered C-hooks bridged by a pinched center coupling bar (inside [2.95, 21.05])
      return (
        <g transform="translate(12 12) rotate(-45)">
          <path
            fill="currentColor"
            d="M-2.2,-5.8 H-7 L-10,-2.8 V2.8 L-7,5.8 H-2.2 V3.4 H-6 L-7.6,1.8 V-1.8 L-6,-3.4 H-2.2 Z"
          />
          <path
            fill="currentColor"
            fillOpacity="0.82"
            d="M2.2,-5.8 H7 L10,-2.8 V2.8 L7,5.8 H2.2 V3.4 H6 L7.6,1.8 V-1.8 L6,-3.4 H2.2 Z"
          />
          <rect x="-5.4" y="-1.25" width="10.8" height="2.5" rx="0.6" fill="currentColor" />
        </g>
      );

    case "ghost":
      // Chamfered geometric phantom with bold negative-space diamond eyes
      return (
        <path
          fillRule="evenodd"
          fill="currentColor"
          d="M5,20.5 V10 L8.5,4 H15.5 L19,10 V20.5 L15.8,17.4 L12,20.5 L8.2,17.4 Z M8.2,10.2 L9.7,8.7 L11.2,10.2 L9.7,12.2 Z M12.8,10.2 L14.3,8.7 L15.8,10.2 L14.3,12.2 Z"
        />
      );

    case "tax":
      // Chamfered coin cut by a bold negative-space % penalty slash
      return (
        <path
          fillRule="evenodd"
          fill="currentColor"
          d="M8,3 H16 L21,8 V16 L16,21 H8 L3,16 V8 Z M7.8,16.6 L14.6,6.8 L16.8,8.2 L10,18 Z M7.5,9.2 L9.2,7.5 L10.9,9.2 L9.2,10.9 Z M13.1,14.8 L14.8,13.1 L16.5,14.8 L14.8,16.5 Z"
        />
      );
  }
}

export function SpecialTileIcon({
  type,
  className,
  size,
  strokeWidth = 2.25,
  style,
  ...rest
}: SpecialTileIconProps) {
  const glyph = renderGlyph(type, strokeWidth);
  if (!glyph) return null;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      width={size}
      height={size}
      aria-hidden="true"
      focusable="false"
      className={cn("h-3.5 w-3.5 shrink-0", className)}
      style={style}
      {...rest}
    >
      {glyph}
    </svg>
  );
}
