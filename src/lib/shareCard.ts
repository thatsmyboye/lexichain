// Renders a shareable PNG of a finished round: the medal, the score, and
// three stats, in portrait (1080x1350) or landscape (1200x630), light or
// dark. Daily boards are the same for everyone, so a daily card shows the
// best word's length, not the word.
//
// The logo (src/assets/brand/, a copy of docs/brand/) and the medals
// (src/assets/medals/) come from the bundle. If one fails to load the card
// draws a plain wordmark or badge in its place.
import { SHARE_ORIGIN } from "@/lib/share";
import { blobToBase64, isNativeApp, requestNative, type NativeShareResult } from "@/lib/nativeApp";

export type ShareGrade = "bronze" | "silver" | "gold" | "platinum" | "none";

export interface ShareCardAssetPaths {
  logoLight?: string;
  logoDark?: string;
  medal?: (grade: ShareGrade) => string | undefined;
}

export interface ShareCardData {
  /** Header pill label, e.g. "Daily Puzzle", "Survival", "Endless". */
  modeLabel: string;
  dateLabel?: string;
  score: number;
  grade: ShareGrade;
  wordsFound: number;
  bestWord?: { word: string; score: number };
  /** Hides the best word text ("5 LETTERS" / "+312") to prevent daily spoilers. */
  isDaily?: boolean;
  /** Live mode metric shown in the 3rd stat tile (replaces Streak). */
  movesUsed?: number;
  wave?: number;
  level?: number;
  /** Optional explicit override for the 3rd stat tile (e.g. { label: "Moves", value: "12" }). */
  modeStat?: { label: string; value: string; sub?: string };
  isNewBest?: boolean;
  theme?: "dark" | "light";
  aspect?: "portrait" | "landscape";
  urlLabel?: string;
  assetPaths?: ShareCardAssetPaths;
}

export interface ShareCardNotify {
  onDownload?: (message: string) => void;
  onError?: (message: string) => void;
}

// Automatically bundle medals from src/assets/medals/*.svg and stacked logo from src/assets/brand/*.svg
const BUNDLED_MEDALS = import.meta.glob<string>("@/assets/medals/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
});

const BUNDLED_BRAND = import.meta.glob<string>("@/assets/brand/*.svg", {
  eager: true,
  import: "default",
  query: "?url",
});

function findBundledAsset(map: Record<string, string>, token: string): string | undefined {
  const lower = token.toLowerCase();
  const entry = Object.entries(map).find(([key]) => key.toLowerCase().includes(lower));
  return entry?.[1];
}

function resolveMedalUrl(grade: ShareGrade, override?: ShareCardAssetPaths["medal"]): string | undefined {
  if (override) return override(grade);
  return findBundledAsset(BUNDLED_MEDALS, grade === "none" ? "unearned" : grade);
}

function resolveLogoUrl(dark: boolean, overrides?: ShareCardAssetPaths): string | undefined {
  if (dark && overrides?.logoDark) return overrides.logoDark;
  if (!dark && overrides?.logoLight) return overrides.logoLight;
  return (
    findBundledAsset(BUNDLED_BRAND, "brand-logo-stacked-v3") ??
    findBundledAsset(BUNDLED_BRAND, "logo-stacked")
  );
}

