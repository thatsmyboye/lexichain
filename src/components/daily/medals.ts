import type { FinalGrade } from "@/types/game";

// Same names as the results dialog, so the hub and end screen agree
export const GRADE_LABELS: Record<FinalGrade, string> = {
  Platinum: "Platinum",
  Gold: "Gold",
  Silver: "Silver",
  Bronze: "Bronze",
  None: "No medal",
};
