#!/usr/bin/env node
/**
 * Generates the social preview image (Open Graph and Twitter card) into
 * public/icons/og-image.png: the stacked logo, the tagline, and a 4x4 board
 * with CHAIN traced across a 2x tile. The output is committed; this script is
 * not part of the build. Re-run it after changing the logo or the layout
 * below:
 *
 *   node scripts/generate-og-image.mjs                        write the image
 *   node scripts/generate-og-image.mjs --qa                   also write .tmp/qa-og-image.png with crop guides
 *   node scripts/generate-og-image.mjs --src <dir>            read the logo from another folder (default docs/brand)
 *   node scripts/generate-og-image.mjs --font-dir <dir>       read the Sora font files from another folder
 *   node scripts/generate-og-image.mjs --allow-fallback-font  preview only: render even if Sora did not load
 *
 * The text is drawn in Sora from the static font files in docs/brand/fonts/
 * (from github.com/sora-xor/sora-font, SIL OFL 1.1). The renderer cannot read
 * the app's .woff2 file, and without those files it would silently fall back
 * to a system font, so the script renders a probe first and stops if Sora did
 * not load.
 *
 * The script exits non-zero if Sora did not load, if the image is not
 * 1200x630 with three channels, or if it reaches 300 KB.
 *
 * The score on the card is what the game gives for CHAIN across a 2x tile.
 * The domain shown is DOMAIN below; index.html carries the matching tags.
 */
import fs from "node:fs/promises";
import path from "node:path";

const args = process.argv.slice(2);
const QA_MODE = args.includes("--qa");
const ALLOW_FALLBACK_FONT = args.includes("--allow-fallback-font");
const readFlag = (flag, fallback) => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : fallback;
};

const SRC_DIR = path.resolve(readFlag("--src", "docs/brand"));
const EXPLICIT_FONT_DIR = readFlag("--font-dir", "");
const OUT_PATH = path.resolve("public/icons/og-image.png");
const QA_PATH = path.resolve(".tmp/qa-og-image.png");

const WIDTH = 1200;
const HEIGHT = 630;
const MAX_BYTES = 300 * 1024;
const DOMAIN = "lexichain.banton-digital.com";

// ---------------------------------------------------------------------------
// Step 0: Configure Fontconfig BEFORE loading sharp/libvips so local Sora .ttf works
// ---------------------------------------------------------------------------
async function configureLocalFonts() {
  const candidates = [
    EXPLICIT_FONT_DIR && path.resolve(EXPLICIT_FONT_DIR),
    path.resolve("docs/brand/fonts"),
    path.resolve("public/fonts"),
    path.resolve("src/assets/fonts"),
    path.resolve("node_modules/@fontsource/sora/files"),
  ].filter(Boolean);

  const fontDirs = [];
  for (const dir of candidates) {
    try {
      const files = await fs.readdir(dir);
      if (files.some((f) => /\.(ttf|otf)$/i.test(f))) {
        fontDirs.push(dir);
      }
    } catch {
      // ignore absent directories
    }
  }

  if (fontDirs.length > 0) {
    const tmpDir = path.resolve(".tmp");
    await fs.mkdir(tmpDir, { recursive: true });
    const confPath = path.join(tmpDir, "fontconfig-og.conf");
    const dirTags = fontDirs.map((d) => `  <dir>${d}</dir>`).join("\n");
    const confXml = `<?xml version="1.0"?>
<!DOCTYPE fontconfig SYSTEM "urn:fontconfig:fonts.dtd">
<fontconfig>
  <include ignore_missing="yes">/etc/fonts/fonts.conf</include>
  <include ignore_missing="yes">/opt/homebrew/etc/fonts/fonts.conf</include>
  <include ignore_missing="yes">/usr/local/etc/fonts/fonts.conf</include>
${dirTags}
  <cachedir>${path.join(tmpDir, "fc-cache")}</cachedir>
</fontconfig>
`;
    await fs.writeFile(confPath, confXml, "utf8");
    process.env.FONTCONFIG_FILE = confPath;
  }

  return fontDirs;
}

// Normalized 4x4 Bayer threshold matrix in [-0.5, +0.5) for zero-band OLED dark gradients
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16 - 0.5));