const DISPLAY_FONT = "'Sora Display', 'Sora', system-ui, -apple-system, 'Segoe UI', sans-serif";
const DEFAULT_URL = SHARE_ORIGIN.replace(/^https:\/\//, "");

interface GradePalette {
  label: string;
  darkText: string;
  lightText: string;
  darkGlow: string;
  lightGlow: string;
}

// Verified contrast: darkText >= 7:1 on #020817, lightText >= 6.6:1 on #F8FAFC
const GRADE_META: Record<ShareGrade, GradePalette> = {
  platinum: {
    label: "PLATINUM",
    darkText: "#C084FC",
    lightText: "#6D28D9",
    darkGlow: "rgba(168, 85, 247, 0.34)",
    lightGlow: "rgba(139, 92, 246, 0.20)",
  },
  gold: {
    label: "GOLD",
    darkText: "#FACC15",
    lightText: "#854D0E",
    darkGlow: "rgba(250, 204, 21, 0.28)",
    lightGlow: "rgba(250, 204, 21, 0.24)",
  },
  silver: {
    label: "SILVER",
    darkText: "#E2E8F0",
    lightText: "#334155",
    darkGlow: "rgba(148, 163, 184, 0.26)",
    lightGlow: "rgba(125, 211, 252, 0.24)", // clean cool sheen instead of gray smudge
  },
  bronze: {
    label: "BRONZE",
    darkText: "#FDBA74",
    lightText: "#9A3412",
    darkGlow: "rgba(217, 119, 6, 0.28)",
    lightGlow: "rgba(251, 146, 60, 0.20)",
  },
  none: {
    label: "COMPLETE",
    darkText: "#A78BFA",
    lightText: "#5B21B6",
    darkGlow: "rgba(121, 39, 236, 0.26)",
    lightGlow: "rgba(139, 92, 246, 0.16)",
  },
};

function loadImage(src: string | undefined): Promise<HTMLImageElement | null> {
  if (!src) return Promise.resolve(null);
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.decoding = "async";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function traceChamferRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  cut: number,
) {
  const c = Math.min(cut, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + c, y);
  ctx.lineTo(x + w - c, y);
  ctx.lineTo(x + w, y + c);
  ctx.lineTo(x + w, y + h - c);
  ctx.lineTo(x + w - c, y + h);
  ctx.lineTo(x + c, y + h);
  ctx.lineTo(x, y + h - c);
  ctx.lineTo(x, y + c);
  ctx.closePath();
}

/**
 * Measures real rendered glyph width so long or wide-letter words never overflow a stat tile.
 */
function fitText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  startPx: number,
  minPx: number,
  weight = 800,
): { text: string; fontPx: number } {
  let px = startPx;
  while (px > minPx) {
    ctx.font = `${weight} ${px}px ${DISPLAY_FONT}`;
    if (ctx.measureText(text).width <= maxWidth) return { text, fontPx: px };
    px -= 2;
  }

  ctx.font = `${weight} ${minPx}px ${DISPLAY_FONT}`;
  if (ctx.measureText(text).width <= maxWidth) return { text, fontPx: minPx };

  let trimmed = text;
  while (trimmed.length > 1 && ctx.measureText(`${trimmed}…`).width > maxWidth) {
    trimmed = trimmed.slice(0, -1);
  }
  return { text: `${trimmed}…`, fontPx: minPx };
}

function drawFallbackWordmark(
  ctx: CanvasRenderingContext2D,
  cx: number,
  y: number,
  fg: string,
  accent: string,
) {
  ctx.save();
  ctx.font = `800 44px ${DISPLAY_FONT}`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillStyle = fg;
  ctx.fillText("LEXICHAIN", cx, y);
  ctx.fillStyle = accent;
  ctx.fillRect(cx - 56, y + 28, 112, 4);
  ctx.restore();
}

function drawFallbackMedal(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  accent: string,
  dark: boolean,
) {
  ctx.save();
  ctx.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (Math.PI / 4) * i - Math.PI / 8;
    const px = cx + Math.cos(a) * radius;
    const py = cy + Math.sin(a) * radius;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = dark ? "#1E293B" : "#F1F5F9";
  ctx.fill();
  ctx.lineWidth = 8;
  ctx.strokeStyle = accent;
  ctx.stroke();

  ctx.beginPath();
  const rOut = radius * 0.48;
  const rIn = rOut * 0.313;
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? rOut : rIn;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    const px = cx + Math.cos(a) * r;
    const py = cy + Math.sin(a) * r;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
  ctx.fillStyle = accent;
  ctx.fill();
  ctx.restore();
}

function resolveThirdStat(data: ShareCardData): { label: string; value: string; sub?: string } {
  if (data.modeStat) return data.modeStat;
  if (data.wave !== undefined) return { label: "Wave", value: String(data.wave) };
  if (data.level !== undefined) return { label: "Level", value: String(data.level) };
  if (data.movesUsed !== undefined) return { label: "Moves", value: String(data.movesUsed) };
  return { label: "Grade", value: GRADE_META[data.grade].label };
}

