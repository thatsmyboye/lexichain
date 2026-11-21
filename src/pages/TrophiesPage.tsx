import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TrophyBadge } from "@/components/trophies/TrophyBadge";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/achievements";
import { TROPHY_HINTS, useTrophies } from "@/lib/trophies";

const SEEN_KEY = "lexichain-trophies-seen";

const RARITY_STYLE: Record<string, { badge: string; label: string }> = {
  common: { badge: "bg-slate-200 text-slate-900 dark:bg-slate-700/60 dark:text-slate-100", label: "Common" },
  rare: { badge: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100", label: "Rare" },
  epic: { badge: "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100", label: "Epic" },
  legendary: { badge: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100", label: "Legendary" },
};

// Trophies per shelf: 2, then 3 from Tailwind's sm width, then 4 from lg.
// The count is needed in script, not only in CSS, because each row of
// trophies gets its own shelf.
const SHELF_QUERIES = ["(min-width: 640px)", "(min-width: 1024px)"];
function readShelfColumns() {
  if (typeof window === "undefined" || !window.matchMedia) return 2;
  return 2 + SHELF_QUERIES.filter(q => window.matchMedia(q).matches).length;
}
function useShelfColumns() {
  const [columns, setColumns] = useState(readShelfColumns);
  useEffect(() => {
    const lists = SHELF_QUERIES.map(q => window.matchMedia(q));
    const update = () => setColumns(readShelfColumns());
    lists.forEach(l => l.addEventListener("change", update));
    return () => lists.forEach(l => l.removeEventListener("change", update));
  }, []);
  return columns;
}

// "Word Artisan (3 words of 6+ letters)" -> "Word Artisan"
const shortName = (label: string) => label.replace(/\s*\(.*\)\s*$/, "");

export default function TrophiesPage() {
  const navigate = useNavigate();
  const trophies = useTrophies();
  const ids = Object.keys(ACHIEVEMENTS) as AchievementId[];
  const unlockedCount = ids.filter(id => trophies[id]).length;
  const columns = useShelfColumns();

  // Trophies unlocked since the last visit get an unlock animation
  const freshRef = useRef<Set<string> | null>(null);
  if (freshRef.current === null) {
    let seen: string[] = [];
    try {
      seen = JSON.parse(localStorage.getItem(SEEN_KEY) || "[]");
    } catch {
      seen = [];
    }
    freshRef.current = new Set(ids.filter(id => trophies[id] && !seen.includes(id)));
  }
  useEffect(() => {
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(ids.filter(id => trophies[id])));
    } catch {
      // Non-critical
    }
  }, [trophies]); // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = useMemo(() => {
    const order = { legendary: 0, epic: 1, rare: 2, common: 3 };
    return [...ids].sort((a, b) => {
      const ua = trophies[a] ? 0 : 1;
      const ub = trophies[b] ? 0 : 1;
      return ua - ub || order[ACHIEVEMENTS[a].rarity] - order[ACHIEVEMENTS[b].rarity];
    });
  }, [trophies]); // eslint-disable-line react-hooks/exhaustive-deps

  const shelves = useMemo(() => {
    const rows: AchievementId[][] = [];
    for (let i = 0; i < sorted.length; i += columns) rows.push(sorted.slice(i, i + columns));
    return rows;
  }, [sorted, columns]);

  return (
    <main className="container mx-auto max-w-4xl py-6">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Back to title" onClick={() => navigate("/")}>
          <ArrowLeft />
        </Button>
        <h1 className="font-display text-3xl font-extrabold tracking-tight">Trophy case</h1>
      </div>

      <div className="mb-6">
        <p className="mb-2 text-sm text-foreground/80">
          {unlockedCount} of {ids.length} trophies unlocked
        </p>
        <div
          className="h-3 overflow-hidden rounded-full bg-muted"
          role="progressbar"
          aria-label="Trophies unlocked"
          aria-valuemin={0}
          aria-valuemax={ids.length}
          aria-valuenow={unlockedCount}
        >
          <div
            className="h-full rounded-full bg-gradient-to-r from-[hsl(var(--brand-400))] to-[hsl(var(--brand-600))] transition-[width] duration-700"
            style={{ width: `${(unlockedCount / ids.length) * 100}%` }}
          />
        </div>
      </div>

      {/* One shelf per row. The rows are layout only, so the trophies are
          exposed to assistive technology as a single list. */}
      <div role="list" aria-label="Trophies" className="space-y-6">
        {shelves.map((shelf, index) => (
          <div
            key={index}
            role="presentation"
            className="relative grid gap-x-3"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
          >
            {/* Sits 7px under the top of the trophies' feet, so they stand on its deck */}
            <div aria-hidden="true" className="trophy-shelf pointer-events-none absolute inset-x-0 top-[57px]" />
            {shelf.map(id => {
              const achievement = ACHIEVEMENTS[id];
              const record = trophies[id];
              const style = RARITY_STYLE[achievement.rarity];
              const fresh = freshRef.current?.has(id);
              return (
                <div
                  key={id}
                  role="listitem"
                  className={`relative flex flex-col items-center px-1 text-center ${record ? "" : "opacity-80"} ${fresh ? "animate-in zoom-in-50 fade-in duration-700" : ""}`}
                >
                  <TrophyBadge id={id} rarity={achievement.rarity} unlocked={!!record} className="mb-[22px] h-16 w-16" />
                  <h2 className="text-sm font-semibold leading-tight">
                    {shortName(achievement.label)}
                    {!record && <span className="sr-only"> (locked)</span>}
                  </h2>
                  <p className="mt-1 text-xs text-foreground/75">{TROPHY_HINTS[id]}</p>
                  <div className="mt-2 flex flex-wrap items-center justify-center gap-1">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}>{style.label}</span>
                    <span className="text-[10px] text-foreground/70">+{achievement.scoreBonus} pts</span>
                  </div>
                  {record && (
                    <p className="mt-1 text-[10px] text-foreground/70">
                      {new Date(record.unlockedAt).toLocaleDateString()}{record.count > 1 ? ` · earned ${record.count}×` : ""}
                    </p>
                  )}
                  {fresh && <span className="absolute right-2 top-0 rounded-full bg-[hsl(var(--brand-500))] px-1.5 py-0.5 text-[10px] font-bold text-white">New</span>}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </main>
  );
}