function clampByte(v) {
  const n = Math.round(v);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function getSvgViewBoxSize(svgText) {
  const vb = svgText.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (vb) return { width: Number(vb[1]), height: Number(vb[2]) };
  const w = svgText.match(/\bwidth=["']([\d.]+)/i);
  const h = svgText.match(/\bheight=["']([\d.]+)/i);
  return { width: w ? Number(w[1]) : 532, height: h ? Number(h[1]) : 168 };
}

function makeDitheredBackdrop(width, height) {
  const buf = Buffer.allocUnsafe(width * height * 3);
  const g1x = width * 0.74;
  const g1y = height * 0.50;
  const invR1x = 1 / (width * 0.44);
  const invR1y = 1 / (height * 0.78);

  const g2x = width * 0.22;
  const g2y = height * 0.24;
  const invR2x = 1 / (width * 0.42);
  const invR2y = 1 / (height * 0.65);

  for (let y = 0; y < height; y++) {
    const dy1 = (y - g1y) * invR1y;
    const dy2 = (y - g2y) * invR2y;
    const dy1Sq = dy1 * dy1;
    const dy2Sq = dy2 * dy2;
    const bayerRow = BAYER_4X4[y & 3];
    const rowOff = y * width * 3;

    for (let x = 0; x < width; x++) {
      let r = 2;
      let g = 8;
      let b = 23;

      const dx1 = (x - g1x) * invR1x;
      const d1 = Math.sqrt(dx1 * dx1 + dy1Sq);
      if (d1 < 1) {
        const a = 0.28 * (1 - d1) * (1 - d1);
        r = r * (1 - a) + 121 * a;
        g = g * (1 - a) + 39 * a;
        b = b * (1 - a) + 236 * a;
      }

      const dx2 = (x - g2x) * invR2x;
      const d2 = Math.sqrt(dx2 * dx2 + dy2Sq);
      if (d2 < 1) {
        const a = 0.14 * (1 - d2) * (1 - d2);
        r = r * (1 - a) + 76 * a;
        g = g * (1 - a) + 29 * a;
        b = b * (1 - a) + 149 * a;
      }

      const dith = bayerRow[x & 3];
      const i = rowOff + x * 3;
      buf[i] = clampByte(r + dith);
      buf[i + 1] = clampByte(g + dith);
      buf[i + 2] = clampByte(b + dith);
    }
  }
  return buf;
}

function makeForegroundSvg() {
  const font = "Sora, 'Sora Display', sans-serif";

  const trayX = 648;
  const trayY = 58;
  const traySize = 452;
  const startX = trayX + 22;
  const startY = trayY + 24;
  const tileSz = 92;
  const gap = 14;
  const step = tileSz + gap;

  const tiles = [
    { r: 0, c: 0, ch: "T", kind: "plain" },
    { r: 0, c: 1, ch: "C", kind: "selected", order: 1 },
    { r: 0, c: 2, ch: "E", kind: "freeze" },
    { r: 0, c: 3, ch: "R", kind: "plain" },

    { r: 1, c: 0, ch: "S", kind: "plain" },
    { r: 1, c: 1, ch: "H", kind: "selected", order: 2 },
    { r: 1, c: 2, ch: "A", kind: "selected", order: 3 },
    { r: 1, c: 3, ch: "M", kind: "plain" },

    { r: 2, c: 0, ch: "?", kind: "wild" },
    { r: 2, c: 1, ch: "L", kind: "plain" },
    { r: 2, c: 2, ch: "I", kind: "selected", order: 4 },
    { r: 2, c: 3, ch: "N", kind: "selected", order: 5, mult: "2x" },

    { r: 3, c: 0, ch: "P", kind: "plain" },
    { r: 3, c: 1, ch: "O", kind: "chain" },
    { r: 3, c: 2, ch: "D", kind: "plain" },
    { r: 3, c: 3, ch: "S", kind: "plain" },
  ];

  const centerOf = (r, c) => [startX + c * step + tileSz / 2, startY + r * step + tileSz / 2];
  const pathPoints = [
    centerOf(0, 1),
    centerOf(1, 1),
    centerOf(1, 2),
    centerOf(2, 2),
    centerOf(2, 3),
  ].map(([x, y]) => `${x},${y}`).join(" ");

  const tileMarkup = tiles.map((t) => {
    const x = startX + t.c * step;
    const y = startY + t.r * step;
    const cx = x + tileSz / 2;
    const pressed = t.kind === "selected";
    const faceY = pressed ? y + 1 : y - 4;

    let fill = "url(#tile-plain)";
    let side = "#1E293B";
    let stroke = "#334155";
    let textFill = "#F8FAFC";

    if (t.kind === "selected" && !t.mult) {
      fill = "url(#tile-selected)";
      side = "#4C1D95";
      stroke = "#C4B5FD";
      textFill = "#FFFFFF";
    } else if (t.mult) {
      fill = "url(#tile-mult)";
      side = "#172554";
      stroke = "#93C5FD";
      textFill = "#FFFFFF";
    } else if (t.kind === "wild") {
      fill = "url(#tile-wild)";
      side = "#4A044E";
      stroke = "#F9A8D4";
      textFill = "#FFFFFF";
    } else if (t.kind === "freeze") {
      fill = "url(#tile-freeze)";
      side = "#3B82F6";
      stroke = "#BAE6FD";
      textFill = "#172554";
    } else if (t.kind === "chain") {
      fill = "url(#tile-chain)";
      side = "#451A03";
      stroke = "#FCD34D";
      textFill = "#FFFFFF";
    }

    const badges = [];
    if (t.order !== undefined) {
      badges.push(
        `<rect x="${x + tileSz - 24}" y="${faceY + 6}" width="18" height="18" rx="9" fill="#F8FAFC"/>`,
        `<text x="${x + tileSz - 15}" y="${faceY + 19}" text-anchor="middle" font-family="${font}" font-size="11" font-weight="800" fill="#0F172A">${t.order}</text>`,
      );
    }
    if (t.mult) {
      badges.push(
        `<rect x="${cx - 16}" y="${faceY + tileSz - 22}" width="32" height="16" rx="4" fill="#0F172A" fill-opacity="0.5"/>`,
        `<text x="${cx}" y="${faceY + tileSz - 10}" text-anchor="middle" font-family="${font}" font-size="11" font-weight="800" fill="#FFFFFF">${t.mult}</text>`,
      );
    }
    if (t.kind === "wild") {
      badges.push(
        `<g transform="translate(${x + tileSz - 15} ${faceY + tileSz - 15})">` +
          `<polygon points="0,-7.5 2.35,-2.35 7.5,0 2.35,2.35 0,7.5 -2.35,2.35 -7.5,0 -2.35,-2.35" fill="#FFFFFF" fill-opacity="0.92"/>` +
          `</g>`,
      );
    }
    if (t.kind === "freeze") {
      badges.push(
        `<g transform="translate(${x + tileSz - 15} ${faceY + tileSz - 15})" stroke="#172554" stroke-width="1.8" stroke-linecap="butt">` +
          `<line x1="0" y1="-6.5" x2="0" y2="6.5"/><line x1="-5.6" y1="-3.2" x2="5.6" y2="3.2"/><line x1="5.6" y1="-3.2" x2="-5.6" y2="3.2"/>` +
          `</g>`,
      );
    }

    return `
      ${pressed ? "" : `<rect x="${x}" y="${y + 4}" width="${tileSz}" height="${tileSz - 4}" rx="14" fill="${side}"/>`}
      <rect x="${x}" y="${faceY}" width="${tileSz}" height="${tileSz}" rx="14" fill="${fill}" stroke="${stroke}" stroke-width="${pressed ? 2.5 : 1.6}"/>
      <line x1="${x + 12}" y1="${faceY + 2}" x2="${x + tileSz - 12}" y2="${faceY + 2}" stroke="#FFFFFF" stroke-width="1.5" stroke-opacity="${t.kind === "freeze" ? 0.85 : 0.25}"/>
      <text x="${cx}" y="${faceY + tileSz * 0.63}" text-anchor="middle" font-family="${font}" font-size="40" font-weight="800" fill="${textFill}">${t.ch}</text>
      ${badges.join("")}
    `;
  }).join("\n");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
  <defs>
    <linearGradient id="tile-plain" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1E293B"/>
      <stop offset="100%" stop-color="#0F172A"/>
    </linearGradient>
    <linearGradient id="tile-selected" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#914DEF"/>
      <stop offset="100%" stop-color="#6713DD"/>
    </linearGradient>
    <linearGradient id="tile-wild" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A855F7"/>
      <stop offset="50%" stop-color="#EC4899"/>
      <stop offset="100%" stop-color="#EF4444"/>
    </linearGradient>
    <linearGradient id="tile-mult" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#3B82F6"/>
      <stop offset="100%" stop-color="#1D4ED8"/>
    </linearGradient>
    <linearGradient id="tile-freeze" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#A5F3FC"/>
      <stop offset="100%" stop-color="#93C5FD"/>
    </linearGradient>
    <linearGradient id="tile-chain" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D97706"/>
      <stop offset="100%" stop-color="#92400E"/>
    </linearGradient>
    <linearGradient id="tray-rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1E293B"/>
    </linearGradient>
  </defs>

  <rect x="20" y="20" width="1160" height="590" rx="28" fill="none" stroke="#334155" stroke-width="1.5" stroke-opacity="0.55"/>

  <line x1="76" y1="312" x2="212" y2="312" stroke="#914DEF" stroke-width="4" stroke-linecap="square"/>

  <text x="76" y="366" font-family="${font}" font-size="30" font-weight="700" fill="#F8FAFC" letter-spacing="-0.4">
    Chain letters. Build words.
  </text>
  <text x="76" y="408" font-family="${font}" font-size="30" font-weight="600" fill="#CBD5E1" letter-spacing="-0.4">
    Master the shifting board.
  </text>

  <g font-family="${font}" font-size="15.5" font-weight="700">
    <polygon points="84,454 226,454 234,462 234,488 226,496 84,496 76,488 76,462" fill="#1E1B4B" stroke="#7927EC" stroke-width="1.6"/>
    <text x="155" y="481" text-anchor="middle" fill="#EDE9FE">Daily Puzzle</text>

    <polygon points="256,454 374,454 382,462 382,488 374,496 256,496 248,488 248,462" fill="#0F172A" stroke="#334155" stroke-width="1.6"/>
    <text x="315" y="481" text-anchor="middle" fill="#CBD5E1">Survival</text>

    <polygon points="404,454 532,454 540,462 540,488 532,496 404,496 396,488 396,462" fill="#0F172A" stroke="#334155" stroke-width="1.6"/>
    <text x="468" y="481" text-anchor="middle" fill="#CBD5E1">23 Trophies</text>
  </g>

  <text x="76" y="554" font-family="${font}" font-size="18" font-weight="600" fill="#94A3B8" letter-spacing="0.2">
    ${DOMAIN}
  </text>

  <!-- Right column: elevated 4x4 board tray -->
  <rect x="${trayX}" y="${trayY}" width="${traySize}" height="${traySize}" rx="28" fill="#0B1224" stroke="url(#tray-rim)" stroke-width="3"/>
  <rect x="${trayX + 8}" y="${trayY + 8}" width="${traySize - 16}" height="${traySize - 16}" rx="22" fill="#060B18" stroke="#1E293B" stroke-width="1.5"/>

  <polyline points="${pathPoints}" fill="none" stroke="#914DEF" stroke-width="18" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.34"/>
  <polyline points="${pathPoints}" fill="none" stroke="#C4B5FD" stroke-width="7" stroke-linecap="round" stroke-linejoin="round" stroke-opacity="0.88"/>

  ${tileMarkup}

  <!-- Real in-game score for CHAIN across a 2x tile -->
  <g>
    <polygon points="722,526 1026,526 1036,536 1036,564 1026,574 722,574 712,564 712,536" fill="#0F172A" stroke="#7927EC" stroke-width="2"/>
    <text x="874" y="556" text-anchor="middle" font-family="${font}" font-size="18" font-weight="800" fill="#FFFFFF" letter-spacing="1.2">
      CHAIN  ·  2×  ·  +370 PTS
    </text>
  </g>
</svg>`;
}

function makeQaOverlaySvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${WIDTH} ${HEIGHT}" width="${WIDTH}" height="${HEIGHT}">
    <rect x="56" y="56" width="${WIDTH - 112}" height="${HEIGHT - 112}" fill="none" stroke="#22D3EE" stroke-width="2" stroke-dasharray="10 6"/>
    <rect x="${(WIDTH - HEIGHT) / 2}" y="0" width="${HEIGHT}" height="${HEIGHT}" fill="none" stroke="#FACC15" stroke-width="2" stroke-dasharray="8 8"/>
  </svg>`;
}

async function verifySoraLoaded(sharp) {
  const probe = (family) =>
    sharp(
      Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="260" height="60">` +
          `<rect width="260" height="60" fill="#000"/>` +
          `<text x="10" y="44" font-family="${family}" font-size="36" font-weight="800" fill="#fff">CHAIN 370</text>` +
          `</svg>`,
      ),
    ).raw().toBuffer();

  const [soraBuf, fallbackBuf] = await Promise.all([
    probe("Sora, 'Sora Display', sans-serif"),
    probe("sans-serif"),
  ]);
  return !soraBuf.equals(fallbackBuf);
}

async function main() {
  const fontDirs = await configureLocalFonts();
  const { default: sharp } = await import("sharp");
  sharp.cache(false);

  const logoPath = path.join(SRC_DIR, "brand-logo-stacked-v3.svg");
  let logoSvg;
  try {
    logoSvg = await fs.readFile(logoPath);
  } catch {
    console.error(`Missing approved brand logo: ${logoPath}`);
    console.error("Pass --src <dir> if your brand SVGs are stored elsewhere.");
    process.exit(1);
  }

  const soraLoaded = await verifySoraLoaded(sharp);
  if (!soraLoaded && !ALLOW_FALLBACK_FONT) {
    console.error("FAILED FONT GATE: librsvg did not load Sora (fell back to system sans-serif).");
    console.error("Place Sora-SemiBold.ttf, Sora-Bold.ttf, and Sora-ExtraBold.ttf in docs/brand/fonts/ (or pass --font-dir <dir>).");
    console.error("Note: librsvg reads .ttf/.otf via Fontconfig and ignores .woff2. Pass --allow-fallback-font for local previews only.");
    process.exit(1);
  }

  await fs.mkdir(path.dirname(OUT_PATH), { recursive: true });

  const bgRaw = makeDitheredBackdrop(WIDTH, HEIGHT);
  const logoMeta = getSvgViewBoxSize(logoSvg.toString("utf8"));
  const logoW = 476;
  const logoH = Math.round(logoW * (logoMeta.height / logoMeta.width));
  const logoDensity = Math.max(72, Math.min(2400, Math.ceil(72 * (logoW / logoMeta.width) * 1.25)));

  const [logoPng, fgPng] = await Promise.all([
    sharp(logoSvg, { density: logoDensity })
      .resize(logoW, logoH, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toBuffer(),
    sharp(Buffer.from(makeForegroundSvg())).resize(WIDTH, HEIGHT).png().toBuffer(),
  ]);

  const buildComposite = () =>
    sharp(bgRaw, { raw: { width: WIDTH, height: HEIGHT, channels: 3 } })
      .composite([
        { input: fgPng, left: 0, top: 0 },
        { input: logoPng, left: 76, top: 122 },
      ])
      .removeAlpha();

  await buildComposite()
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(OUT_PATH);

  let stat = await fs.stat(OUT_PATH);
  let mode = "RGB truecolor";
  if (stat.size >= MAX_BYTES) {
    await buildComposite()
      .png({ palette: true, quality: 92, effort: 10, dither: 1.0 })
      .toFile(OUT_PATH);
    stat = await fs.stat(OUT_PATH);
    mode = "RGB palette";
  }

  const meta = await sharp(await fs.readFile(OUT_PATH)).metadata();
  const kb = +(stat.size / 1024).toFixed(2);
  const failures = [];

  if (meta.width !== WIDTH || meta.height !== HEIGHT) failures.push(`Expected ${WIDTH}x${HEIGHT}, got ${meta.width}x${meta.height}`);
  if (meta.channels !== 3) failures.push(`Expected 3-channel RGB, got ${meta.channels}`);
  if (stat.size >= MAX_BYTES) failures.push(`File size ${kb} KB exceeds 300 KB limit`);

  console.log(`\nE6 OG image written to ${OUT_PATH} (font=${soraLoaded ? "Sora" : "fallback"}, fontDirs=${fontDirs.length})`);
  console.table([{ file: "public/icons/og-image.png", dim: `${meta.width}x${meta.height}`, ch: meta.channels, mode, kb }]);

  if (QA_MODE) {
    await fs.mkdir(path.dirname(QA_PATH), { recursive: true });
    await sharp(await fs.readFile(OUT_PATH))
      .composite([{ input: Buffer.from(makeQaOverlaySvg()), left: 0, top: 0 }])
      .png()
      .toFile(QA_PATH);
    console.log("QA crop-guide overlay written to", QA_PATH);
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
