#!/usr/bin/env node
/**
 * Generates the Forest skin's board materials into public/assets/board/: wood
 * tile faces, end-grain tile edges, a moss tray floor, and a mitered walnut
 * tray frame, each in light and dark. The output is committed; this script is
 * not part of the build. Re-run it after changing any of the numbers below:
 *
 *   node scripts/generate-forest-materials.mjs          write the eight files
 *   node scripts/generate-forest-materials.mjs --qa     also write a contact sheet to .tmp/
 *
 * Every file is re-read after it is written and checked against the budgets
 * below. The script exits non-zero if any of them is missed.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.resolve("public/assets/board");
const QA_DIR = path.resolve(".tmp");
const QA_MODE = process.argv.includes("--qa");
// The face tuning loop rewrites and re-reads the same path; without this
// sharp returns its cached decode of the first attempt.
sharp.cache(false);

const MAX_FILE_BYTES = 20 * 1024;
// Forest is gated on letter contrast, not on a luminance cap: wood needs a
// wide tonal range to read as wood. Every pixel of a face must keep at least
// this contrast against the ink the Forest skin draws its letters in.
const MIN_LETTER_CONTRAST = 7.0;
const TARGET_LETTER_CONTRAST = 7.2; // tuning target, for headroom over the floor
const INK = { light: [59, 36, 16], dark: [251, 239, 220] }; // text-[#3b2410] / dark:text-[#fbefdc] in tileSkins.ts

// ---------------------------------------------------------------------------
// Deterministic periodic 2D value noise (seamless on [0, sizeX) x [0, sizeY))
// ---------------------------------------------------------------------------
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function periodicNoise(x, y, sizeX, sizeY, periodX, periodY, seed) {
  const gx = (x / sizeX) * periodX;
  const gy = (y / sizeY) * periodY;
  const x0 = Math.floor(gx) % periodX;
  const y0 = Math.floor(gy) % periodY;
  const x1 = (x0 + 1) % periodX;
  const y1 = (y0 + 1) % periodY;
  const ux = fade(gx - Math.floor(gx));
  const uy = fade(gy - Math.floor(gy));

  const n00 = hash2(x0, y0, seed);
  const n10 = hash2(x1, y0, seed);
  const n01 = hash2(x0, y1, seed);
  const n11 = hash2(x1, y1, seed);

  const nx0 = n00 + (n10 - n00) * ux;
  const nx1 = n01 + (n11 - n01) * ux;
  return nx0 + (nx1 - nx0) * uy;
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(edge0, edge1, x) {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function relLuminance(r, g, b) {
  const f = (c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

function contrastRatio(l1, l2) {
  const hi = Math.max(l1, l2);
  const lo = Math.min(l1, l2);
  return (hi + 0.05) / (lo + 0.05);
}

// ---------------------------------------------------------------------------
// A1: Seamless 256x256 carved horizontal wood face (quarter-sawn grain + pores)
// Integer ringCount + periodic domain warp guarantees exact X & Y wrapping.
// ---------------------------------------------------------------------------
function makeWoodFace({ earlywood, latewood, ringCount, warpAmp, fiberWeight, poreWeight, seed }, scale = 1) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Periodic low-frequency grain undulation (cathedral-leaning gentle waves)
      const w1 = (periodicNoise(x, y, S, S, 2, 4, seed + 1) - 0.5) * warpAmp;
      const w2 = (periodicNoise(x, y, S, S, 4, 8, seed + 2) - 0.5) * (warpAmp * 0.35);
      const phase = (y / S) * ringCount + w1 + w2;

      // Asymmetric smooth growth ring: broad calm earlywood, defined latewood band
      const ringWave = 0.5 + 0.5 * Math.sin(phase * Math.PI * 2);
      const primaryRing = ringWave ** 2.3;
      const secondaryRing = (0.5 + 0.5 * Math.sin((phase * 2 + 0.35) * Math.PI * 2)) ** 3.0 * 0.24;

      // Fine horizontally stretched wood fibers (8:1) and smooth vessel pores (6:1)
      const fibers = (periodicNoise(x, y, S, S, 8, 64, seed + 3) - 0.5) * fiberWeight;
      const pores = smoothstep(0.70, 0.92, periodicNoise(x, y, S, S, 16, 96, seed + 4)) * poreWeight;

      const grainSignal = (primaryRing + secondaryRing - 0.36) * 0.95 + fibers + pores;
      const t = Math.max(0, Math.min(1, 0.5 + grainSignal * scale));

      const i = (y * S + x) * 4;
      buf[i] = clampByte(lerp(earlywood[0], latewood[0], t));
      buf[i + 1] = clampByte(lerp(earlywood[1], latewood[1], t));
      buf[i + 2] = clampByte(lerp(earlywood[2], latewood[2], t));
      buf[i + 3] = 255;
    }
  }
  return { buf, width: S, height: S };
}

// Worst contrast between the ink and any pixel of a decoded face
function worstLetterContrast(metrics, theme) {
  const ink = relLuminance(...INK[theme]);
  return Math.min(contrastRatio(ink, metrics.minL), contrastRatio(ink, metrics.maxL));
}

async function generateAndVerifyWoodFace(filename, spec, theme, quality = 94) {
  const outPath = path.join(OUT_DIR, filename);
  let scale = 1.0;
  let lastResult = null;
  let lastMetrics = null;

  for (let attempt = 0; attempt < 24; attempt++) {
    const raw = makeWoodFace(spec, scale);
    await sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .webp({ quality, alphaQuality: 100, smartSubsample: false, effort: 6 })
      .toFile(outPath);

    const { size } = await fs.stat(outPath);
    const metrics = await inspectDecodedWebp(outPath);
    lastResult = { filename, outPath, bytes: size, kb: +(size / 1024).toFixed(2), scale: +scale.toFixed(3) };
    metrics.letterContrast = +worstLetterContrast(metrics, theme).toFixed(2);
    lastMetrics = metrics;

    if (metrics.letterContrast >= TARGET_LETTER_CONTRAST && size < MAX_FILE_BYTES) {
      return { result: lastResult, metrics: lastMetrics };
    }
    scale *= 0.94;
  }

  return { result: lastResult, metrics: lastMetrics };
}

// ---------------------------------------------------------------------------
// A2: Horizontally seamless 256x32 cut wood end-grain keycap edge strip
// Bottom 10px (y=22..31) are exposed at 4px mobile (24..31) & 5px desktop (22..31)
// ---------------------------------------------------------------------------
function makeWoodEndGrainEdge({ upper, bevelHi, wallLight, wallDark, wallLo, rayAmp, seed }) {
  const W = 256, H = 32;
  const buf = Buffer.alloc(W * H * 4);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Periodic scalloped end-grain growth arcs (3 arches per 256px)
      const warp = (periodicNoise(x, y, W, H, 4, 4, seed + 1) - 0.5) * 1.4;
      const arch = Math.sin((x / W) * 3 * Math.PI * 2 + warp) * 3.6;
      const ringCoord = (y - 24) + arch;
      const endRing = (0.5 + 0.5 * Math.sin((ringCoord / 3.8) * Math.PI * 2)) ** 1.9;

      // Fine vertical medullary rays & cut end-grain vessel pores
      const ray = (periodicNoise(x, y, W, H, 64, 4, seed + 2) - 0.5) * rayAmp;
      const pore = smoothstep(0.75, 0.94, periodicNoise(x, y, W, H, 48, 12, seed + 3)) * 0.25;

      const grainT = Math.max(0, Math.min(1, endRing * 0.82 + pore));
      const grainRgb = [
        lerp(wallLight[0], wallDark[0], grainT) + ray,
        lerp(wallLight[1], wallDark[1], grainT) + ray * 0.82,
        lerp(wallLight[2], wallDark[2], grainT) + ray * 0.55,
      ];

      let rgb;
      if (y < 22) {
        rgb = upper;
      } else if (y === 22) {
        rgb = [lerp(upper[0], bevelHi[0], 0.72), lerp(upper[1], bevelHi[1], 0.72), lerp(upper[2], bevelHi[2], 0.72)];
      } else if (y <= 24) {
        // Exposed bevel catch mixed lightly with end-grain rays so it reads as cut wood
        rgb = [
          lerp(bevelHi[0], grainRgb[0], 0.28),
          lerp(bevelHi[1], grainRgb[1], 0.28),
          lerp(bevelHi[2], grainRgb[2], 0.28),
        ];
      } else if (y === 25) {
        rgb = [
          lerp(bevelHi[0], grainRgb[0], 0.72),
          lerp(bevelHi[1], grainRgb[1], 0.72),
          lerp(bevelHi[2], grainRgb[2], 0.72),
        ];
      } else if (y <= 29) {
        const shade = ((y - 26) / 3) * 0.26;
        rgb = [
          lerp(grainRgb[0], wallLo[0], shade),
          lerp(grainRgb[1], wallLo[1], shade),
          lerp(grainRgb[2], wallLo[2], shade),
        ];
      } else {
        const shade = 0.68 + (y - 30) * 0.32;
        rgb = [
          lerp(grainRgb[0], wallLo[0], shade),
          lerp(grainRgb[1], wallLo[1], shade),
          lerp(grainRgb[2], wallLo[2], shade),
        ];
      }

      const i = (y * W + x) * 4;
      buf[i] = clampByte(rgb[0]);
      buf[i + 1] = clampByte(rgb[1]);
      buf[i + 2] = clampByte(rgb[2]);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: W, height: H };
}

// ---------------------------------------------------------------------------
// A3 Floor: Seamless 256x256 matte woodland moss bed
// ---------------------------------------------------------------------------
function makeMossFloor({ low, mid, high, seed }) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nBroad = periodicNoise(x, y, S, S, 8, 8, seed + 10);
      const nTuft = periodicNoise(x, y, S, S, 24, 24, seed + 11);
      const nFelt = periodicNoise(x, y, S, S, 64, 64, seed + 12);
      const v = nBroad * 0.42 + nTuft * 0.34 + nFelt * 0.24; // [0, 1]

      let rgb;
      if (v < 0.5) {
        const t = v * 2;
        rgb = [lerp(low[0], mid[0], t), lerp(low[1], mid[1], t), lerp(low[2], mid[2], t)];
      } else {
        const t = (v - 0.5) * 2;
        rgb = [lerp(mid[0], high[0], t), lerp(mid[1], high[1], t), lerp(mid[2], high[2], t)];
      }

      const i = (y * S + x) * 4;
      buf[i] = clampByte(rgb[0]);
      buf[i + 1] = clampByte(rgb[1]);
      buf[i + 2] = clampByte(rgb[2]);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: S, height: S };
}

// ---------------------------------------------------------------------------
// A3 Frame: 512x512 9-slice mitered walnut frame (border-image-slice: 64)
// Horizontal grain on top/bottom rails, vertical grain on left/right rails so
// 9-slice stretch is distortion-free across 4x4, 5x5, and 6x6 boards.
// ---------------------------------------------------------------------------
function makeForestFrameSvg(theme) {
  const t = theme === "light"
    ? {
        railTopA: "#A87442", railTopB: "#87562A",
        railSideA: "#9B6838", railSideB: "#784A21",
        grainDark: "#523012", grainLight: "#D6A873",
        outerStroke: "#4E2D10", innerStroke: "#3B2009",
        hiEdge: "#FDE8C8", hiOpacity: 0.72,
        recess: "#052E16", recessOpacity: 0.44,
        miter: "#3B2009", pin: "#E3B878",
        leaf: "#A3C968", leafOpacity: 0.65,
      }
    : {
        railTopA: "#5D381B", railTopB: "#3E220D",
        railSideA: "#502E14", railSideB: "#331B0A",
        grainDark: "#1B0C04", grainLight: "#8F5E34",
        outerStroke: "#241206", innerStroke: "#0F0702",
        hiEdge: "#C49563", hiOpacity: 0.36,
        recess: "#000000", recessOpacity: 0.62,
        miter: "#160A03", pin: "#9C7444",
        leaf: "#659348", leafOpacity: 0.5,
      };

  // Ring outer: 2..510 (rx=39), inner cavity: 16..496 (rx=25) -> 7px @1x walnut rail
  // Concentric around (41,41): 45° miter cut runs cleanly from (13.4,13.4) to (23.3,23.3)
  const ringD = `
    M41 2 H471 A39 39 0 0 1 510 41 V471 A39 39 0 0 1 471 510 H41 A39 39 0 0 1 2 471 V41 A39 39 0 0 1 41 2 Z
    M41 16 H471 A25 25 0 0 1 496 41 V471 A25 25 0 0 1 471 496 H41 A25 25 0 0 1 16 471 V41 A25 25 0 0 1 41 16 Z
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="rail-tb" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="${t.railTopA}"/>
      <stop offset="100%" stop-color="${t.railTopB}"/>
    </linearGradient>
    <linearGradient id="rail-lr" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="${t.railSideA}"/>
      <stop offset="100%" stop-color="${t.railSideB}"/>
    </linearGradient>
    <clipPath id="ring-clip"><path clip-rule="evenodd" d="${ringD}"/></clipPath>
    <clipPath id="q-top"><polygon points="0,0 512,0 256,256"/></clipPath>
    <clipPath id="q-bot"><polygon points="0,512 512,512 256,256"/></clipPath>
    <clipPath id="q-left"><polygon points="0,0 0,512 256,256"/></clipPath>
    <clipPath id="q-right"><polygon points="512,0 512,512 256,256"/></clipPath>
    <clipPath id="cavity"><rect x="16" y="16" width="480" height="480" rx="25" ry="25"/></clipPath>
    <filter id="recess-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5.5"/></filter>
  </defs>

  <!-- Recessed moss shadow lip strictly inside cavity (contained inside 64px slice) -->
  <g clip-path="url(#cavity)">
    <rect x="10" y="12" width="492" height="492" rx="28" ry="28"
          fill="none" stroke="${t.recess}" stroke-width="14"
          stroke-opacity="${t.recessOpacity}" filter="url(#recess-blur)"/>
  </g>

  <!-- 4 mitered wooden rails with stretch-safe directional grain -->
  <g clip-path="url(#ring-clip)">
    <!-- Top rail (horizontal grain) -->
    <g clip-path="url(#q-top)">
      <rect x="0" y="0" width="512" height="64" fill="url(#rail-tb)"/>
      <g fill="none" stroke-opacity="0.34">
        <line x1="0" y1="5.5" x2="512" y2="5.5" stroke="${t.grainLight}" stroke-width="1.4"/>
        <line x1="0" y1="8.5" x2="512" y2="8.5" stroke="${t.grainDark}" stroke-width="1.6"/>
        <line x1="0" y1="11.5" x2="512" y2="11.5" stroke="${t.grainLight}" stroke-width="1.1"/>
        <line x1="0" y1="14.2" x2="512" y2="14.2" stroke="${t.grainDark}" stroke-width="1.5"/>
      </g>
    </g>
    <!-- Bottom rail (horizontal grain) -->
    <g clip-path="url(#q-bot)">
      <rect x="0" y="448" width="512" height="64" fill="url(#rail-tb)"/>
      <g fill="none" stroke-opacity="0.34">
        <line x1="0" y1="498.5" x2="512" y2="498.5" stroke="${t.grainDark}" stroke-width="1.5"/>
        <line x1="0" y1="501.5" x2="512" y2="501.5" stroke="${t.grainLight}" stroke-width="1.2"/>
        <line x1="0" y1="504.5" x2="512" y2="504.5" stroke="${t.grainDark}" stroke-width="1.6"/>
        <line x1="0" y1="507.5" x2="512" y2="507.5" stroke="${t.grainLight}" stroke-width="1.1"/>
      </g>
    </g>
    <!-- Left rail (vertical grain) -->
    <g clip-path="url(#q-left)">
      <rect x="0" y="0" width="64" height="512" fill="url(#rail-lr)"/>
      <g fill="none" stroke-opacity="0.34">
        <line x1="5.5" y1="0" x2="5.5" y2="512" stroke="${t.grainLight}" stroke-width="1.4"/>
        <line x1="8.5" y1="0" x2="8.5" y2="512" stroke="${t.grainDark}" stroke-width="1.6"/>
        <line x1="11.5" y1="0" x2="11.5" y2="512" stroke="${t.grainLight}" stroke-width="1.1"/>
        <line x1="14.2" y1="0" x2="14.2" y2="512" stroke="${t.grainDark}" stroke-width="1.5"/>
      </g>
    </g>
    <!-- Right rail (vertical grain) -->
    <g clip-path="url(#q-right)">
      <rect x="448" y="0" width="64" height="512" fill="url(#rail-lr)"/>
      <g fill="none" stroke-opacity="0.34">
        <line x1="498.5" y1="0" x2="498.5" y2="512" stroke="${t.grainDark}" stroke-width="1.5"/>
        <line x1="501.5" y1="0" x2="501.5" y2="512" stroke="${t.grainLight}" stroke-width="1.2"/>
        <line x1="504.5" y1="0" x2="504.5" y2="512" stroke="${t.grainDark}" stroke-width="1.6"/>
        <line x1="507.5" y1="0" x2="507.5" y2="512" stroke="${t.grainLight}" stroke-width="1.1"/>
      </g>
    </g>

    <!-- 45° miter seam lines -->
    <g stroke="${t.miter}" stroke-width="1.75" stroke-opacity="0.7">
      <line x1="12" y1="12" x2="24" y2="24"/>
      <line x1="500" y1="12" x2="488" y2="24"/>
      <line x1="12" y1="500" x2="24" y2="488"/>
      <line x1="500" y1="500" x2="488" y2="488"/>
    </g>

    <!-- Subtle chamfered spline keys straddling each miter (inside 64px corners) -->
    <g stroke="${t.pin}" stroke-width="2" stroke-opacity="0.72" stroke-linecap="square">
      <line x1="15.5" y1="21.5" x2="21.5" y2="15.5"/>
      <line x1="490.5" y1="15.5" x2="496.5" y2="21.5"/>
      <line x1="15.5" y1="490.5" x2="21.5" y2="496.5"/>
      <line x1="490.5" y1="496.5" x2="496.5" y2="490.5"/>
    </g>
  </g>

  <!-- Crisp outer/inner borders & 120° top-left rim bevel catch -->
  <rect x="2" y="2" width="508" height="508" rx="39" fill="none" stroke="${t.outerStroke}" stroke-width="2"/>
  <rect x="16" y="16" width="480" height="480" rx="25" fill="none" stroke="${t.innerStroke}" stroke-width="1.75"/>
  <path d="M41 4.5 H468 M4.5 41 V468" fill="none" stroke="${t.hiEdge}" stroke-width="1.8" stroke-opacity="${t.hiOpacity}"/>

  <!-- Quiet carved botanical corner inlays strictly inside the 64x64 non-stretching corners -->
  <g fill="${t.leaf}" fill-opacity="${t.leafOpacity}">
    <path d="M36 9 L44 6 L50 9 L44 12 Z"/>
    <path d="M9 36 L6 44 L9 50 L12 44 Z"/>
    <path d="M476 9 L468 6 L462 9 L468 12 Z"/>
    <path d="M503 36 L506 44 L503 50 L500 44 Z"/>
    <path d="M36 503 L44 506 L50 503 L44 500 Z"/>
    <path d="M9 476 L6 468 L9 462 L12 468 Z"/>
    <path d="M476 503 L468 506 L462 503 L468 500 Z"/>
    <path d="M503 476 L506 468 L503 462 L500 468 Z"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Independent post-decode verification (runs on saved WebP bytes)
// ---------------------------------------------------------------------------
async function inspectDecodedWebp(filePath, { checkY = true } = {}) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  let minL = 1, maxL = 0;
  let minB = 255, maxB = 0;
  let sumG = 0, sumG2 = 0;
  const n = w * h;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const L = relLuminance(r, g, b);
    if (L < minL) minL = L;
    if (L > maxL) maxL = L;
    if (b < minB) minB = b;
    if (b > maxB) maxB = b;
    const gray = 0.299 * r + 0.587 * g + 0.114 * b;
    sumG += gray;
    sumG2 += gray * gray;
  }

  const meanG = sumG / n;
  const stdG = Math.sqrt(Math.max(0, sumG2 / n - meanG * meanG));

  const pmDiff = (i1, i2) => {
    const a1 = data[i1 + 3] / 255;
    const a2 = data[i2 + 3] / 255;
    return Math.max(
      Math.abs(data[i1] * a1 - data[i2] * a2),
      Math.abs(data[i1 + 1] * a1 - data[i2 + 1] * a2),
      Math.abs(data[i1 + 2] * a1 - data[i2 + 2] * a2),
      Math.abs(data[i1 + 3] - data[i2 + 3]),
    );
  };

  let maxSeam = 0;
  let maxInteriorStep = 0;
  for (let y = 0; y < h; y++) {
    maxSeam = Math.max(maxSeam, pmDiff((y * w) * 4, (y * w + (w - 1)) * 4));
    for (let x = 0; x < w - 1; x++) {
      maxInteriorStep = Math.max(maxInteriorStep, pmDiff((y * w + x) * 4, (y * w + x + 1) * 4));
    }
  }
  if (checkY) {
    for (let x = 0; x < w; x++) {
      maxSeam = Math.max(maxSeam, pmDiff(x * 4, ((h - 1) * w + x) * 4));
    }
    for (let y = 0; y < h - 1; y++) {
      for (let x = 0; x < w; x++) {
        maxInteriorStep = Math.max(maxInteriorStep, pmDiff((y * w + x) * 4, ((y + 1) * w + x) * 4));
      }
    }
  }

  return {
    lumDeltaPct: +((maxL - minL) * 100).toFixed(2),
    minL,
    maxL,
    blueSpread: maxB - minB,
    grainStdRgb: +stdG.toFixed(2),
    seamPmDelta: +maxSeam.toFixed(2),
    maxInteriorStep: +maxInteriorStep.toFixed(2),
    data,
    width: w,
    height: h,
  };
}

async function verifyFrameInteriorTransparent(filePath, margin = 64) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let maxAlpha = 0;
  for (let y = margin; y < info.height - margin; y++) {
    for (let x = margin; x < info.width - margin; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a > maxAlpha) maxAlpha = a;
    }
  }
  return maxAlpha;
}

async function saveRawWebp(filename, { buf, width, height }, opts = {}) {
  const outPath = path.join(OUT_DIR, filename);
  await sharp(buf, { raw: { width, height, channels: 4 } })
    .webp({ quality: opts.quality ?? 94, alphaQuality: 100, smartSubsample: false, effort: 6 })
    .toFile(outPath);
  const { size } = await fs.stat(outPath);
  return { filename, outPath, bytes: size, kb: +(size / 1024).toFixed(2) };
}

async function saveSvgWebp(filename, svg) {
  const outPath = path.join(OUT_DIR, filename);
  await sharp(Buffer.from(svg))
    .resize(512, 512)
    .webp({ quality: 92, alphaQuality: 100, effort: 6 })
    .toFile(outPath);
  const { size } = await fs.stat(outPath);
  return { filename, outPath, bytes: size, kb: +(size / 1024).toFixed(2) };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const [faceL, faceD] = await Promise.all([
    generateAndVerifyWoodFace("tile-face-forest-light.webp", {
      earlywood: [247, 234, 208], // pale maple
      latewood:  [209, 179, 133], // honey growth ring, about as dark as the contrast floor allows
      ringCount: 5,
      warpAmp: 0.72,
      fiberWeight: 0.42,
      poreWeight: 0.30,
      seed: 1101,
    }, "light", 92),
    generateAndVerifyWoodFace("tile-face-forest-dark.webp", {
      earlywood: [103, 73, 45],   // walnut highlight, about as light as the contrast floor allows
      latewood:  [44, 29, 17],    // deep walnut grain
      ringCount: 5,
      warpAmp: 0.78,
      fiberWeight: 0.46,
      poreWeight: 0.34,
      seed: 1202,
    }, "dark", 92),
  ]);

  const edgeLight = makeWoodEndGrainEdge({
    upper:     [178, 134, 78],
    bevelHi:   [212, 169, 108],
    wallLight: [179, 134, 76],
    wallDark:  [124, 83, 38],
    wallLo:    [92, 58, 24],
    rayAmp: 12,
    seed: 1303,
  });
  const edgeDark = makeWoodEndGrainEdge({
    upper:     [46, 28, 16],
    bevelHi:   [84, 55, 34],
    wallLight: [56, 35, 20],
    wallDark:  [24, 14, 7],
    wallLo:    [14, 8, 4],
    rayAmp: 9,
    seed: 1404,
  });

  const floorLight = makeMossFloor({
    low:  [34, 82, 34],   // deep mossy shadow
    mid:  [48, 104, 39],  // mid woodland moss
    high: [68, 126, 45],  // sunlit moss tuft
    seed: 1505,
  });
  const floorDark = makeMossFloor({
    low:  [7, 22, 11],
    mid:  [14, 38, 18],
    high: [24, 54, 24],
    seed: 1606,
  });

  const otherResults = await Promise.all([
    saveRawWebp("tile-edge-forest-light.webp", edgeLight),
    saveRawWebp("tile-edge-forest-dark.webp", edgeDark),
    saveRawWebp("tray-floor-forest-light.webp", floorLight),
    saveRawWebp("tray-floor-forest-dark.webp", floorDark),
    saveSvgWebp("tray-frame-forest-light.webp", makeForestFrameSvg("light")),
    saveSvgWebp("tray-frame-forest-dark.webp", makeForestFrameSvg("dark")),
  ]);

  const results = [faceL.result, faceD.result, ...otherResults];
  const [mEdgeL, mEdgeD, mFloorL, mFloorD, frameAlphaL, frameAlphaD] = await Promise.all([
    inspectDecodedWebp(otherResults[0].outPath, { checkY: false }),
    inspectDecodedWebp(otherResults[1].outPath, { checkY: false }),
    inspectDecodedWebp(otherResults[2].outPath),
    inspectDecodedWebp(otherResults[3].outPath),
    verifyFrameInteriorTransparent(otherResults[4].outPath, 44),
    verifyFrameInteriorTransparent(otherResults[5].outPath, 44),
  ]);

  console.log("\nForest skin materials written to", OUT_DIR);
  console.table(results.map((r) => ({ file: r.filename, kb: r.kb, under20KB: r.bytes < MAX_FILE_BYTES ? "PASS" : "FAIL" })));

  console.log("Post-WebP decoded quality checks:");
  console.log(`  A1 light : letterContrast=${faceL.metrics.letterContrast}:1 (>=${MIN_LETTER_CONTRAST}:1), lumSpread=${faceL.metrics.lumDeltaPct}% (info), grainStd=${faceL.metrics.grainStdRgb} RGB, scale=${faceL.result.scale}, seam=${faceL.metrics.seamPmDelta} (int ${faceL.metrics.maxInteriorStep})`);
  console.log(`  A1 dark  : letterContrast=${faceD.metrics.letterContrast}:1 (>=${MIN_LETTER_CONTRAST}:1), lumSpread=${faceD.metrics.lumDeltaPct}% (info), grainStd=${faceD.metrics.grainStdRgb} RGB, scale=${faceD.result.scale}, seam=${faceD.metrics.seamPmDelta} (int ${faceD.metrics.maxInteriorStep})`);
  console.log(`  A2 edges : seamX light=${mEdgeL.seamPmDelta} (int ${mEdgeL.maxInteriorStep}), dark=${mEdgeD.seamPmDelta} (int ${mEdgeD.maxInteriorStep})`);
  console.log(`  A3 floors: seam light=${mFloorL.seamPmDelta} (int ${mFloorL.maxInteriorStep}), dark=${mFloorD.seamPmDelta} (int ${mFloorD.maxInteriorStep})`);
  console.log(`  A3 frames: cavity maxAlpha light=${frameAlphaL}, dark=${frameAlphaD} (must be 0)`);

  const failures = [];
  for (const r of results) {
    if (r.bytes >= MAX_FILE_BYTES) failures.push(`${r.filename}: ${r.kb} KB exceeds 20 KB cap`);
  }
  if (faceL.metrics.letterContrast < MIN_LETTER_CONTRAST) failures.push(`A1 light letter contrast ${faceL.metrics.letterContrast}:1 < ${MIN_LETTER_CONTRAST}:1`);
  if (faceD.metrics.letterContrast < MIN_LETTER_CONTRAST) failures.push(`A1 dark letter contrast ${faceD.metrics.letterContrast}:1 < ${MIN_LETTER_CONTRAST}:1`);
  if (frameAlphaL !== 0 || frameAlphaD !== 0) failures.push(`A3 frame center is not fully transparent (${frameAlphaL}, ${frameAlphaD})`);

  for (const [label, m] of [
    ["A1 light", faceL.metrics], ["A1 dark", faceD.metrics],
    ["A2 light", mEdgeL], ["A2 dark", mEdgeD],
    ["A3 floor light", mFloorL], ["A3 floor dark", mFloorD],
  ]) {
    if (m.seamPmDelta > Math.max(m.maxInteriorStep * 1.25, m.maxInteriorStep + 2)) {
      failures.push(`${label} seam delta ${m.seamPmDelta} exceeds interior step ${m.maxInteriorStep}`);
    }
  }

  if (QA_MODE) {
    await fs.mkdir(QA_DIR, { recursive: true });
    const tile2x2 = async (file) => {
      const p = path.join(OUT_DIR, file);
      const q = await sharp(p).resize(128, 128).toBuffer();
      return sharp({ create: { width: 256, height: 256, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
        .composite([
          { input: q, left: 0, top: 0 },
          { input: q, left: 128, top: 0 },
          { input: q, left: 0, top: 128 },
          { input: q, left: 128, top: 128 },
        ])
        .png()
        .toBuffer();
    };

    const qaPath = path.join(QA_DIR, "qa-forest-materials.png");
    await sharp({ create: { width: 1024, height: 512, channels: 4, background: { r: 20, g: 30, b: 20, alpha: 1 } } })
      .composite([
        { input: await tile2x2("tile-face-forest-light.webp"), left: 0, top: 0 },
        { input: await tile2x2("tile-face-forest-dark.webp"), left: 256, top: 0 },
        { input: await tile2x2("tray-floor-forest-light.webp"), left: 512, top: 0 },
        { input: await sharp(path.join(OUT_DIR, "tray-frame-forest-light.webp")).resize(256, 256).toBuffer(), left: 512, top: 0 },
        { input: await tile2x2("tray-floor-forest-dark.webp"), left: 768, top: 0 },
        { input: await sharp(path.join(OUT_DIR, "tray-frame-forest-dark.webp")).resize(256, 256).toBuffer(), left: 768, top: 0 },
        // Bottom row: exposed end-grain strips (2x zoomed) + 1:1 face samples
        { input: await sharp(path.join(OUT_DIR, "tile-face-forest-light.webp")).toBuffer(), left: 0, top: 256 },
        { input: await sharp(path.join(OUT_DIR, "tile-face-forest-dark.webp")).toBuffer(), left: 256, top: 256 },
        { input: await sharp(path.join(OUT_DIR, "tile-edge-forest-light.webp")).resize(512, 64).toBuffer(), left: 512, top: 300 },
        { input: await sharp(path.join(OUT_DIR, "tile-edge-forest-dark.webp")).resize(512, 64).toBuffer(), left: 512, top: 388 },
      ])
      .png()
      .toFile(qaPath);
    console.log("QA sheet written to", qaPath);
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