function resolveBestWordStat(data: ShareCardData): { value: string; sub?: string } {
  if (!data.bestWord) return { value: "—" };
  const pts = `+${data.bestWord.score.toLocaleString()}`;
  if (data.isDaily) {
    const len = data.bestWord.word.length;
    return { value: `${len} ${len === 1 ? "LETTER" : "LETTERS"}`, sub: pts };
  }
  return { value: data.bestWord.word.toUpperCase(), sub: pts };
}

function drawStatTile(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  label: string,
  value: string,
  sub: string | undefined,
  palette: { card: string; border: string; fg: string; muted: string; accent: string },
) {
  ctx.save();
  traceChamferRect(ctx, x, y, w, h, 14);
  ctx.fillStyle = palette.card;
  ctx.fill();
  ctx.lineWidth = 2;
  ctx.strokeStyle = palette.border;
  ctx.stroke();

  const cx = x + w / 2;
  const maxTextW = w - 28;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";

  ctx.font = `700 19px ${DISPLAY_FONT}`;
  ctx.fillStyle = palette.muted;
  ctx.fillText(label.toUpperCase(), cx, y + 34);

  const valueY = sub ? y + h * 0.54 : y + h * 0.62;
  const fitted = fitText(ctx, value, maxTextW, 44, 18, 800);
  ctx.font = `800 ${fitted.fontPx}px ${DISPLAY_FONT}`;
  ctx.fillStyle = palette.fg;
  ctx.fillText(fitted.text, cx, valueY);

  if (sub) {
    const subFitted = fitText(ctx, sub, maxTextW, 20, 14, 700);
    ctx.font = `700 ${subFitted.fontPx}px ${DISPLAY_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.fillText(subFitted.text, cx, y + h - 26);
  }
  ctx.restore();
}

/**
 * Render a dynamic results share card as a PNG Blob.
 */
export async function renderShareCard(data: ShareCardData): Promise<Blob> {
  if (typeof document !== "undefined" && document.fonts) {
    await Promise.allSettled([
      document.fonts.load('700 24px "Sora Display"'),
      document.fonts.load('800 48px "Sora Display"'),
      document.fonts.ready,
    ]);
  }

  const theme = data.theme ?? "dark";
  const dark = theme === "dark";
  const aspect = data.aspect ?? "portrait";
  const W = aspect === "portrait" ? 1080 : 1200;
  const H = aspect === "portrait" ? 1350 : 630;

  const gradeMeta = GRADE_META[data.grade];
  const gradeColor = dark ? gradeMeta.darkText : gradeMeta.lightText;
  const gradeGlow = dark ? gradeMeta.darkGlow : gradeMeta.lightGlow;

  const palette = dark
    ? {
        bg: "#020817",
        card: "#0F172A",
        border: "#1E293B",
        fg: "#F8FAFC",
        muted: "#94A3B8",
        accent: "#C4B5FD",
      }
    : {
        bg: "#F8FAFC",
        card: "#FFFFFF",
        border: "#CBD5E1",
        fg: "#0F172A",
        muted: "#475569",
        accent: "#6D28D9",
      };

  const [logoImg, medalImg] = await Promise.all([
    loadImage(resolveLogoUrl(dark, data.assetPaths)),
    loadImage(resolveMedalUrl(data.grade, data.assetPaths?.medal)),
  ]);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");

  // 1. Background + rarity radial glow
  ctx.fillStyle = palette.bg;
  ctx.fillRect(0, 0, W, H);

  const glowX = aspect === "portrait" ? W * 0.5 : W * 0.22;
  const glowY = aspect === "portrait" ? H * 0.37 : H * 0.52;
  const glowR = aspect === "portrait" ? 470 : 340;
  const aura = ctx.createRadialGradient(glowX, glowY, 24, glowX, glowY, glowR);
  aura.addColorStop(0, gradeGlow);
  aura.addColorStop(1, "rgba(0, 0, 0, 0)");
  ctx.fillStyle = aura;
  ctx.fillRect(0, 0, W, H);

  // Outer architectural frame
  traceChamferRect(ctx, 28, 28, W - 56, H - 56, 26);
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = dark ? "rgba(148, 163, 184, 0.24)" : "rgba(15, 23, 42, 0.14)";
  ctx.stroke();

  const headerPill = data.dateLabel ? `${data.modeLabel}  ·  ${data.dateLabel}` : data.modeLabel;
  const bestWordStat = resolveBestWordStat(data);
  const thirdStat = resolveThirdStat(data);
  const gradeLine = data.isNewBest ? `${gradeMeta.label}  ·  NEW BEST` : gradeMeta.label;
  const urlLabel = data.urlLabel ?? DEFAULT_URL;

  if (aspect === "portrait") {
    // --- PORTRAIT (1080 x 1350) ---
    if (logoImg) {
      const targetW = 360;
      const targetH = Math.round(targetW * (logoImg.naturalHeight / Math.max(1, logoImg.naturalWidth)));
      ctx.drawImage(logoImg, (W - targetW) / 2, 84, targetW, targetH);
    } else {
      drawFallbackWordmark(ctx, W / 2, 134, palette.fg, "#7927EC");
    }

    // Mode + date pill
    const pillFit = fitText(ctx, headerPill.toUpperCase(), W - 200, 23, 16, 700);
    ctx.font = `700 ${pillFit.fontPx}px ${DISPLAY_FONT}`;
    const pillW = Math.min(W - 140, Math.max(300, ctx.measureText(pillFit.text).width + 64));
    traceChamferRect(ctx, (W - pillW) / 2, 232, pillW, 54, 12);
    ctx.fillStyle = dark ? "#1E1B4B" : "#EDE9FE";
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = "#7927EC";
    ctx.stroke();
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = dark ? "#EDE9FE" : "#5B12C6";
    ctx.fillText(pillFit.text, W / 2, 260);

    // Hero D1 medal (350px)
    const medalSz = 350;
    const medalX = (W - medalSz) / 2;
    const medalY = 326;
    if (medalImg) {
      ctx.drawImage(medalImg, medalX, medalY, medalSz, medalSz);
    } else {
      drawFallbackMedal(ctx, W / 2, medalY + medalSz / 2, 148, gradeColor, dark);
    }

    // Grade label + Hero score
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `800 28px ${DISPLAY_FONT}`;
    ctx.fillStyle = gradeColor;
    ctx.fillText(gradeLine, W / 2, 726);

    const scoreFit = fitText(ctx, data.score.toLocaleString(), W - 160, 132, 72, 800);
    ctx.font = `800 ${scoreFit.fontPx}px ${DISPLAY_FONT}`;
    ctx.fillStyle = palette.fg;
    ctx.fillText(scoreFit.text, W / 2, 826);

    ctx.font = `700 22px ${DISPLAY_FONT}`;
    ctx.fillStyle = palette.muted;
    ctx.fillText("POINTS", W / 2, 904);

    // 3 chamfered stat tiles: Words | Best Word | Moves/Wave/Level
    const statY = 980;
    const statH = 172;
    const statGap = 22;
    const marginX = 68;
    const statW = (W - marginX * 2 - statGap * 2) / 3;

    drawStatTile(ctx, marginX, statY, statW, statH, "Words", data.wordsFound.toLocaleString(), undefined, palette);
    drawStatTile(ctx, marginX + statW + statGap, statY, statW, statH, "Best Word", bestWordStat.value, bestWordStat.sub, palette);
    drawStatTile(ctx, marginX + (statW + statGap) * 2, statY, statW, statH, thirdStat.label, thirdStat.value, thirdStat.sub, palette);

    // Footer domain
    ctx.font = `700 24px ${DISPLAY_FONT}`;
    ctx.fillStyle = palette.muted;
    ctx.textAlign = "center";
    ctx.fillText(urlLabel, W / 2, 1244);
  } else {
    // --- LANDSCAPE (1200 x 630) ---
    if (logoImg) {
      const targetW = 276;
      const targetH = Math.round(targetW * (logoImg.naturalHeight / Math.max(1, logoImg.naturalWidth)));
      ctx.drawImage(logoImg, 68, 56, targetW, targetH);
    } else {
      drawFallbackWordmark(ctx, 206, 94, palette.fg, "#7927EC");
    }

    const medalSz = 286;
    const medalX = 96;
    const medalY = 186;
    if (medalImg) {
      ctx.drawImage(medalImg, medalX, medalY, medalSz, medalSz);
    } else {
      drawFallbackMedal(ctx, medalX + medalSz / 2, medalY + medalSz / 2, 124, gradeColor, dark);
    }

    const colX = 436;
    const colW = W - colX - 68; // 696px

    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    const pillFit = fitText(ctx, headerPill.toUpperCase(), colW, 20, 15, 700);
    ctx.font = `700 ${pillFit.fontPx}px ${DISPLAY_FONT}`;
    ctx.fillStyle = palette.accent;
    ctx.fillText(pillFit.text, colX, 98);

    ctx.font = `800 23px ${DISPLAY_FONT}`;
    ctx.fillStyle = gradeColor;
    ctx.fillText(gradeLine, colX, 144);

    const scoreFit = fitText(ctx, data.score.toLocaleString(), colW, 112, 68, 800);
    ctx.font = `800 ${scoreFit.fontPx}px ${DISPLAY_FONT}`;
    ctx.fillStyle = palette.fg;
    ctx.fillText(scoreFit.text, colX, 238);

    const statY = 334;
    const statH = 160;
    const statGap = 18;
    const statW = (colW - statGap * 2) / 3; // 220px each

    drawStatTile(ctx, colX, statY, statW, statH, "Words", data.wordsFound.toLocaleString(), undefined, palette);
    drawStatTile(ctx, colX + statW + statGap, statY, statW, statH, "Best Word", bestWordStat.value, bestWordStat.sub, palette);
    drawStatTile(ctx, colX + (statW + statGap) * 2, statY, statW, statH, thirdStat.label, thirdStat.value, thirdStat.sub, palette);

    ctx.textAlign = "left";
    ctx.font = `700 21px ${DISPLAY_FONT}`;
    ctx.fillStyle = palette.muted;
    ctx.fillText(urlLabel, colX, 554);
  }

  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("Failed to encode share card PNG"));
    }, "image/png");
  });
}

/**
 * Primary share entrypoint matching the game's shareCardImage export.
 * Uses native OS file sharing when available, falls back to PNG download with toast
 * feedback, and catches render errors cleanly instead of throwing.
 */
export async function shareCardImage(
  data: ShareCardData,
  options?: { title?: string; text?: string; filename?: string; notify?: ShareCardNotify },
): Promise<"shared" | "downloaded" | "cancelled" | "error"> {
  try {
    const blob = await renderShareCard(data);
    const filename = options?.filename ?? `lexichain-${data.score}.png`;
    const file = new File([blob], filename, { type: "image/png" });
    const title = options?.title ?? "Lexichain Result";
    const text = options?.text ?? `I scored ${data.score.toLocaleString()} points in Lexichain!`;

    // In the mobile app the system share sheet takes the image (it can also
    // save it to Photos/Files). A WebView cannot download files.
    if (isNativeApp()) {
      const base64 = await blobToBase64(blob);
      const result = await requestNative<NativeShareResult>({ type: "shareImage", base64, filename, title, text });
      if (result === "error") {
        options?.notify?.onError?.("Could not share the result card. Try again.");
        return "error";
      }
      return result === "cancelled" ? "cancelled" : "shared";
    }

    if (typeof navigator !== "undefined" && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title, text });
        return "shared";
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") {
          return "cancelled";
        }
      }
    }

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    options?.notify?.onDownload?.("Result card saved as PNG");
    return "downloaded";
  } catch {
    options?.notify?.onError?.("Could not create result card. Try again.");
    return "error";
  }
}
