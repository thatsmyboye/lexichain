import { useEffect, useMemo, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ACHIEVEMENTS, type AchievementId } from "@/lib/achievements";
import { TROPHY_HINTS, useTrophies } from "@/lib/trophies";

const SEEN_KEY = "lexichain-trophies-seen";

const RARITY_STYLE: Record<string, { ring: string; badge: string; emoji: string; label: string }> = {
  common: { ring: "from-amber-200 to-amber-400", badge: "bg-amber-100 text-amber-900 dark:bg-amber-900/40 dark:text-amber-100", emoji: "🏆", label: "Common" },
  rare: { ring: "from-sky-300 to-blue-500", badge: "bg-sky-100 text-sky-900 dark:bg-sky-900/40 dark:text-sky-100", emoji: "⭐", label: "Rare" },
  epic: { ring: "from-fuchsia-300 to-purple-600", badge: "bg-purple-100 text-purple-900 dark:bg-purple-900/40 dark:text-purple-100", emoji: "💎", label: "Epic" },
  legendary: { ring: "from-yellow-200 via-amber-400 to-orange-500", badge: "bg-orange-100 text-orange-900 dark:bg-orange-900/40 dark:text-orange-100", emoji: "👑", label: "Legendary" },
};

// "Word Artisan (3 words of 6+ letters)" -> "Word Artisan"
const shortName = (label: string) => label.replace(/\s*\(.*\)\s*$/, "");

export default function TrophiesPage() {
  const navigate = useNavigate();
  const trophies = useTrophies();
  const ids = Object.keys(ACHIEVEMENTS) as AchievementId[];
  const unlockedCount = ids.filter(id => trophies[id]).length;

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

  return (
    <main className="container mx-auto max-w-4xl py-6">
      <div className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" className="h-11 w-11" aria-label="Back to title" onClick={() => navigate("/")}>
          <ArrowLeft />
        </Button>
        <h1 className="text-3xl font-extrabold tracking-tight">Trophy case</h1>
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

      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {sorted.map(id => {
          const achievement = ACHIEVEMENTS[id];
          const record = trophies[id];
          const style = RARITY_STYLE[achievement.rarity];
          const fresh = freshRef.current?.has(id);
          return (
            <li
              key={id}
              className={`relative flex flex-col items-center rounded-xl border bg-card p-3 text-center shadow-sm ${record ? "" : "opacity-80"} ${fresh ? "animate-in zoom-in-50 fade-in duration-700" : ""}`}
            >
              <div
                aria-hidden="true"
                className={`mb-2 flex h-16 w-16 items-center justify-center rounded-full text-3xl ${record ? `bg-gradient-to-br ${style.ring} shadow-md` : "bg-muted text-foreground/40"}`}
              >
                {record ? style.emoji : <Lock className="h-6 w-6" />}
              </div>
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
              {fresh && <span className="absolute right-2 top-2 rounded-full bg-[hsl(var(--brand-500))] px-1.5 py-0.5 text-[10px] font-bold text-white">New</span>}
            </li>
          );
        })}
      </ul>
    </main>
  );
}
