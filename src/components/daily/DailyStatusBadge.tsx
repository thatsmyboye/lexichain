import { CheckCircle2, CircleDashed, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyStatus } from "./useDailyStatus";

const LABELS: Record<DailyStatus["state"], string> = {
  not_started: "Not started",
  in_progress: "In progress",
  done: "Done",
};

interface DailyStatusBadgeProps {
  status: DailyStatus;
  className?: string;
}

// Text stays foreground-colored for contrast; the icon carries the status color.
export function DailyStatusBadge({ status, className }: DailyStatusBadgeProps) {
  const Icon = status.state === "done" ? CheckCircle2 : status.state === "in_progress" ? PlayCircle : CircleDashed;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4 text-foreground",
        status.state === "done" && "border-[hsl(var(--ok)/0.45)] bg-[hsl(var(--ok)/0.1)]",
        status.state === "in_progress" && "border-[hsl(var(--warn)/0.5)] bg-[hsl(var(--warn)/0.1)]",
        status.state === "not_started" && "border-border bg-background/70",
        className
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn(
          "h-3.5 w-3.5",
          status.state === "done" && "text-[hsl(var(--ok))]",
          status.state === "in_progress" && "text-[hsl(var(--warn))]",
          status.state === "not_started" && "text-muted-foreground"
        )}
      />
      {LABELS[status.state]}
    </span>
  );
}

export default DailyStatusBadge;
