import type { FinalGrade } from "@/types/game";

// Same medal emoji as the results dialog, so the hub and end screen agree
export const GRADE_MEDALS: Record<FinalGrade, { emoji: string; label: string }> = {
  Platinum: { emoji: "💎", label: "Platinum" },
  Gold: { emoji: "🥇", label: "Gold" },
  Silver: { emoji: "🥈", label: "Silver" },
  Bronze: { emoji: "🥉", label: "Bronze" },
  None: { emoji: "🔤", label: "No medal" },
};
