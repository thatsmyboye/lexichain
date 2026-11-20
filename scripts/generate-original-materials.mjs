#!/usr/bin/env node
/**
 * Generates the Original skin's board materials and the two rare-letter foils
 * into public/assets/board/. The output is committed; this script is not part
 * of the build. Re-run it after changing any of the numbers below:
 *
 *   node scripts/generate-original-materials.mjs          write the ten files
 *   node scripts/generate-original-materials.mjs --qa     also write a contact sheet to .tmp/
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
const MAX_LUM_DELTA_PCT = 8.0;
const TARGET_LUM_DELTA_PCT = 7.4; // tuning target leaving >= 0.6pp headroom
const MIN_FOIL_CONTRAST = 4.5;

// ---------------------------------------------------------------------------
// Deterministic periodic 2D value noise (mathematically seamless on [0, size))
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

function clampRgbToLuminanceBand(base, rawRgb, maxHalfLum) {
  const baseL = relLuminance(base[0], base[1], base[2]);
  let r = clampByte(rawRgb[0]);
  let g = clampByte(rawRgb[1]);
  let b = clampByte(rawRgb[2]);
  const l = relLuminance(r, g, b);
  const diff = Math.abs(l - baseL);
  if (diff <= maxHalfLum || diff === 0) return [r, g, b];

  let lo = 0, hi = 1;
  for (let iter = 0; iter < 8; iter++) {
    const mid = (lo + hi) * 0.5;
    const mr = clampByte(lerp(base[0], rawRgb[0], mid));
    const mg = clampByte(lerp(base[1], rawRgb[1], mid));
    const mb = clampByte(lerp(base[2], rawRgb[2], mid));
    if (Math.abs(relLuminance(mr, mg, mb) - baseL) <= maxHalfLum) {
      lo = mid;
      r = mr; g = mg; b = mb;
    } else {
      hi = mid;
    }
  }
  return [r, g, b];
}

// ---------------------------------------------------------------------------
// A1: Seamless 256x256 matte stoneware / anodized slate face
// Smooth mineral flecks (no hard steps) minimize VP8 DCT ringing.
// ---------------------------------------------------------------------------
function makeTileFace({ base, ampCoarse, ampFine, fleckAmp, tintWarm, maxLumSpan, seed }, scale = 1) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const maxHalfLum = maxLumSpan * scale * 0.5;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n24 = periodicNoise(x, y, S, S, 24, 24, seed + 1) - 0.5;
      const n48 = periodicNoise(x, y, S, S, 48, 48, seed + 2) - 0.5;
      const n64 = periodicNoise(x, y, S, S, 64, 64, seed + 3) - 0.5;
      const nSpeck = periodicNoise(x, y, S, S, 36, 36, seed + 4);
      const darkFleck = smoothstep(0.68, 0.90, nSpeck) * -fleckAmp;
      const lightFleck = (1 - smoothstep(0.08, 0.26, nSpeck)) * (fleckAmp * 0.5);

      const delta = (n24 * ampCoarse + n48 * ampFine + n64 * (ampFine * 0.65) + darkFleck + lightFleck) * scale;
      const warm = tintWarm * n24 * scale;
      const raw = [
        base[0] + delta + warm,
        base[1] + delta,
        base[2] + delta * 1.04 - warm,
      ];
      const [r, g, b] = clampRgbToLuminanceBand(base, raw, maxHalfLum);

      const i = (y * S + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = 255;
    }
  }
  return { buf, width: S, height: S };
}

// Tune A1 amplitude in a closed encode->decode loop until decoded WebP passes
async function generateAndVerifyFace(filename, spec, quality = 94) {
  const outPath = path.join(OUT_DIR, filename);
  let scale = 1.0;
  let lastResult = null;
  let lastMetrics = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const raw = makeTileFace(spec, scale);
    await sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } })
      .webp({ quality, alphaQuality: 100, smartSubsample: false, effort: 6 })
      .toFile(outPath);

    const { size } = await fs.stat(outPath);
    const metrics = await inspectDecodedWebp(outPath);
    lastResult = { filename, outPath, bytes: size, kb: +(size / 1024).toFixed(2), scale: +scale.toFixed(3) };
    lastMetrics = metrics;

    if (metrics.lumDeltaPct <= TARGET_LUM_DELTA_PCT && size < MAX_FILE_BYTES) {
      return { result: lastResult, metrics: lastMetrics };
    }
    scale *= 0.84;
  }

  return { result: lastResult, metrics: lastMetrics };
}

// ---------------------------------------------------------------------------
// A2: Horizontally seamless 256x32 keycap edge strip
// ---------------------------------------------------------------------------
function makeTileEdge({ upper, bevelHi, wall, wallLo, grainAmp, seed }) {
  const W = 256, H = 32;
  const buf = Buffer.alloc(W * H * 4);

  for (let y = 0; y < H; y++) {
    let rgb;
    if (y < 22) {
      rgb = upper;
    } else if (y === 22) {
      rgb = [lerp(upper[0], bevelHi[0], 0.7), lerp(upper[1], bevelHi[1], 0.7), lerp(upper[2], bevelHi[2], 0.7)];
    } else if (y <= 24) {
      rgb = bevelHi;
    } else if (y === 25) {
      rgb = [lerp(bevelHi[0], wall[0], 0.55), lerp(bevelHi[1], wall[1], 0.55), lerp(bevelHi[2], wall[2], 0.55)];
    } else if (y <= 29) {
      const t = (y - 26) / 3;
      rgb = [lerp(wall[0], wallLo[0], t * 0.38), lerp(wall[1], wallLo[1], t * 0.38), lerp(wall[2], wallLo[2], t * 0.38)];
    } else {
      const t = (y - 30);
      rgb = [lerp(wall[0], wallLo[0], 0.72 + t * 0.28), lerp(wall[1], wallLo[1], 0.72 + t * 0.28), lerp(wall[2], wallLo[2], 0.72 + t * 0.28)];
    }

    const rowLine = (hash2(0, y, seed + 19) - 0.5) * grainAmp * 0.7;

    for (let x = 0; x < W; x++) {
      const nStreak = periodicNoise(x, y, W, H, 16, 16, seed + 5) - 0.5;
      const nFine = periodicNoise(x, y, W, H, 48, 16, seed + 6) - 0.5;
      const delta = nStreak * grainAmp + nFine * (grainAmp * 0.55) + rowLine;

      const i = (y * W + x) * 4;
      buf[i] = clampByte(rgb[0] + delta);
      buf[i + 1] = clampByte(rgb[1] + delta);
      buf[i + 2] = clampByte(rgb[2] + delta * 1.05);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: W, height: H };
}

// ---------------------------------------------------------------------------
// A3 Floor & Frame
// ---------------------------------------------------------------------------
function makeTrayFloor({ base, grainAmp, weaveAmp, seed }) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nMid = periodicNoise(x, y, S, S, 16, 16, seed + 10) - 0.5;
      const nFine = periodicNoise(x, y, S, S, 48, 48, seed + 11) - 0.5;
      const weave = (Math.sin((x / 4) * Math.PI * 2) * Math.sin((y / 4) * Math.PI * 2) * 0.5) * weaveAmp;
      const delta = nMid * (grainAmp * 0.55) + nFine * grainAmp + weave;

      const i = (y * S + x) * 4;
      buf[i] = clampByte(base[0] + delta);
      buf[i + 1] = clampByte(base[1] + delta * 1.02);
      buf[i + 2] = clampByte(base[2] + delta * 1.06);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: S, height: S };
}

function makeTrayFrameSvg(theme) {
  const t = theme === "light"
    ? {
        rimStart: "#F8FAFC", rimEnd: "#CFD9E6", outerStroke: "#94A3B8",
        innerStroke: "#64748B", innerOpacity: 0.62, hiEdge: "#FFFFFF",
        hiOpacity: 0.96, recess: "#0F172A", recessOpacity: 0.18,
        notch: "#64748B", notchOpacity: 0.55,
      }
    : {
        rimStart: "#273549", rimEnd: "#111A2E", outerStroke: "#475569",
        innerStroke: "#020617", innerOpacity: 0.9, hiEdge: "#CBD5E1",
        hiOpacity: 0.34, recess: "#000000", recessOpacity: 0.54,
        notch: "#94A3B8", notchOpacity: 0.42,
      };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.rimStart}"/>
      <stop offset="100%" stop-color="${t.rimEnd}"/>
    </linearGradient>
    <clipPath id="cavity"><rect x="14" y="14" width="484" height="484" rx="27" ry="27"/></clipPath>
    <filter id="recess-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <g clip-path="url(#cavity)">
    <rect x="8" y="10" width="496" height="496" rx="29" ry="29" fill="none" stroke="${t.recess}" stroke-width="13" stroke-opacity="${t.recessOpacity}" filter="url(#recess-blur)"/>
  </g>
  <path fill-rule="evenodd" fill="url(#rim)" d="
    M41 2 H471 A39 39 0 0 1 510 41 V471 A39 39 0 0 1 471 510 H41 A39 39 0 0 1 2 471 V41 A39 39 0 0 1 41 2 Z
    M41 14 H471 A27 27 0 0 1 498 41 V471 A27 27 0 0 1 471 498 H41 A27 27 0 0 1 14 471 V41 A27 27 0 0 1 41 14 Z
  "/>
  <rect x="2" y="2" width="508" height="508" rx="39" fill="none" stroke="${t.outerStroke}" stroke-width="2"/>
  <rect x="14" y="14" width="484" height="484" rx="27" fill="none" stroke="${t.innerStroke}" stroke-width="1.5" stroke-opacity="${t.innerOpacity}"/>
  <path d="M41 4.5 H468 M4.5 41 V468" fill="none" stroke="${t.hiEdge}" stroke-width="2" stroke-opacity="${t.hiOpacity}"/>
  <g stroke="${t.notch}" stroke-width="2" stroke-opacity="${t.notchOpacity}" stroke-linecap="square">
    <path d="M17 28 L28 17"/><path d="M484 17 L495 28"/><path d="M17 484 L28 495"/><path d="M484 495 L495 484"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// A4: Seamless 256x256 RGBA diagonal foil maps
// ---------------------------------------------------------------------------
function makeFoilMap({ strong, seed }) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const halfWidth = 0.075;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const p = ((x + y) % S) / S;
      const d = Math.abs(p - 0.5);
      const i = (y * S + x) * 4;

      if (d >= halfWidth) {
        buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0;
        continue;
      }

      const window = 1 - smoothstep(halfWidth * 0.45, halfWidth, d);
      const body = Math.exp(-((d / (strong ? 0.044 : 0.040)) ** 2)) * window;
      const core = Math.exp(-((d / 0.015) ** 2)) * window;
      const shimmer = periodicNoise(x, y, S, S, 32, 32, seed + 30);
      const microFacet = 0.86 + shimmer * 0.24;

      let r, g, b, a;
      if (!strong) {
        r = lerp(246, 255, core);
        g = lerp(192, 240, core);
        b = lerp(92, 198, core);
        a = Math.min(0.24, (body * 0.19 + core * 0.07) * microFacet);
      } else {
        const signed = p - 0.5;
        const t = Math.max(0, Math.min(1, (signed + halfWidth) / (halfWidth * 2)));
        const baseR = lerp(188, 90, t);
        const baseG = lerp(116, 224, t);
        const baseB = lerp(255, 250, t);
        r = lerp(baseR, 255, core * 0.65);
        g = lerp(baseG, 250, core * 0.65);
        b = lerp(baseB, 255, core * 0.65);
        a = Math.min(0.27, (body * 0.21 + core * 0.08) * microFacet);
      }

      const alphaByte = clampByte(a * 255);
      if (alphaByte === 0) {
        buf[i] = 0; buf[i + 1] = 0; buf[i + 2] = 0; buf[i + 3] = 0;
      } else {
        buf[i] = clampByte(r);
        buf[i + 1] = clampByte(g);
        buf[i + 2] = clampByte(b);
        buf[i + 3] = alphaByte;
      }
    }
  }
  return { buf, width: S, height: S };
}

// ---------------------------------------------------------------------------
// Post-decode verification (runs on saved WebP bytes)
// ---------------------------------------------------------------------------
async function inspectDecodedWebp(filePath, { checkY = true } = {}) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  let minL = 1, maxL = 0;
  let sumG = 0, sumG2 = 0;
  const n = w * h;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const L = relLuminance(r, g, b);
    if (L < minL) minL = L;
    if (L > maxL) maxL = L;
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
    grainStdRgb: +stdG.toFixed(2),
    seamPmDelta: +maxSeam.toFixed(2),
    maxInteriorStep: +maxInteriorStep.toFixed(2),
    data,
  };
}

function worstDarkFoilContrast(foilData, bgRgb = [19, 28, 49], textRgb = [248, 250, 252]) {
  const textL = relLuminance(textRgb[0], textRgb[1], textRgb[2]);
  let minCR = 21;
  for (let i = 0; i < foilData.length; i += 4) {
    const a = foilData[i + 3] / 255;
    if (a === 0) continue;
    const cr = contrastRatio(
      textL,
      relLuminance(
        lerp(bgRgb[0], foilData[i], a),
        lerp(bgRgb[1], foilData[i + 1], a),
        lerp(bgRgb[2], foilData[i + 2], a),
      ),
    );
    if (cr < minCR) minCR = cr;
  }
  return +minCR.toFixed(2);
}

// Lossy by default. The foils are stored losslessly: they are mostly
// transparent, so that is smaller, and it avoids a faint step where the band
// crosses the image edge.
async function saveRawWebp(filename, { buf, width, height }, opts = {}) {
  const outPath = path.join(OUT_DIR, filename);
  await sharp(buf, { raw: { width, height, channels: 4 } })
    .webp(opts.lossless ? { lossless: true, effort: 6 } : { quality: opts.quality ?? 94, alphaQuality: 100, smartSubsample: false, effort: 6 })
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
    generateAndVerifyFace("tile-face-original-light.webp", {
      base: [245, 247, 250],
      ampCoarse: 5.2,
      ampFine: 4.0,
      fleckAmp: 3.0,
      tintWarm: 1.2,
      maxLumSpan: 0.048,
      seed: 101,
    }, 95),
    generateAndVerifyFace("tile-face-original-dark.webp", {
      base: [19, 28, 49],
      ampCoarse: 7.0,
      ampFine: 5.5,
      fleckAmp: 4.0,
      tintWarm: 1.2,
      maxLumSpan: 0.045,
      seed: 202,
    }, 94),
  ]);

  const edgeLight = makeTileEdge({
    upper: [186, 198, 214], bevelHi: [216, 224, 236], wall: [168, 182, 201], wallLo: [130, 146, 169], grainAmp: 7.0, seed: 303,
  });
  const edgeDark = makeTileEdge({
    upper: [53, 71, 98], bevelHi: [82, 106, 142], wall: [45, 62, 88], wallLo: [22, 32, 50], grainAmp: 6.5, seed: 404,
  });
  const floorLight = makeTrayFloor({ base: [227, 233, 242], grainAmp: 6.0, weaveAmp: 2.6, seed: 505 });
  const floorDark = makeTrayFloor({ base: [9, 14, 26], grainAmp: 4.5, weaveAmp: 1.8, seed: 606 });
  const foilRare = makeFoilMap({ strong: false, seed: 707 });
  const foilStrong = makeFoilMap({ strong: true, seed: 808 });

  const otherResults = await Promise.all([
    saveRawWebp("tile-edge-original-light.webp", edgeLight),
    saveRawWebp("tile-edge-original-dark.webp", edgeDark),
    saveRawWebp("tray-floor-original-light.webp", floorLight),
    saveRawWebp("tray-floor-original-dark.webp", floorDark),
    saveSvgWebp("tray-frame-original-light.webp", makeTrayFrameSvg("light")),
    saveSvgWebp("tray-frame-original-dark.webp", makeTrayFrameSvg("dark")),
    saveRawWebp("foil-rare.webp", foilRare, { lossless: true }),
    saveRawWebp("foil-rare-strong.webp", foilStrong, { lossless: true }),
  ]);

  const results = [faceL.result, faceD.result, ...otherResults];
  const [mEdgeL, mFoilR, mFoilS] = await Promise.all([
    inspectDecodedWebp(otherResults[0].outPath, { checkY: false }),
    inspectDecodedWebp(otherResults[6].outPath),
    inspectDecodedWebp(otherResults[7].outPath),
  ]);

  const foilRareCR = worstDarkFoilContrast(mFoilR.data);
  const foilStrongCR = worstDarkFoilContrast(mFoilS.data);

  console.log("\nOriginal skin + rare foil materials written to", OUT_DIR);
  console.table(results.map((r) => ({ file: r.filename, kb: r.kb, under20KB: r.bytes < MAX_FILE_BYTES ? "PASS" : "FAIL" })));

  console.log("Post-WebP decoded quality checks:");
  console.log(`  A1 light : lumDelta=${faceL.metrics.lumDeltaPct}% (<8%), grainStd=${faceL.metrics.grainStdRgb} RGB, scale=${faceL.result.scale}, seam=${faceL.metrics.seamPmDelta} (interior max ${faceL.metrics.maxInteriorStep})`);
  console.log(`  A1 dark  : lumDelta=${faceD.metrics.lumDeltaPct}% (<8%), grainStd=${faceD.metrics.grainStdRgb} RGB, scale=${faceD.result.scale}, seam=${faceD.metrics.seamPmDelta} (interior max ${faceD.metrics.maxInteriorStep})`);
  console.log(`  A2 light : seamX=${mEdgeL.seamPmDelta} (interior max ${mEdgeL.maxInteriorStep})`);
  console.log(`  A4 rare  : darkContrast=${foilRareCR}:1 (>=4.5:1), seam=${mFoilR.seamPmDelta} (interior max ${mFoilR.maxInteriorStep})`);
  console.log(`  A4 strong: darkContrast=${foilStrongCR}:1 (>=4.5:1), seam=${mFoilS.seamPmDelta} (interior max ${mFoilS.maxInteriorStep})`);

  // Hard gates: fail non-zero if any budget is exceeded
  const failures = [];
  for (const r of results) {
    if (r.bytes >= MAX_FILE_BYTES) failures.push(`${r.filename}: ${r.kb} KB exceeds 20 KB cap`);
  }
  if (faceL.metrics.lumDeltaPct >= MAX_LUM_DELTA_PCT) failures.push(`A1 light lumDelta ${faceL.metrics.lumDeltaPct}% >= ${MAX_LUM_DELTA_PCT}%`);
  if (faceD.metrics.lumDeltaPct >= MAX_LUM_DELTA_PCT) failures.push(`A1 dark lumDelta ${faceD.metrics.lumDeltaPct}% >= ${MAX_LUM_DELTA_PCT}%`);
  if (foilRareCR < MIN_FOIL_CONTRAST) failures.push(`A4 rare dark contrast ${foilRareCR}:1 < ${MIN_FOIL_CONTRAST}:1`);
  if (foilStrongCR < MIN_FOIL_CONTRAST) failures.push(`A4 strong dark contrast ${foilStrongCR}:1 < ${MIN_FOIL_CONTRAST}:1`);
  for (const [label, m] of [["A1 light", faceL.metrics], ["A1 dark", faceD.metrics], ["A2 light", mEdgeL], ["A4 rare", mFoilR], ["A4 strong", mFoilS]]) {
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

    const qaPath = path.join(QA_DIR, "qa-original-materials.png");
    await sharp({ create: { width: 1024, height: 512, channels: 4, background: { r: 30, g: 41, b: 59, alpha: 1 } } })
      .composite([
        { input: await tile2x2("tile-face-original-light.webp"), left: 0, top: 0 },
        { input: await tile2x2("tile-face-original-dark.webp"), left: 256, top: 0 },
        { input: await tile2x2("tray-floor-original-light.webp"), left: 512, top: 0 },
        { input: await sharp(path.join(OUT_DIR, "tray-frame-original-light.webp")).resize(256, 256).toBuffer(), left: 512, top: 0 },
        { input: await tile2x2("tray-floor-original-dark.webp"), left: 768, top: 0 },
        { input: await sharp(path.join(OUT_DIR, "tray-frame-original-dark.webp")).resize(256, 256).toBuffer(), left: 768, top: 0 },
        { input: await tile2x2("tile-face-original-light.webp"), left: 0, top: 256 },
        { input: await tile2x2("foil-rare.webp"), left: 0, top: 256 },
        { input: await tile2x2("tile-face-original-dark.webp"), left: 256, top: 256 },
        { input: await tile2x2("foil-rare-strong.webp"), left: 256, top: 256 },
        { input: await sharp(path.join(OUT_DIR, "tile-edge-original-light.webp")).resize(512, 64).toBuffer(), left: 512, top: 300 },
        { input: await sharp(path.join(OUT_DIR, "tile-edge-original-dark.webp")).resize(512, 64).toBuffer(), left: 512, top: 388 },
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
