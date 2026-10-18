import { Fragment, useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/utils";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const WORD = "LEXICHAIN";

type LogoSize = "sm" | "md" | "lg";
type LogoTag = "h1" | "h2" | "div" | "span";

// Everything inside is sized in em, so one font size scales the whole mark.
// md/lg use clamp() so all nine tiles fit a 320px-wide phone.
const SIZE_STYLES: Record<LogoSize, { className?: string; style?: CSSProperties }> = {
  sm: { className: "text-lg sm:text-xl md:text-2xl" },
  md: { style: { fontSize: "clamp(1.25rem, 5.6vw, 2.75rem)" } },
  lg: { style: { fontSize: "clamp(1.25rem, 6.2vw, 3.75rem)" } },
};

interface LogoProps {
  size?: LogoSize;
  /** Draw the chain links in on mount. Ignored when the user prefers reduced motion. */
  animated?: boolean;
  /** Element to render; use "h1" where the wordmark is the page heading. */
  as?: LogoTag;
  className?: string;
}

// Two interlocking loops that tuck under the neighbouring tiles, so only the
// interlock shows in the gap. pathLength=1 keeps the draw-in size-independent.
function ChainLink({ drawn, delay, animate }: { drawn: boolean; delay: number; animate: boolean }) {
  const loopStyle = (extraDelay: number): CSSProperties => ({
    strokeDasharray: 1,
    strokeDashoffset: drawn ? 0 : 1,
    transition: animate ? `stroke-dashoffset 450ms cubic-bezier(0.4, 0, 0.2, 1) ${delay + extraDelay}ms` : undefined,
  });
  return (
    <span className="relative z-0 block h-[1.25em] w-[0.36em] shrink-0">
      <svg
        viewBox="0 0 42 16"
        fill="none"
        className="absolute left-1/2 top-1/2 h-[0.38em] w-[1em] -translate-x-1/2 -translate-y-1/2 overflow-visible"
      >
        <rect x="2" y="3" width="22" height="10" rx="5" pathLength={1} stroke="hsl(var(--brand-600))" strokeWidth="3.2" style={loopStyle(0)} />
        <rect x="18" y="3" width="22" height="10" rx="5" pathLength={1} stroke="hsl(var(--brand-400))" strokeWidth="3.2" style={loopStyle(110)} />
      </svg>
    </span>
  );
}

/**
 * The Lexichain wordmark: letters on board tiles joined by chain links.
 * Screen readers get the name once via aria-label; the tiles and links are decorative.
 */
export function Logo({ size = "md", animated = false, as: Tag = "div", className }: LogoProps) {
  const reducedMotion = useReducedMotion();
  const animate = animated && !reducedMotion;
  const [drawn, setDrawn] = useState(!animate);

  useEffect(() => {
    if (!animate) {
      setDrawn(true);
      return;
    }
    setDrawn(false);
    // Two frames so the undrawn state paints before the transition starts
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setDrawn(true));
    });
    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [animate]);

  const { className: sizeClass, style } = SIZE_STYLES[size];
  const isHeading = Tag === "h1" || Tag === "h2";

  return (
    <Tag
      aria-label="Lexichain"
      role={isHeading ? undefined : "img"}
      className={cn("m-0 inline-flex max-w-full select-none items-center font-extrabold leading-none", sizeClass, className)}
      style={style}
    >
      <span aria-hidden="true" className="inline-flex items-center">
        {WORD.split("").map((letter, i) => (
          <Fragment key={i}>
            {i > 0 && <ChainLink drawn={drawn} delay={180 + (i - 1) * 85} animate={animate} />}
            <span
              className={cn(
                "relative z-10 flex h-[1.25em] w-[1.12em] shrink-0 items-center justify-center rounded-[0.2em] text-white",
                "bg-gradient-to-b from-[hsl(265_80%_58%)] to-[hsl(265_84%_42%)] shadow-[inset_0_-0.06em_0_hsl(265_84%_30%/0.6),inset_0_0.05em_0_hsl(0_0%_100%/0.25),0_0.08em_0.2em_hsl(265_84%_30%/0.35)]",
                animate && "animate-in fade-in zoom-in-75 fill-mode-both duration-500"
              )}
              style={animate ? { animationDelay: `${i * 55}ms` } : undefined}
            >
              <span className="text-[0.82em] tracking-normal">{letter}</span>
            </span>
          </Fragment>
        ))}
      </span>
    </Tag>
  );
}

export default Logo;
