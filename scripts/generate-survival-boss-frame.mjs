#!/usr/bin/env node
/**
 * Generates the frame drawn around the board during a Survival boss wave into
 * public/assets/survival/: boss-frame-light.webp and boss-frame-dark.webp.
 * The output is committed; this script is not part of the build. Re-run it
 * after changing the drawing below:
 *
 *   node scripts/generate-survival-boss-frame.mjs        write the 2 files
 *   node scripts/generate-survival-boss-frame.mjs --qa   also write a preview to .tmp/
 *
 * The images are 9-slice frames like the skins' tray frames: 512px, sliced at
 * 64px and drawn at half size. The rail fills source pixels 2 to 18, which is
 * 8 CSS px, and its inner corner radius of 40 matches .board-frame's 20px.
 * .boss-wave-frame in src/index.css places it 5px outside the board wrapper,
 * whose own padding is 4px, so the rail ends exactly where the skin's frame
 * begins and the board does not move when a boss wave starts.
 *
 * The script exits non-zero if a file reaches 20 KB or if any pixel inside
 * the rail is not fully transparent.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

sharp.cache(false);

const OUT_DIR = path.resolve("public/assets/survival");
const QA_PATH = path.resolve(".tmp/qa-boss-frame.png");
const QA_MODE = process.argv.includes("--qa");
const MAX_BYTES = 20 * 1024;

function makeBossFrameSvg(theme) {
  const t = theme === "light"
    ? {
        ironOuter: "#180804",
        ironInner: "#291007",
        coreA: "#FEF08A",
        coreB: "#F97316",
        coreC: "#EA580C",
        hi: "#FFFBEB",
        hiOpacity: 0.92,
        studFill: "#FEF08A",
        studStroke: "#180804",
      }
    : {
        ironOuter: "#140704",
        ironInner: "#240B05",
        coreA: "#FEF9C3",
        coreB: "#FB923C",
        coreC: "#F97316",
        hi: "#FFFFFF",
        hiOpacity: 0.95,
        studFill: "#FEF9C3",
        studStroke: "#140704",
      };

  // Geometry (512x512 @ 0.5x -> CSS px):
  //   Outer housing: x=2..510, rx=56 (28px CSS) -> tangent at 58 (< 64 slice)
  //   Inner cavity:  x=18..494, rx=40 (20px CSS matching .board-frame) -> tangent at 58 (< 64 slice)
  //   Molten core:   x=5..507, rx=53 to x=15..497, rx=43 (5px CSS glowing ember band)
  //   Dark iron outer (2..5) & inner (15..18) edges separate cleanly on white, dark, and Lunar red/gold.
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="boss-core" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="512" y2="512">
      <stop offset="0%" stop-color="${t.coreA}"/>
      <stop offset="50%" stop-color="${t.coreB}"/>
      <stop offset="100%" stop-color="${t.coreC}"/>
    </linearGradient>
  </defs>

  <!-- Forged dark-iron structural housing (exact ring [2..18]) -->
  <path fill-rule="evenodd" fill="${t.ironOuter}" d="
    M58 2 H454 A56 56 0 0 1 510 58 V454 A56 56 0 0 1 454 510 H58 A56 56 0 0 1 2 454 V58 A56 56 0 0 1 58 2 Z
    M58 18 H454 A40 40 0 0 1 494 58 V454 A40 40 0 0 1 454 494 H58 A40 40 0 0 1 18 454 V58 A40 40 0 0 1 58 18 Z
  "/>

  <!-- Incandescent amber-orange molten core recessed inside the dark-iron channels -->
  <path fill-rule="evenodd" fill="url(#boss-core)" d="
    M58 5 H454 A53 53 0 0 1 507 58 V454 A53 53 0 0 1 454 507 H58 A53 53 0 0 1 5 454 V58 A53 53 0 0 1 58 5 Z
    M58 15 H454 A43 43 0 0 1 497 58 V454 A43 43 0 0 1 454 497 H58 A43 43 0 0 1 15 454 V58 A43 43 0 0 1 58 15 Z
  "/>

  <!-- Crisp bright bevel catch along the top-left molten rail -->
  <path d="M58 7 H452 M7 58 V452" fill="none" stroke="${t.hi}" stroke-width="2" stroke-opacity="${t.hiOpacity}"/>

  <!-- Inner iron rim definition -->
  <rect x="16.5" y="16.5" width="479" height="479" rx="41.5" fill="none" stroke="${t.ironInner}" stroke-width="2"/>

  <!-- 4 armored corner studs centered on the 45° rail arc (24,24 etc.; strictly outside inner cavity) -->
  <g stroke-linejoin="bevel">
    <!-- Top-Left -->
    <polygon points="24,14 33,23 24,32 15,23" fill="${t.ironOuter}"/>
    <polygon points="24,17 30,23 24,29 18,23" fill="${t.studFill}" stroke="${t.studStroke}" stroke-width="1.4"/>
    <!-- Top-Right -->
    <polygon points="488,14 497,23 488,32 479,23" fill="${t.ironOuter}"/>
    <polygon points="488,17 494,23 488,29 482,23" fill="${t.studFill}" stroke="${t.studStroke}" stroke-width="1.4"/>
    <!-- Bottom-Left -->
    <polygon points="24,480 33,489 24,498 15,489" fill="${t.ironOuter}"/>
    <polygon points="24,483 30,489 24,495 18,489" fill="${t.studFill}" stroke="${t.studStroke}" stroke-width="1.4"/>
    <!-- Bottom-Right -->
    <polygon points="488,480 497,489 488,498 479,489" fill="${t.ironOuter}"/>
    <polygon points="488,483 494,489 488,495 482,489" fill="${t.studFill}" stroke="${t.studStroke}" stroke-width="1.4"/>
  </g>
</svg>`;
}

// Verify alpha === 0 both in the [64..448] slice interior and inside the inner rounded board cavity (1px anti-alias margin)
async function verifyBoardClearance(filePath) {
  const buf = await fs.readFile(filePath);
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
  let maxSliceInteriorA = 0;
  let maxBoardCavityA = 0;

  const lo = 20;
  const hi = 492;
  const r = 38; // inner cavity minus 2px rasterization margin

  for (let y = lo; y < hi; y++) {
    for (let x = lo; x < hi; x++) {
      // Check rounded-rect membership
      const cx = x < lo + r ? lo + r : x > hi - r ? hi - r : x;
      const cy = y < lo + r ? lo + r : y > hi - r ? hi - r : y;
      if (Math.hypot(x - cx, y - cy) > r) continue;

      const a = data[(y * w + x) * 4 + 3];
      if (a > maxBoardCavityA) maxBoardCavityA = a;
      if (x >= 64 && x < 448 && y >= 64 && y < 448 && a > maxSliceInteriorA) {
        maxSliceInteriorA = a;
      }
    }
  }
  return { maxSliceInteriorA, maxBoardCavityA };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const report = [];
  const failures = [];

  for (const theme of ["light", "dark"]) {
    const file = `boss-frame-${theme}.webp`;
    const outPath = path.join(OUT_DIR, file);
    await sharp(Buffer.from(makeBossFrameSvg(theme)))
      .resize(512, 512)
      .webp({ quality: 92, alphaQuality: 92, effort: 6 })
      .toFile(outPath);

    const { size } = await fs.stat(outPath);
    const { maxSliceInteriorA, maxBoardCavityA } = await verifyBoardClearance(outPath);
    const kb = +(size / 1024).toFixed(2);
    const ok = size < MAX_BYTES && maxSliceInteriorA === 0 && maxBoardCavityA === 0;
    report.push({ file, kb, sliceA: maxSliceInteriorA, cavityA: maxBoardCavityA, gate: ok ? "PASS" : "FAIL" });

    if (size >= MAX_BYTES) failures.push(`${file}: ${kb} KB >= 20 KB`);
    if (maxSliceInteriorA !== 0) failures.push(`${file}: slice interior alpha ${maxSliceInteriorA} !== 0`);
    if (maxBoardCavityA !== 0) failures.push(`${file}: board cavity alpha ${maxBoardCavityA} !== 0 (encroaches on skin frame)`);
  }

  console.log("\nG4 Boss Wave 9-slice frames v2 written to", OUT_DIR);
  console.table(report);

  if (QA_MODE) {
    await fs.mkdir(path.dirname(QA_PATH), { recursive: true });
    const lightFrame = await sharp(await fs.readFile(path.join(OUT_DIR, "boss-frame-light.webp"))).resize(320, 320).toBuffer();
    const darkFrame = await sharp(await fs.readFile(path.join(OUT_DIR, "boss-frame-dark.webp"))).resize(320, 320).toBuffer();
    const makePanel = async (bg, innerBg, frameBuf) => {
      const inner = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="360" height="360">` +
          `<rect x="31" y="31" width="298" height="298" rx="22" fill="${innerBg}" stroke="#f59e0b" stroke-width="3"/>` +
          `</svg>`,
      );
      return sharp({ create: { width: 360, height: 360, channels: 4, background: bg } })
        .composite([{ input: inner, left: 0, top: 0 }, { input: frameBuf, left: 20, top: 20 }])
        .png()
        .toBuffer();
    };

    const [pLight, pDark, pLunar] = await Promise.all([
      makePanel({ r: 248, g: 250, b: 252, alpha: 1 }, "#e2e8f0", lightFrame),
      makePanel({ r: 2, g: 8, b: 23, alpha: 1 }, "#1e293b", darkFrame),
      makePanel({ r: 24, g: 6, b: 6, alpha: 1 }, "#7f1d1d", darkFrame),
    ]);

    await sharp({ create: { width: 1080, height: 360, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } } })
      .composite([
        { input: pLight, left: 0, top: 0 },
        { input: pDark, left: 360, top: 0 },
        { input: pLunar, left: 720, top: 0 },
      ])
      .png()
      .toFile(QA_PATH);
    console.log("QA preview (light / dark / Lunar contrast) written to", QA_PATH);
  }

  if (failures.length > 0) {
    console.error("\nFAILED QUALITY GATES:\n  - " + failures.join("\n  - "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
