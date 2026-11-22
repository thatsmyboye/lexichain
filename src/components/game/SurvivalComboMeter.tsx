// The Survival combo panel: the tier label, the word count and multiplier,
// and a five-segment meter with one segment per combo milestone (3, 5, 7, 10
// and 15 words, as in COMBO_MILESTONES). A star flares on the bar when a
// milestone is reached and stays on from 15.
//
// The bar is 5 segments of 48 units with 4-unit gaps, 256 in all. The labels
// under it use a 5-column grid with the same proportional gap, so each number
// stays centered under its segment at any width.
import { useId } from "react";
import type { ComboState } from "@/lib/survivalMode";
import { cn } from "@/lib/utils";

const MILESTONES = [3, 5, 7, 10, 15] as const;

interface TierTheme {
  label: string;
  stops: [string, string];
  textClass: string;
  panelClass: string;
  flareFill: string;
}

const TIER_THEMES: TierTheme[] = [
  {
    label: "COMBO!",
    stops: ["#22C55E", "#38BDF8"],
    textClass: "text-emerald-700 dark:text-emerald-300",
    panelClass: "bg-emerald-500/10 border-emerald-500/40",
    flareFill: "#38BDF8",
  },
  {
    label: "SUPER COMBO!",
    stops: ["#84CC16", "#FACC15"],
    textClass: "text-amber-700 dark:text-amber-300",
    panelClass: "bg-amber-500/10 border-amber-500/45",
    flareFill: "#FACC15",
  },
  {
    label: "MEGA COMBO!",
    stops: ["#FACC15", "#F97316"],
    textClass: "text-orange-700 dark:text-orange-300",
    panelClass: "bg-orange-500/15 border-orange-500/50",
    flareFill: "#FB923C",
  },
  {
    label: "EPIC COMBO!",
    stops: ["#F97316", "#EF4444"],
    textClass: "text-red-700 dark:text-red-300",
    panelClass: "bg-red-500/15 border-red-500/50",
    flareFill: "#F87171",
  },
  {
    label: "LEGENDARY COMBO!",
    stops: ["#7927EC", "#EC4899"],
    textClass: "text-purple-700 dark:text-purple-300",
    panelClass: "bg-purple-500/15 border-purple-500/55",
    flareFill: "#E879F9",
  },
];

function getTierIndex(combo: number): number {
  if (combo >= 15) return 4;
  if (combo >= 10) return 3;
  if (combo >= 7) return 2;
  if (combo >= 5) return 1;
  return 0;
}

function getSegmentFill(combo: number, segIdx: number): number {
  const start = MILESTONES[segIdx];
  const next = MILESTONES[segIdx + 1];
  if (combo < start) return 0;
  if (next === undefined || combo >= next) return 1;
  const span = next - start;
  return Math.min(1, 0.35 + ((combo - start) / span) * 0.65);
}

interface SurvivalComboMeterProps {
  comboState: ComboState;
  className?: string;
}

