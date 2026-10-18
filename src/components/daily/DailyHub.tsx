import { useId } from "react";
import type { User } from "@supabase/supabase-js";
import { CalendarDays, Clock, Flame, Grid3x3, Users } from "lucide-react";
import { SoundButton } from "@/components/effects/SoundSystem";
import type { LoginStreakData } from "@/hooks/useLoginStreak";
import { DAILY_MODE_NAMES, type DailyGameMode } from "@/lib/gameModes";
import { cn } from "@/lib/utils";
import { DailyStatusBadge } from "./DailyStatusBadge";
import { GRADE_MEDALS } from "./medals";
import { DAILY_MOVES_LIMIT, useDailyStatus } from "./useDailyStatus";
import { formatCountdown, shiftDateString, useDailyCountdown } from "./useDailyCountdown";
import { useDailyCommunity } from "./useDailyCommunity";

const numberFormat = new Intl.NumberFormat();
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function weekdayOf(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return WEEKDAYS[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
}

function daysBetween(from: string, to: string): number {
  const toUtc = (s: string) => {
    const [y, m, d] = s.split("-").map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((toUtc(to) - toUtc(from)) / 86_400_000);
}

interface DailyRowProps {
  mode: DailyGameMode;
  sizeLabel: string;
  onPlay?: (mode: DailyGameMode) => void;
}

function DailyRow({ mode, sizeLabel, onPlay }: DailyRowProps) {
  const status = useDailyStatus(mode);
  const name = DAILY_MODE_NAMES[mode];
  const headingId = useId();
  const Icon = mode === "daily" ? CalendarDays : Grid3x3;
  const action = status.state === "done" ? "See results" : status.state === "in_progress" ? "Resume" : "Play";

  return (
    <li className="flex min-w-0 flex-col gap-2 rounded-lg border bg-background/70 p-2.5">
      <div className="flex flex-wrap items-center justify-between gap-1.5">
        <h3 id={headingId} className="flex items-center gap-1.5 text-sm font-bold leading-tight">
          <Icon aria-hidden="true" className="h-4 w-4 shrink-0 text-[hsl(var(--brand-500))]" />
          {name}
          <span className="sr-only">, {sizeLabel} board</span>
        </h3>
        <DailyStatusBadge status={status} />
      </div>

      {status.state === "not_started" ? (
        <p className="text-xs text-muted-foreground">{sizeLabel} board · {DAILY_MOVES_LIMIT} moves</p>
      ) : (
        <dl className="flex flex-wrap gap-x-3 gap-y-0.5 text-xs">
          {status.state === "done" && status.grade && (
            <div className="flex items-baseline gap-1">
              <dt className="sr-only">Medal</dt>
              <dd className="font-semibold">
                <span aria-hidden="true">{GRADE_MEDALS[status.grade].emoji} </span>
                {GRADE_MEDALS[status.grade].label}
              </dd>
            </div>
          )}
          <div className="flex items-baseline gap-1">
            <dt className="text-muted-foreground">Score</dt>
            <dd className="font-semibold tabular-nums">{numberFormat.format(status.score)}</dd>
          </div>
          {status.state === "in_progress" && (
            <div className="flex items-baseline gap-1">
              <dt className="text-muted-foreground">Moves</dt>
              <dd className="font-semibold tabular-nums">
                {status.movesUsed}/{status.movesLimit}
              </dd>
            </div>
          )}
        </dl>
      )}

      <SoundButton
        size="sm"
        variant={status.state === "done" ? "outline" : "hero"}
        onClick={() => onPlay?.(mode)}
        className="mt-auto min-h-[44px] w-full font-semibold"
        aria-label={`${action}: ${name}`}
      >
        {action}
      </SoundButton>
    </li>
  );
}

interface StreakCalendarProps {
  streak: LoginStreakData;
  today: string;
}

// Exact for the current streak: the run of days ending at lastLoginDate.
// Days before it are only known to be outside the streak.
function StreakCalendar({ streak, today }: StreakCalendarProps) {
  const days = Array.from({ length: 7 }, (_, i) => shiftDateString(today, i - 6));
  const inStreak = (day: string) => {
    const back = daysBetween(day, streak.lastLoginDate);
    return back >= 0 && back < streak.currentStreak;
  };

  return (
    <ol aria-label="Last 7 days" className="flex items-end gap-1">
      {days.map(day => {
        const lit = inStreak(day);
        const isToday = day === today;
        return (
          <li key={day} className="flex w-6 flex-col items-center gap-0.5">
            <span
              aria-hidden="true"
              className={cn(
                "flex h-5 w-5 items-center justify-center rounded-full border",
                lit ? "border-orange-500 bg-orange-500 text-white dark:border-orange-400 dark:bg-orange-400 dark:text-orange-950" : "border-border bg-background",
                isToday && "ring-2 ring-[hsl(var(--brand-500))] ring-offset-1 ring-offset-card"
              )}
            >
              {lit && <Flame className="h-3 w-3" />}
            </span>
            <span aria-hidden="true" className={cn("text-[10px] leading-3 text-muted-foreground", isToday && "font-bold text-foreground")}>
              {weekdayOf(day).charAt(0)}
            </span>
            <span className="sr-only">
              {isToday ? "Today" : weekdayOf(day)}: {lit ? "in streak" : "not in streak"}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

interface DailyHubProps {
  user?: User | null;
  streakData?: LoginStreakData | null;
  onPlayDaily?: (mode: DailyGameMode) => void;
  onSignInClick?: () => void;
  className?: string;
}

export function DailyHub({ user, streakData, onPlayDaily, onSignInClick, className }: DailyHubProps) {
  const titleId = useId();
  // Ticks every second, so `today` rolls over at midnight ET along with the countdown
  const { nextAt, msLeft, today } = useDailyCountdown();
  const community = useDailyCommunity(user, today);
  const nextAtLabel = nextAt.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const todayLabel = (() => {
    const [y, m, d] = today.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
  })();

  return (
    <section
      aria-labelledby={titleId}
      className={cn("w-full rounded-2xl border bg-card/90 p-3 text-left text-card-foreground shadow-lg backdrop-blur-sm sm:p-4", className)}
    >
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
        <h2 id={titleId} className="text-base font-bold sm:text-lg">
          Today's puzzles <span className="text-sm font-medium text-muted-foreground">· {todayLabel}</span>
        </h2>
        <p className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock aria-hidden="true" className="h-3.5 w-3.5" />
          <span aria-hidden="true">New in</span>
          <span aria-live="off" aria-hidden="true" className="font-semibold tabular-nums text-foreground">
            {formatCountdown(msLeft)}
          </span>
          <span className="sr-only">{`Next puzzle at ${nextAtLabel}`}</span>
        </p>
      </div>

      <ul className="grid grid-cols-1 gap-2 min-[360px]:grid-cols-2">
        <DailyRow mode="daily" sizeLabel="4×4" onPlay={onPlayDaily} />
        <DailyRow mode="daily_5x5" sizeLabel="5×5" onPlay={onPlayDaily} />
      </ul>

      {user && streakData ? (
        <div className="mt-3 flex flex-wrap items-center justify-between gap-x-3 gap-y-2 border-t pt-3">
          <dl className="min-w-0">
            <div className="flex items-center gap-1.5">
              <dt className="sr-only">Login streak</dt>
              <Flame aria-hidden="true" className="h-5 w-5 shrink-0 text-orange-500 dark:text-orange-400" />
              <dd className="text-sm font-bold">
                {streakData.currentStreak} day streak
              </dd>
            </div>
            <div className="flex items-baseline gap-1 text-xs text-muted-foreground">
              <dt>Total logins</dt>
              <dd className="font-semibold tabular-nums text-foreground">{numberFormat.format(streakData.totalLogins)}</dd>
            </div>
          </dl>
          <StreakCalendar streak={streakData} today={today} />
        </div>
      ) : !user && onSignInClick ? (
        <div className="mt-3 border-t pt-2">
          <SoundButton
            variant="ghost"
            onClick={onSignInClick}
            className="h-auto min-h-11 w-full justify-start whitespace-normal px-2 text-left text-xs font-normal text-muted-foreground"
          >
            <span>
              <span className="font-semibold text-foreground underline underline-offset-4">Sign in</span> to keep a streak and see how you rank.
            </span>
          </SoundButton>
        </div>
      ) : null}

      {community && (
        <p className="mt-2 flex flex-wrap items-center gap-x-1.5 text-xs text-muted-foreground">
          <Users aria-hidden="true" className="h-3.5 w-3.5 shrink-0" />
          <span>
            <span className="font-semibold text-foreground">
              {numberFormat.format(community.players)}
              {community.truncated ? "+" : ""}
            </span>{" "}
            {community.players === 1 && !community.truncated ? "player" : "players"} finished today's Daily
          </span>
          {community.percentile !== null ? (
            <span>
              · You beat <span className="font-semibold text-foreground">{community.percentile}%</span>
            </span>
          ) : community.rank !== null ? (
            <span>
              · You're <span className="font-semibold text-foreground">#{community.rank}</span>
            </span>
          ) : null}
        </p>
      )}
    </section>
  );
}

export default DailyHub;
