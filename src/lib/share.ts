import { toast } from "sonner";

export const SHARE_ORIGIN = "https://lexichain.banton-digital.com";

const GRADE_EMOJI: Record<string, string> = {
  Platinum: "💎",
  Gold: "🥇",
  Silver: "🥈",
  Bronze: "🥉",
  None: "📊",
};

export function buildShareText(params: {
  modeLabel: string;
  score: number;
  grade: string;
  words: { word: string; score: number }[];
  extra?: string;
}): string {
  const { modeLabel, score, grade, words, extra } = params;
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const top = words.length ? Math.max(...words.map(w => w.score)) : 0;
  const lines = [
    `🔤 Lexichain ${modeLabel} · ${date}`,
    `${GRADE_EMOJI[grade] ?? "📊"} ${score.toLocaleString()} pts${grade !== "None" ? ` (${grade})` : ""} · ${words.length} word${words.length === 1 ? "" : "s"} · best ${top}`,
  ];
  if (extra) lines.push(extra);
  lines.push("", SHARE_ORIGIN);
  return lines.join("\n");
}

export async function shareText(title: string, text: string): Promise<void> {
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (err) {
      // User cancelled the share sheet: nothing to do.
      if (err instanceof DOMException && err.name === "AbortError") return;
      // Otherwise fall through to the clipboard.
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast.success("Result copied to clipboard");
  } catch {
    toast.error("Couldn't share or copy your result");
  }
}