export function SurvivalComboMeter({ comboState, className }: SurvivalComboMeterProps) {
  const uid = useId().replace(/:/g, "");
  const combo = comboState.currentCombo;
  if (combo < 3) return null;

  const tierIdx = getTierIndex(combo);
  const tier = TIER_THEMES[tierIdx];
  const isMilestoneFlare = (MILESTONES as readonly number[]).includes(combo) || combo >= 15;

  // Full-bleed geometry: 5 * 48 + 4 * 4 = 256 exact -> matches grid-cols-5 gap-[1.5625%] 1:1
  const segW = 48;
  const segGap = 4;
  const segH = 8;
  const segY = 2;
  const flareX = tierIdx * (segW + segGap) + segW * getSegmentFill(combo, tierIdx);

  return (
    <div
      className={cn(
        "rounded-lg border-2 px-2.5 py-1.5 transition-colors",
        tier.panelClass,
        className,
      )}
    >
      <div className="mb-1 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className={cn("font-display text-[13px] font-bold leading-tight", tier.textClass)}>
            {tier.label}
          </div>
          <div className="text-[11px] leading-tight text-muted-foreground">
            {combo} words • {comboState.comboMultiplier.toFixed(1)}x multiplier
          </div>
        </div>
        <div className={cn("font-display-num text-xl font-bold leading-none", tier.textClass)}>
          {combo}
        </div>
      </div>

      {/* G6: Full-width segmented geometric combo meter (no text inside SVG) */}
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox="0 0 256 12"
        width="256"
        height="12"
        role="progressbar"
        aria-label="Combo milestone meter"
        aria-valuemin={3}
        aria-valuemax={15}
        aria-valuenow={Math.min(15, combo)}
        className="block h-auto w-full overflow-visible"
      >
        <title id={`${uid}-title`}>Combo milestone meter</title>
        <defs>
          {TIER_THEMES.map((t, i) => {
            const x = i * (segW + segGap);
            return (
              <linearGradient
                key={i}
                id={`${uid}-g${i}`}
                gradientUnits="userSpaceOnUse"
                x1={x}
                y1={segY}
                x2={x + segW}
                y2={segY + segH}
              >
                <stop offset="0%" stopColor={t.stops[0]} />
                <stop offset="100%" stopColor={t.stops[1]} />
              </linearGradient>
            );
          })}
          {MILESTONES.map((_, i) => {
            const x = i * (segW + segGap);
            return (
              <clipPath key={i} id={`${uid}-c${i}`}>
                <polygon
                  points={`${x + 2.5},${segY} ${x + segW - 2.5},${segY} ${x + segW},${segY + 2.5} ${x + segW},${segY + segH - 2.5} ${x + segW - 2.5},${segY + segH} ${x + 2.5},${segY + segH} ${x},${segY + segH - 2.5} ${x},${segY + 2.5}`}
                />
              </clipPath>
            );
          })}
        </defs>

        {MILESTONES.map((_, i) => {
          const x = i * (segW + segGap);
          const fill = getSegmentFill(combo, i);
          const shape = `${x + 2.5},${segY} ${x + segW - 2.5},${segY} ${x + segW},${segY + 2.5} ${x + segW},${segY + segH - 2.5} ${x + segW - 2.5},${segY + segH} ${x + 2.5},${segY + segH} ${x},${segY + segH - 2.5} ${x},${segY + 2.5}`;

          return (
            <g key={i}>
              <polygon points={shape} fill="currentColor" fillOpacity="0.12" />
              {fill > 0 && (
                <g clipPath={`url(#${uid}-c${i})`}>
                  <rect
                    x={x}
                    y={segY}
                    width={+(segW * fill).toFixed(2)}
                    height={segH}
                    fill={`url(#${uid}-g${i})`}
                  />
                  <line
                    x1={x + 1.5}
                    y1={segY + 1.5}
                    x2={x + segW * fill - 1.5}
                    y2={segY + 1.5}
                    stroke="#FFFFFF"
                    strokeWidth="1.2"
                    strokeOpacity="0.65"
                  />
                </g>
              )}
              <polygon
                points={shape}
                fill="none"
                stroke="currentColor"
                strokeOpacity={fill > 0 ? 0.55 : 0.25}
                strokeWidth="1.1"
                strokeLinejoin="bevel"
              />
            </g>
          );
        })}

        {isMilestoneFlare && (
          <g
            transform={`translate(${Math.min(250, Math.max(6, flareX)).toFixed(1)} 6)`}
            className="combo-meter-flare"
          >
            <polygon
              points="0,-7.5 2.3,-2.3 7.5,0 2.3,2.3 0,7.5 -2.3,2.3 -7.5,0 -2.3,-2.3"
              fill={tier.flareFill}
              stroke="#0F172A"
              strokeWidth="1.2"
              strokeLinejoin="bevel"
            />
            <polygon points="0,-3.5 1.1,-1.1 3.5,0 1.1,1.1 0,3.5 -1.1,1.1 -3.5,0 -1.1,-1.1" fill="#FFFFFF" />
          </g>
        )}
      </svg>

      {/* Gap 1.5625% === 4/256 -> labels lock identically to each SVG segment center at any width */}
      <div className="mt-0.5 grid grid-cols-5 gap-[1.5625%] text-center font-display-num text-[10px] font-semibold leading-none">
        {MILESTONES.map((step) => (
          <span
            key={step}
            className={cn(
              combo >= step ? tier.textClass : "text-muted-foreground/60",
            )}
          >
            {step === 15 ? "15+" : step}
          </span>
        ))}
      </div>
    </div>
  );
}
