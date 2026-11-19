import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/**
 * Chain-link art for the board: the links that join selected tiles and the
 * small "in last word" corner mark. Everything is drawn inline so it takes
 * its color from the surrounding text color and follows themes, skins,
 * color-vision palettes, and high contrast without extra files.
 */

// A thin outline in the page color keeps a link readable over any tile.
// Skins may set --path-halo; it is painted behind the fill so the body
// keeps its full thickness.
const HALO_COLOR = "var(--path-halo, hsl(var(--background, 0 0% 100%)))";
const HALO: CSSProperties = { stroke: HALO_COLOR, paintOrder: "stroke" };
const HALO_LINE: CSSProperties = { stroke: HALO_COLOR };

// Both links are drawn in a 36 x 14 box centered on the origin.
const LINK_BOX_WIDTH = 36;
const ORTHOGONAL_WIDTH = 0.42; // share of the tile's width
// Slightly shorter, so a diagonal link stays inside the gap where four tiles
// meet and clear of the icons in their corners.
const DIAGONAL_WIDTH = 0.4;

/** Two interlocked loops, the left one woven over, then under, the right. */
function IntactLink() {
  return (
    <g strokeLinejoin="bevel">
      <path
        fillRule="evenodd"
        d="M-14.5 -3.2 L-12.5 -5.2 H1.5 L3.5 -3.2 V3.2 L1.5 5.2 H-12.5 L-14.5 3.2 Z M-11.9 -2.1 L-11.4 -2.6 H0.4 L0.9 -2.1 V2.1 L0.4 2.6 H-11.4 L-11.9 2.1 Z"
        fill="currentColor"
        strokeWidth={2.4}
        style={HALO}
      />
      <path
        fillRule="evenodd"
        d="M-3.5 -3.2 L-1.5 -5.2 H12.5 L14.5 -3.2 V3.2 L12.5 5.2 H-1.5 L-3.5 3.2 Z M-0.9 -2.1 L-0.4 -2.6 H11.4 L11.9 -2.1 V2.1 L11.4 2.6 H-0.4 L-0.9 2.1 Z"
        fill="currentColor"
        strokeWidth={2.4}
        style={HALO}
      />
      {/* Left loop passes over the right one at the top */}
      <path d="M-4.8 -5.2 H0.4 M-4.8 -2.6 H0.4" fill="none" strokeWidth={2.4} strokeLinecap="butt" style={HALO_LINE} />
      <rect x={-5} y={-5.2} width={5.6} height={2.6} fill="currentColor" />
      {/* ...and again at the bottom right */}
      <path d="M3.5 1.3 V3.2 L1.5 5.2 H0.0 M0.9 1.3 V2.1 L0.4 2.6" fill="none" strokeWidth={2.4} strokeLinecap="butt" style={HALO_LINE} />
      <path d="M0.9 1.1 H3.5 V3.2 L1.5 5.2 H-0.2 V2.6 H0.4 L0.9 2.1 Z" fill="currentColor" />
      <path d="M-11.5 -4.0 H0.5 M-0.5 -4.0 H11.5" fill="none" stroke="#FFFFFF" strokeWidth={0.8} strokeOpacity={0.35} />
    </g>
  );
}

/** Two snapped hooks with a gap between them: a path that is not a word. */
function BrokenLink() {
  return (
    <g strokeLinejoin="bevel">
      <g transform="rotate(-6 -9.5 0)">
        <path
          d="M-15.0 -2.8 L-13.0 -4.8 H-3.6 L-4.8 -2.4 H-12.1 L-12.6 -1.9 V1.9 L-12.1 2.4 H-4.8 L-3.6 4.8 H-13.0 L-15.0 2.8 Z"
          fill="currentColor"
          strokeWidth={2.4}
          style={HALO}
        />
        <path d="M-12.4 -3.6 H-4.6" fill="none" stroke="#FFFFFF" strokeWidth={0.8} strokeOpacity={0.35} />
      </g>
      <g transform="rotate(6 9.5 0)">
        <path
          d="M15.0 -2.8 L13.0 -4.8 H3.6 L4.8 -2.4 H12.1 L12.6 -1.9 V1.9 L12.1 2.4 H4.8 L3.6 4.8 H13.0 L15.0 2.8 Z"
          fill="currentColor"
          strokeWidth={2.4}
          style={HALO}
        />
        <path d="M4.6 -3.6 H12.4" fill="none" stroke="#FFFFFF" strokeWidth={0.8} strokeOpacity={0.35} />
      </g>
    </g>
  );
}

export interface ChainPoint {
  x: number;
  y: number;
}

interface ChainLinkPathProps {
  /** Tile centers, in order, in the units of the surrounding <svg>. */
  points: ChainPoint[];
  /** Width of one tile in the same units; the links scale with it. */
  tile: number;
  /** Draw broken links, so "not a word" reads without relying on color. */
  broken?: boolean;
}

/**
 * One link at the midpoint between each pair of neighboring tiles. The links
 * sit in the gaps, so the path never covers a letter. Render inside an <svg>;
 * the links take that element's text color.
 */
export function ChainLinkPath({ points, tile, broken = false }: ChainLinkPathProps) {
  return (
    <>
      {points.slice(1).map((to, i) => {
        const from = points[i];
        const dx = to.x - from.x;
        const dy = to.y - from.y;
        const diagonal = Math.abs(dx) > tile * 0.1 && Math.abs(dy) > tile * 0.1;
        const scale = (tile * (diagonal ? DIAGONAL_WIDTH : ORTHOGONAL_WIDTH)) / LINK_BOX_WIDTH;
        // A link looks the same turned half way round, apart from its
        // highlight; keep the angle within a quarter turn so that stays on top.
        let angle = (Math.atan2(dy, dx) * 180) / Math.PI;
        if (angle > 90) angle -= 180;
        else if (angle <= -90) angle += 180;
        return (
          <g key={i} transform={`translate(${(from.x + to.x) / 2} ${(from.y + to.y) / 2}) rotate(${angle}) scale(${scale})`}>
            {broken ? <BrokenLink /> : <IntactLink />}
          </g>
        );
      })}
    </>
  );
}

/**
 * Small interlocked-loops mark for a tile that was part of the last word.
 * Decorative: the tile's own label already says so.
 */
export function ChainMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={cn("h-3.5 w-3.5", className)}>
      <g transform="translate(12 12) rotate(-45)" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinejoin="bevel" strokeLinecap="butt">
        <path d="M-0.4 -2.4 H1.4 L3.0 -0.8 V3.6 L1.4 5.2 H-7.9 L-9.5 3.6 V-0.8 L-7.9 -2.4 H-5.6" />
        <path d="M0.4 2.4 H-1.4 L-3.0 0.8 V-3.6 L-1.4 -5.2 H7.9 L9.5 -3.6 V0.8 L7.9 2.4 H5.6" />
      </g>
    </svg>
  );
}
