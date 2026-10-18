// Renders a shareable PNG of a finished round: the board where the best word
// was played with its path traced, plus grade and score. Daily boards hide
// the letters so the card doesn't spoil the puzzle.
import { toast } from "sonner";
import { SHARE_ORIGIN } from "@/lib/share";

export interface ShareCardData {
  modeLabel: string;
  score: number;
  grade: string;
  wordCount: number;
  best: { word: string; score: number; path: { r: number; c: number }[]; board: string[][] } | null;
  spoilerFree: boolean;
  extra?: string;
}

const MEDAL: Record<string, string> = { Platinum: "💎", Gold: "🥇", Silver: "🥈", Bronze: "🥉" };
const W = 1080;
const H = 1350;
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif';

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");

  // Background
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, "#a78bfa");
  bg.addColorStop(0.45, "#7c3aed");
  bg.addColorStop(1, "#3b0764");
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "alphabetic";
  ctx.font = `900 96px ${FONT}`;
  ctx.fillText("Lexichain", W / 2, 140);
  const date = new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  ctx.font = `600 40px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.85)";
  ctx.fillText(`${data.modeLabel} · ${date}`, W / 2, 200);

  // Board
  const board = data.best?.board;
  const boardTop = 250;
  const boardSize = 680;
  const boardLeft = (W - boardSize) / 2;
  ctx.fillStyle = "rgba(255,255,255,0.14)";
  roundRect(ctx, boardLeft - 24, boardTop - 24, boardSize + 48, boardSize + 48, 36);
  ctx.fill();
  if (board) {
    const n = board.length;
    const gap = 16;
    const cell = (boardSize - gap * (n - 1)) / n;
    const inPath = new Map(data.best!.path.map((p, i) => [`${p.r},${p.c}`, i]));
    for (let r = 0; r < n; r++) {
      for (let c = 0; c < n; c++) {
        const x = boardLeft + c * (cell + gap);
        const y = boardTop + r * (cell + gap);
        const selected = inPath.has(`${r},${c}`);
        ctx.fillStyle = selected ? "#fbbf24" : "#ffffff";
        roundRect(ctx, x, y, cell, cell, 22);
        ctx.fill();
        if (!data.spoilerFree) {
          ctx.fillStyle = selected ? "#451a03" : "#4c1d95";
          ctx.font = `800 ${Math.round(cell * 0.5)}px ${FONT}`;
          ctx.textBaseline = "middle";
          ctx.fillText(board[r][c], x + cell / 2, y + cell / 2 + 4);
          ctx.textBaseline = "alphabetic";
        }
      }
    }
    // Path line
    const pts = data.best!.path.map(p => [boardLeft + p.c * (cell + gap) + cell / 2, boardTop + p.r * (cell + gap) + cell / 2]);
    if (pts.length > 1) {
      ctx.strokeStyle = "rgba(124,45,18,0.55)";
      ctx.lineWidth = cell * 0.14;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      ctx.beginPath();
      pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.stroke();
    }
  } else {
    ctx.fillStyle = "rgba(255,255,255,0.8)";
    ctx.font = `700 120px ${FONT}`;
    ctx.fillText("🔤", W / 2, boardTop + boardSize / 2 + 40);
  }

  // Score block
  const scoreY = boardTop + boardSize + 140;
  ctx.fillStyle = "#ffffff";
  ctx.font = `900 120px ${FONT}`;
  const medal = MEDAL[data.grade];
  ctx.fillText(`${medal ? medal + " " : ""}${data.score.toLocaleString()}`, W / 2, scoreY);
  ctx.font = `600 40px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.9)";
  const gradeText = medal ? `${data.grade} · ` : "";
  ctx.fillText(`${gradeText}${data.wordCount} word${data.wordCount === 1 ? "" : "s"}${data.extra ? ` · ${data.extra}` : ""}`, W / 2, scoreY + 60);
  if (data.best) {
    ctx.fillText(
      data.spoilerFree ? `Best word: ${data.best.word.length} letters, +${data.best.score}` : `Best word: ${data.best.word.toUpperCase()} +${data.best.score}`,
      W / 2,
      scoreY + 115
    );
  }

  ctx.font = `500 34px ${FONT}`;
  ctx.fillStyle = "rgba(255,255,255,0.75)";
  ctx.fillText(SHARE_ORIGIN.replace(/^https:\/\//, ""), W / 2, H - 50);

  return new Promise((resolve, reject) => canvas.toBlob(b => (b ? resolve(b) : reject(new Error("Could not render image"))), "image/png"));
}

export async function shareCardImage(data: ShareCardData, text: string): Promise<void> {
  let blob: Blob;
  try {
    blob = await renderShareCard(data);
  } catch {
    toast.error("Couldn't create the share image");
    return;
  }
  const file = new File([blob], "lexichain-result.png", { type: "image/png" });
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text, title: "Lexichain" });
      return;
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
    }
  }
  // Fallback: download the image
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "lexichain-result.png";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast.success("Share image downloaded");
}
