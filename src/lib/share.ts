import { toast } from "sonner";

export const SHARE_ORIGIN = "https://lexichain.banton-digital.com";

const GRADE_EMOJI: Record<string, string> = {
  Platinum: "💎",
  Gold: "🥇",
  Silver: "🥈",
  Bronze: "🥉",
  None: "📊",
};

// One row of squares per word (longest first), Wordle-style, so the share
// shows the shape of the run without spoiling the words.
function wordGrid(words: { word: string; score: number }[], maxRows = 8): string {
  const rows = [...words]
    .sort((a, b) => b.word.length - a.word.length || b.score - a.score)
    .slice(0, maxRows)
    .map(w => {
      const len = w.word.length;
      const square = len >= 7 ? "🟪" : len >= 5 ? "🟩" : "🟨";
      return square.repeat(len);
    });
  if (words.length > maxRows) rows.push(`…+${words.length - maxRows} more`);
  return rows.join("\n");
}

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
  if (words.length) lines.push("", wordGrid(words));
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
