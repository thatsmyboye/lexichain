#!/usr/bin/env node
/**
 * Generates the board materials for the Ocean, Sunset and Frost skins into
 * public/assets/board/: tile faces, tile edges, tray floors and 9-slice tray
 * frames, each in light and dark. The output is committed; this script is not
 * part of the build. Re-run it after changing any of the numbers below:
 *
 *   node scripts/generate-skins-batch2.mjs          write the 24 files
 *   node scripts/generate-skins-batch2.mjs --qa     also write a contact sheet to .tmp/
 *
 * Every file is re-read after it is written. The script exits non-zero if a
 * file reaches 20 KB, if a tile face spans 8% or more in luminance or drops
 * below 7:1 contrast with the letter colors it is checked against, if a
 * tiling image shows a seam, or if a frame is not empty in the middle.
 *
 * Two of the images are translucent and rely on what is under them: Ocean's
 * tile faces (over the tile's own translucent fill) and Sunset's tray floors
 * (cloud wisps over the dusk gradient in src/index.css).
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// The face tuning loop rewrites and re-reads the same path; without this
// sharp returns its cached decode of the first attempt.
sharp.cache(false);

const OUT_DIR = path.resolve("public/assets/board");
const QA_DIR = path.resolve(".tmp");
const QA_MODE = process.argv.includes("--qa");

const MAX_FILE_BYTES = 20 * 1024;
const TARGET_FILE_BYTES = 16 * 1024;
const MAX_LUM_DELTA_PCT = 8.0;
const TARGET_LUM_DELTA_PCT = 7.2;
const MIN_LETTER_CONTRAST = 7.0;

// ---------------------------------------------------------------------------
// Deterministic periodic 2D noise & Voronoi helpers (mathematically seamless)
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

  return (n00 + (n10 - n00) * ux) * (1 - uy) + (n01 + (n11 - n01) * ux) * uy;
}

function periodicVoronoi(x, y, size, cells, seed) {
  const gx = (x / size) * cells;
  const gy = (y / size) * cells;
  const ix = Math.floor(gx);
  const iy = Math.floor(gy);
  let d1 = 1e9;
  let d2 = 1e9;
  let shade = 0;

  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const cx = (((ix + dx) % cells) + cells) % cells;
      const cy = (((iy + dy) % cells) + cells) % cells;
      const px = ix + dx + 0.14 + 0.72 * hash2(cx, cy, seed);
      const py = iy + dy + 0.14 + 0.72 * hash2(cx, cy, seed + 17);
      const dist = Math.hypot(gx - px, gy - py);
      if (dist < d1) {
        d2 = d1;
        d1 = dist;
        shade = hash2(cx, cy, seed + 31);
      } else if (dist < d2) {
        d2 = dist;
      }
    }
  }
  return { d1, edge: d2 - d1, shade };
}

function clampByte(v) {
  return Math.max(0, Math.min(255, Math.round(v)));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function smoothstep(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
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
  const diff = Math.abs(relLuminance(r, g, b) - baseL);
  if (diff <= maxHalfLum || diff === 0) return [r, g, b];

  let lo = 0;
  let hi = 1;
  for (let iter = 0; iter < 8; iter++) {
    const mid = (lo + hi) * 0.5;
    const mr = clampByte(lerp(base[0], rawRgb[0], mid));
    const mg = clampByte(lerp(base[1], rawRgb[1], mid));
    const mb = clampByte(lerp(base[2], rawRgb[2], mid));
    if (Math.abs(relLuminance(mr, mg, mb) - baseL) <= maxHalfLum) {
      lo = mid;
      r = mr;
      g = mg;
      b = mb;
    } else {
      hi = mid;
    }
  }
  return [r, g, b];
}

// ---------------------------------------------------------------------------
// OCEAN (A1 RGBA sea glass, A2 cut glass wall, A3 caustic lagoon + glass frame)
// ---------------------------------------------------------------------------
function makeOceanFace({ tintLight, tintDeep, alphaBase, alphaAmp, seed }, scale = 1) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Tumbled sea-glass micro-etching + gentle diagonal refracted water wave
      const etchMid = periodicNoise(x, y, S, S, 20, 20, seed + 1);
      const etchFine = periodicNoise(x, y, S, S, 48, 48, seed + 2);
      const wave = 0.5 + 0.5 * Math.sin(((x + y) / S) * Math.PI * 4 + (etchMid - 0.5) * 1.8);
      const ripple = wave ** 2.2;
      // Sparse soft air bubbles trapped in sea glass
      const bubble = smoothstep(0.78, 0.94, periodicNoise(x, y, S, S, 28, 28, seed + 3));

      const mix = Math.max(0, Math.min(1, etchMid * 0.45 + ripple * 0.35 + bubble * 0.35));
      const a = Math.max(0, Math.min(0.46, alphaBase + ((etchFine - 0.5) * 0.55 + (ripple - 0.35) * 0.55 + bubble * 0.35) * alphaAmp * scale));

      const i = (y * S + x) * 4;
      buf[i] = clampByte(lerp(tintDeep[0], tintLight[0], mix));
      buf[i + 1] = clampByte(lerp(tintDeep[1], tintLight[1], mix));
      buf[i + 2] = clampByte(lerp(tintDeep[2], tintLight[2], mix));
      buf[i + 3] = clampByte(a * 255);
    }
  }
  return { buf, width: S, height: S };
}

function makeOceanEdge({ upper, bevelHi, wall, wallLo, sheenAmp, seed }) {
  const W = 256;
  const H = 32;
  const buf = Buffer.alloc(W * H * 4);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Glossy refracted vertical glass ripples + tiny trapped bubbles
      const streak = (periodicNoise(x, y, W, H, 12, 4, seed + 1) - 0.5) * sheenAmp;
      const bubble = smoothstep(0.80, 0.95, periodicNoise(x, y, W, H, 40, 10, seed + 2)) * (sheenAmp * 0.9);
      let rgb;
      if (y < 22) {
        rgb = upper;
      } else if (y === 22) {
        rgb = [lerp(upper[0], bevelHi[0], 0.72), lerp(upper[1], bevelHi[1], 0.72), lerp(upper[2], bevelHi[2], 0.72)];
      } else if (y <= 24) {
        rgb = bevelHi; // crisp refracted aqua bevel catch
      } else if (y === 25) {
        rgb = [lerp(bevelHi[0], wall[0], 0.6), lerp(bevelHi[1], wall[1], 0.6), lerp(bevelHi[2], wall[2], 0.6)];
      } else if (y <= 29) {
        const t = ((y - 26) / 3) * 0.32;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      } else {
        const t = 0.68 + (y - 30) * 0.32;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      }

      const delta = streak + bubble;
      const i = (y * W + x) * 4;
      buf[i] = clampByte(rgb[0] + delta * 0.85);
      buf[i + 1] = clampByte(rgb[1] + delta * 1.0);
      buf[i + 2] = clampByte(rgb[2] + delta * 1.1);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: W, height: H };
}

function makeOceanFloor({ deep, mid, caustic, causticWeight, seed }) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const swell = periodicNoise(x, y, S, S, 6, 6, seed + 1);
      const v1 = periodicVoronoi(x, y, S, 5, seed + 2);
      const v2 = periodicVoronoi(x, y, S, 9, seed + 3);
      // Soft glowing water caustic web along Voronoi cell ridges
      const web = (1 - smoothstep(0.0, 0.22, v1.edge)) * 0.65 + (1 - smoothstep(0.0, 0.24, v2.edge)) * 0.35;
      const baseRgb = [
        lerp(deep[0], mid[0], swell),
        lerp(deep[1], mid[1], swell),
        lerp(deep[2], mid[2], swell),
      ];
      const glow = Math.min(1, web * causticWeight);
      const i = (y * S + x) * 4;
      buf[i] = clampByte(lerp(baseRgb[0], caustic[0], glow));
      buf[i + 1] = clampByte(lerp(baseRgb[1], caustic[1], glow));
      buf[i + 2] = clampByte(lerp(baseRgb[2], caustic[2], glow));
      buf[i + 3] = 255;
    }
  }
  return { buf, width: S, height: S };
}

function makeOceanFrameSvg(theme) {
  const t = theme === "light"
    ? {
        rimStart: "#E0F7FF", rimEnd: "#38BDF8",
        outerStroke: "#0369A1", innerStroke: "#0284C7", innerOpacity: 0.7,
        hiEdge: "#FFFFFF", hiOpacity: 0.96,
        recess: "#083344", recessOpacity: 0.38,
        accent: "#FFFFFF", accentOpacity: 0.72,
      }
    : {
        rimStart: "#164E63", rimEnd: "#082F49",
        outerStroke: "#38BDF8", innerStroke: "#020617", innerOpacity: 0.9,
        hiEdge: "#BAE6FD", hiOpacity: 0.45,
        recess: "#000000", recessOpacity: 0.58,
        accent: "#7DD3FC", accentOpacity: 0.5,
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
  <!-- Refractive mid-bevel glass channel -->
  <rect x="8" y="8" width="496" height="496" rx="33" fill="none" stroke="${t.hiEdge}" stroke-width="1.5" stroke-opacity="0.35"/>
  <rect x="2" y="2" width="508" height="508" rx="39" fill="none" stroke="${t.outerStroke}" stroke-width="2"/>
  <rect x="14" y="14" width="484" height="484" rx="27" fill="none" stroke="${t.innerStroke}" stroke-width="1.6" stroke-opacity="${t.innerOpacity}"/>
  <path d="M41 4.5 H468 M4.5 41 V468" fill="none" stroke="${t.hiEdge}" stroke-width="2" stroke-opacity="${t.hiOpacity}"/>
  <!-- Sea-glass facet diamonds strictly inside 64x64 corners -->
  <g fill="${t.accent}" fill-opacity="${t.accentOpacity}">
    <polygon points="22,16 26,22 22,28 18,22"/>
    <polygon points="490,16 494,22 490,28 486,22"/>
    <polygon points="22,484 26,490 22,496 18,490"/>
    <polygon points="490,484 494,490 490,496 486,490"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// SUNSET (A1 kiln-glazed stoneware, A2 glaze-drip bisque edge, A3 dusk tray)
// ---------------------------------------------------------------------------
function makeSunsetFace({ glazeHi, glazeLo, base, fleckAmp, maxLumSpan, seed }, scale = 1) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const maxHalfLum = maxLumSpan * scale * 0.5;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Smooth kiln-glaze pooling undulations + fine stoneware iron-oxide specks
      const pool1 = periodicNoise(x, y, S, S, 6, 6, seed + 1);
      const pool2 = periodicNoise(x, y, S, S, 16, 16, seed + 2);
      const grain = (periodicNoise(x, y, S, S, 40, 40, seed + 3) - 0.5) * 0.28;
      const speck = smoothstep(0.74, 0.93, periodicNoise(x, y, S, S, 36, 36, seed + 4)) * fleckAmp;

      const t = Math.max(0, Math.min(1, 0.5 + ((pool1 * 0.58 + pool2 * 0.42 - 0.5) * 1.15 + grain + speck) * scale));
      const raw = [
        lerp(glazeHi[0], glazeLo[0], t),
        lerp(glazeHi[1], glazeLo[1], t),
        lerp(glazeHi[2], glazeLo[2], t),
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

function makeSunsetEdge({ upper, glazeLip, bisque, bisqueLo, grainAmp, seed }) {
  const W = 256;
  const H = 32;
  const buf = Buffer.alloc(W * H * 4);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Subtle organic glaze-drip waviness along the bisque transition line
      const drip = Math.sin((x / W) * Math.PI * 8 + periodicNoise(x, y, W, H, 6, 4, seed + 1) * 2) * 0.7;
      const yEff = y + drip;
      const sand = (periodicNoise(x, y, W, H, 32, 12, seed + 2) - 0.5) * grainAmp;

      let rgb;
      if (yEff < 22) {
        rgb = upper;
      } else if (yEff < 25) {
        rgb = glazeLip; // glossy glazed shoulder lip visible at 4-5px
      } else if (yEff < 29.5) {
        const t = (yEff - 25) / 4.5;
        rgb = [lerp(bisque[0], bisqueLo[0], t * 0.35), lerp(bisque[1], bisqueLo[1], t * 0.35), lerp(bisque[2], bisqueLo[2], t * 0.35)];
      } else {
        const t = Math.min(1, (yEff - 29.5) / 2.5);
        rgb = [lerp(bisque[0], bisqueLo[0], 0.65 + t * 0.35), lerp(bisque[1], bisqueLo[1], 0.65 + t * 0.35), lerp(bisque[2], bisqueLo[2], 0.65 + t * 0.35)];
      }

      const i = (y * W + x) * 4;
      buf[i] = clampByte(rgb[0] + sand);
      buf[i + 1] = clampByte(rgb[1] + sand * 0.85);
      buf[i + 2] = clampByte(rgb[2] + sand * 0.75);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: W, height: H };
}

// Translucent RGBA horizontal dusk-cloud wisps + subtle warm matte tooth (zero color blotches)
function makeSunsetFloorOverlay({ wispRgb, maxAlpha, toothAmp, seed }) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Soft horizontally stretched cirrus ribbons (3:10 aspect)
      const w1 = periodicNoise(x, y, S, S, 3, 10, seed + 1);
      const w2 = periodicNoise(x, y, S, S, 6, 20, seed + 2);
      const tooth = (periodicNoise(x, y, S, S, 36, 36, seed + 3) - 0.5) * toothAmp;
      const wisp = smoothstep(0.32, 0.84, w1 * 0.66 + w2 * 0.34);
      const a = Math.max(0, Math.min(maxAlpha, wisp * maxAlpha + tooth));

      const i = (y * S + x) * 4;
      buf[i] = wispRgb[0];
      buf[i + 1] = wispRgb[1];
      buf[i + 2] = wispRgb[2];
      buf[i + 3] = clampByte(a * 255);
    }
  }
  return { buf, width: S, height: S };
}

function makeSunsetFrameSvg(theme) {
  const t = theme === "light"
    ? {
        rimStart: "#FFEDD5", rimMid: "#FDA4AF", rimEnd: "#D8B4FE",
        outerStroke: "#BE123C", innerStroke: "#9A3412", innerOpacity: 0.65,
        hiEdge: "#FFFFFF", hiOpacity: 0.94,
        recess: "#881337", recessOpacity: 0.32,
        accent: "#FFF7ED", accentOpacity: 0.78,
      }
    : {
        rimStart: "#9A3412", rimMid: "#881337", rimEnd: "#4C1D95",
        outerStroke: "#FB923C", innerStroke: "#1C0A10", innerOpacity: 0.9,
        hiEdge: "#FDBA74", hiOpacity: 0.44,
        recess: "#000000", recessOpacity: 0.6,
        accent: "#FDBA74", accentOpacity: 0.52,
      };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.rimStart}"/>
      <stop offset="55%" stop-color="${t.rimMid}"/>
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
  <rect x="14" y="14" width="484" height="484" rx="27" fill="none" stroke="${t.innerStroke}" stroke-width="1.6" stroke-opacity="${t.innerOpacity}"/>
  <path d="M41 4.5 H468 M4.5 41 V468" fill="none" stroke="${t.hiEdge}" stroke-width="2" stroke-opacity="${t.hiOpacity}"/>
  <!-- Warm sun-ray corner accents inside 64x64 corners -->
  <g stroke="${t.accent}" stroke-width="2.2" stroke-opacity="${t.accentOpacity}" stroke-linecap="square">
    <line x1="16" y1="28" x2="28" y2="16"/>
    <line x1="484" y1="16" x2="496" y2="28"/>
    <line x1="16" y1="484" x2="28" y2="496"/>
    <line x1="484" y1="496" x2="496" y2="484"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// FROST (A1 glacial crystal face, A2 cleaved ice wall, A3 festival tray)
// ---------------------------------------------------------------------------
function makeFrostFace({ iceHi, iceLo, base, sheenWeight, toothWeight, maxLumSpan, seed }, scale = 1) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const maxHalfLum = maxLumSpan * scale * 0.5;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Smooth continuous glacial frost (zero Voronoi cell boundaries / zero crack lines)
      const driftBroad = periodicNoise(x, y, S, S, 6, 6, seed + 1);
      const driftMid = periodicNoise(x, y, S, S, 16, 16, seed + 2);
      const sheen = 0.5 + 0.5 * Math.sin(((x + y) / S) * Math.PI * 2 + (driftBroad - 0.5) * 1.4);
      const frostTooth = (periodicNoise(x, y, S, S, 40, 40, seed + 3) - 0.5) * toothWeight;

      const signal = ((driftBroad * 0.44 + driftMid * 0.36 + sheen * sheenWeight) - (0.4 + sheenWeight * 0.5)) * 1.25 + frostTooth;
      const t = Math.max(0, Math.min(1, 0.5 + signal * scale));
      const raw = [
        lerp(iceHi[0], iceLo[0], t),
        lerp(iceHi[1], iceLo[1], t),
        lerp(iceHi[2], iceLo[2], t),
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

function makeFrostEdge({ upper, bevelHi, wall, wallLo, facetAmp, seed }) {
  const W = 256;
  const H = 32;
  const buf = Buffer.alloc(W * H * 4);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      // Diagonal cleaved glacial facet stripes (periodic along X)
      const cleave = Math.sin(((x + y * 3) / W) * Math.PI * 16) * 0.5;
      const grain = (periodicNoise(x, y, W, H, 24, 8, seed + 1) - 0.5) * facetAmp;

      let rgb;
      if (y < 22) {
        rgb = upper;
      } else if (y === 22) {
        rgb = [lerp(upper[0], bevelHi[0], 0.72), lerp(upper[1], bevelHi[1], 0.72), lerp(upper[2], bevelHi[2], 0.72)];
      } else if (y <= 24) {
        rgb = bevelHi; // crisp icy crystal rim catch
      } else if (y === 25) {
        rgb = [lerp(bevelHi[0], wall[0], 0.58), lerp(bevelHi[1], wall[1], 0.58), lerp(bevelHi[2], wall[2], 0.58)];
      } else if (y <= 29) {
        const t = ((y - 26) / 3) * 0.34;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      } else {
        const t = 0.7 + (y - 30) * 0.3;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      }

      const delta = cleave * (facetAmp * 0.65) + grain;
      const i = (y * W + x) * 4;
      buf[i] = clampByte(rgb[0] + delta * 0.9);
      buf[i + 1] = clampByte(rgb[1] + delta * 0.95);
      buf[i + 2] = clampByte(rgb[2] + delta * 1.1);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: W, height: H };
}

// Smooth winter sky drift with deterministic, anti-aliased round toroidal snowflakes
function makeFrostFloor({ low, mid, snow, snowOpacityScale, seed }) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);

  // Build 2 jittered grid layers of round flakes (exact Euclidean circles wrapped on [0, S))
  const flakes = [];
  const addLayer = (gridN, rMin, rMax, aMin, aMax, layerSeed) => {
    const cell = S / gridN;
    for (let gy = 0; gy < gridN; gy++) {
      for (let gx = 0; gx < gridN; gx++) {
        // Keep ~68% of cells populated for natural airy spacing
        if (hash2(gx, gy, layerSeed + 1) > 0.68) continue;
        const fx = (gx + 0.18 + 0.64 * hash2(gx, gy, layerSeed + 2)) * cell;
        const fy = (gy + 0.18 + 0.64 * hash2(gx, gy, layerSeed + 3)) * cell;
        const r = lerp(rMin, rMax, hash2(gx, gy, layerSeed + 4));
        const alpha = lerp(aMin, aMax, hash2(gx, gy, layerSeed + 5)) * snowOpacityScale;
        flakes.push({ fx, fy, r, alpha });
      }
    }
  };
  // Soft foreground snowflakes (r=2.8..4.6 @2x -> 1.4..2.3px @1x) & crisp distant flurries (r=1.6..2.5 @2x)
  addLayer(4, 2.8, 4.6, 0.52, 0.88, seed + 100);
  addLayer(6, 1.6, 2.5, 0.34, 0.66, seed + 200);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const drift = periodicNoise(x, y, S, S, 4, 4, seed + 1);
      const mist = periodicNoise(x, y, S, S, 10, 10, seed + 2);
      const m = drift * 0.68 + mist * 0.32;
      let r = lerp(low[0], mid[0], m);
      let g = lerp(low[1], mid[1], m);
      let b = lerp(low[2], mid[2], m);

      // Accumulate smooth anti-aliased circular snowflakes with toroidal wrap
      let flakeAlpha = 0;
      for (let k = 0; k < flakes.length; k++) {
        const f = flakes[k];
        let dx = Math.abs(x - f.fx);
        if (dx > S * 0.5) dx = S - dx;
        if (dx > f.r) continue;
        let dy = Math.abs(y - f.fy);
        if (dy > S * 0.5) dy = S - dy;
        if (dy > f.r) continue;

        const d = Math.hypot(dx, dy);
        if (d < f.r) {
          const disc = 1 - smoothstep(f.r * 0.35, f.r, d);
          flakeAlpha = 1 - (1 - flakeAlpha) * (1 - disc * f.alpha);
        }
      }

      if (flakeAlpha > 0) {
        r = lerp(r, snow[0], flakeAlpha);
        g = lerp(g, snow[1], flakeAlpha);
        b = lerp(b, snow[2], flakeAlpha);
      }

      const i = (y * S + x) * 4;
      buf[i] = clampByte(r);
      buf[i + 1] = clampByte(g);
      buf[i + 2] = clampByte(b);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: S, height: S };
}

function makeFrostFrameSvg(theme) {
  const t = theme === "light"
    ? {
        rimStart: "#FFFFFF", rimEnd: "#BAE6FD",
        outerStroke: "#60A5FA", innerStroke: "#E11D48", innerOpacity: 0.45, // Frost Festival crimson inlay
        hiEdge: "#FFFFFF", hiOpacity: 0.98,
        recess: "#1E3A8A", recessOpacity: 0.32,
        star: "#FFFFFF", starStroke: "#3B82F6",
      }
    : {
        rimStart: "#3B82F6", rimEnd: "#1E3A8A",
        outerStroke: "#93C5FD", innerStroke: "#FB7185", innerOpacity: 0.42,
        hiEdge: "#E0F2FE", hiOpacity: 0.55,
        recess: "#020617", recessOpacity: 0.6,
        star: "#E0F2FE", starStroke: "#1D4ED8",
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
  <rect x="14" y="14" width="484" height="484" rx="27" fill="none" stroke="${t.innerStroke}" stroke-width="1.8" stroke-opacity="${t.innerOpacity}"/>
  <path d="M41 4.5 H468 M4.5 41 V468" fill="none" stroke="${t.hiEdge}" stroke-width="2" stroke-opacity="${t.hiOpacity}"/>
  <!-- 4-point geometric frost stars strictly inside 64x64 non-stretching corners -->
  <g fill="${t.star}" stroke="${t.starStroke}" stroke-width="0.9" stroke-linejoin="bevel">
    <polygon points="22,15 23.8,20.2 29,22 23.8,23.8 22,29 20.2,23.8 15,22 20.2,20.2"/>
    <polygon points="490,15 491.8,20.2 497,22 491.8,23.8 490,29 488.2,23.8 483,22 488.2,20.2"/>
    <polygon points="22,483 23.8,488.2 29,490 23.8,491.8 22,497 20.2,491.8 15,490 20.2,488.2"/>
    <polygon points="490,483 491.8,488.2 497,490 491.8,491.8 490,497 488.2,491.8 483,490 488.2,488.2"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Post-decode verification & closed-loop encoders
// ---------------------------------------------------------------------------
async function inspectDecodedWebp(filePath, { checkY = true, compositeOver = null } = {}) {
  const fileBuf = await fs.readFile(filePath);
  const { data, info } = await sharp(fileBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  let minL = 1;
  let maxL = 0;
  let sumG = 0;
  let sumG2 = 0;
  const n = w * h;

  for (let i = 0; i < data.length; i += 4) {
    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];
    if (compositeOver) {
      const a = data[i + 3] / 255;
      r = lerp(compositeOver[0], r, a);
      g = lerp(compositeOver[1], g, a);
      b = lerp(compositeOver[2], b, a);
    }
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
    minL,
    maxL,
    grainStdRgb: +stdG.toFixed(2),
    seamPmDelta: +maxSeam.toFixed(2),
    maxInteriorStep: +maxInteriorStep.toFixed(2),
  };
}

async function verifyFrameInteriorTransparent(filePath, margin = 64) {
  const fileBuf = await fs.readFile(filePath);
  const { data, info } = await sharp(fileBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let maxAlpha = 0;
  for (let y = margin; y < info.height - margin; y++) {
    for (let x = margin; x < info.width - margin; x++) {
      const a = data[(y * info.width + x) * 4 + 3];
      if (a > maxAlpha) maxAlpha = a;
    }
  }
  return maxAlpha;
}

async function encodeUnderBudget(buildSharp, outPath, hasAlpha = false) {
  const presets = hasAlpha
    ? [
        { quality: 92, alphaQuality: 90 },
        { quality: 88, alphaQuality: 84 },
        { quality: 84, alphaQuality: 78 },
        { quality: 78, alphaQuality: 72 },
      ]
    : [
        { quality: 94, alphaQuality: 100 },
        { quality: 90, alphaQuality: 100 },
        { quality: 86, alphaQuality: 100 },
        { quality: 80, alphaQuality: 100 },
      ];

  let lastBytes = 0;
  for (const p of presets) {
    await buildSharp()
      .webp({ quality: p.quality, alphaQuality: p.alphaQuality, smartSubsample: false, effort: 6 })
      .toFile(outPath);
    const { size } = await fs.stat(outPath);
    lastBytes = size;
    if (size <= TARGET_FILE_BYTES) return { bytes: size, preset: p };
  }
  return { bytes: lastBytes, preset: presets[presets.length - 1] };
}

async function generateAndVerifyFace(filename, buildRaw, { hasAlpha = false, compositeOver = null } = {}) {
  const outPath = path.join(OUT_DIR, filename);
  let scale = 1.0;
  let lastResult = null;
  let lastMetrics = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const raw = buildRaw(scale);
    const { bytes } = await encodeUnderBudget(
      () => sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } }),
      outPath,
      hasAlpha,
    );
    const metrics = await inspectDecodedWebp(outPath, { compositeOver });
    lastResult = { filename, outPath, bytes, kb: +(bytes / 1024).toFixed(2), scale: +scale.toFixed(3) };
    lastMetrics = metrics;

    if (metrics.lumDeltaPct <= TARGET_LUM_DELTA_PCT && bytes < MAX_FILE_BYTES) {
      return { result: lastResult, metrics: lastMetrics };
    }
    scale *= 0.84;
  }
  return { result: lastResult, metrics: lastMetrics };
}

async function saveRawWebp(filename, raw, { hasAlpha = false } = {}) {
  const outPath = path.join(OUT_DIR, filename);
  const { bytes } = await encodeUnderBudget(
    () => sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } }),
    outPath,
    hasAlpha,
  );
  return { filename, outPath, bytes, kb: +(bytes / 1024).toFixed(2) };
}

async function saveSvgWebp(filename, svg) {
  const outPath = path.join(OUT_DIR, filename);
  const { bytes } = await encodeUnderBudget(
    () => sharp(Buffer.from(svg)).resize(512, 512),
    outPath,
    true,
  );
  return { filename, outPath, bytes, kb: +(bytes / 1024).toFixed(2) };
}

// ---------------------------------------------------------------------------
// Main pipeline (Ocean + Sunset + Frost = 24 WebP files)
// ---------------------------------------------------------------------------
async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  // Representative Ocean translucent tile backings (bg-white/60 over lagoon; dark glass over abyss)
  const OCEAN_LIGHT_BACKING = [194, 234, 245];
  const OCEAN_DARK_BACKING = [11, 41, 66];

  const [
    oceanFaceL, oceanFaceD,
    sunsetFaceL, sunsetFaceD,
    frostFaceL, frostFaceD,
  ] = await Promise.all([
    generateAndVerifyFace(
      "tile-face-ocean-light.webp",
      (scale) => makeOceanFace({ tintLight: [255, 255, 255], tintDeep: [186, 230, 253], alphaBase: 0.16, alphaAmp: 0.22, seed: 4101 }, scale),
      { hasAlpha: true, compositeOver: OCEAN_LIGHT_BACKING },
    ),
    generateAndVerifyFace(
      "tile-face-ocean-dark.webp",
      (scale) => makeOceanFace({ tintLight: [186, 230, 253], tintDeep: [14, 116, 144], alphaBase: 0.08, alphaAmp: 0.14, seed: 4202 }, scale),
      { hasAlpha: true, compositeOver: OCEAN_DARK_BACKING },
    ),
    generateAndVerifyFace(
      "tile-face-sunset-light.webp",
      (scale) => makeSunsetFace({ glazeHi: [255, 245, 237], glazeLo: [248, 226, 214], base: [252, 236, 226], fleckAmp: 0.22, maxLumSpan: 0.056, seed: 5101 }, scale),
    ),
    generateAndVerifyFace(
      "tile-face-sunset-dark.webp",
      (scale) => makeSunsetFace({ glazeHi: [56, 26, 36], glazeLo: [28, 12, 18], base: [42, 19, 27], fleckAmp: 0.24, maxLumSpan: 0.045, seed: 5202 }, scale),
    ),
    generateAndVerifyFace(
      "tile-face-frost-light.webp",
      (scale) => makeFrostFace({ iceHi: [246, 251, 255], iceLo: [222, 239, 253], base: [234, 245, 254], sheenWeight: 0.28, toothWeight: 0.24, maxLumSpan: 0.054, seed: 6101 }, scale),
    ),
    generateAndVerifyFace(
      "tile-face-frost-dark.webp",
      (scale) => makeFrostFace({ iceHi: [36, 60, 98], iceLo: [16, 30, 58], base: [25, 44, 78], sheenWeight: 0.30, toothWeight: 0.26, maxLumSpan: 0.044, seed: 6202 }, scale),
    ),
  ]);

  const otherResults = await Promise.all([
    // Ocean edges, floors, frames
    saveRawWebp("tile-edge-ocean-light.webp", makeOceanEdge({ upper: [26, 134, 162], bevelHi: [142, 228, 248], wall: [16, 122, 150], wallLo: [8, 72, 96], sheenAmp: 12, seed: 4303 })),
    saveRawWebp("tile-edge-ocean-dark.webp", makeOceanEdge({ upper: [22, 68, 98], bevelHi: [88, 186, 232], wall: [24, 82, 118], wallLo: [8, 34, 58], sheenAmp: 11, seed: 4404 })),
    saveRawWebp("tray-floor-ocean-light.webp", makeOceanFloor({ deep: [11, 142, 178], mid: [72, 190, 224], caustic: [232, 250, 255], causticWeight: 0.52, seed: 4505 })),
    saveRawWebp("tray-floor-ocean-dark.webp", makeOceanFloor({ deep: [7, 36, 58], mid: [14, 68, 102], caustic: [125, 211, 252], causticWeight: 0.28, seed: 4606 })),
    saveSvgWebp("tray-frame-ocean-light.webp", makeOceanFrameSvg("light")),
    saveSvgWebp("tray-frame-ocean-dark.webp", makeOceanFrameSvg("dark")),

    // Sunset edges, floors, frames
    saveRawWebp("tile-edge-sunset-light.webp", makeSunsetEdge({ upper: [228, 154, 138], glazeLip: [252, 212, 198], bisque: [212, 136, 120], bisqueLo: [152, 74, 64], grainAmp: 8, seed: 5303 })),
    saveRawWebp("tile-edge-sunset-dark.webp", makeSunsetEdge({ upper: [52, 22, 28], glazeLip: [118, 54, 62], bisque: [46, 18, 24], bisqueLo: [20, 7, 10], grainAmp: 6, seed: 5404 })),
    saveRawWebp("tray-floor-sunset-light.webp", makeSunsetFloorOverlay({ wispRgb: [255, 245, 235], maxAlpha: 0.24, toothAmp: 0.03, seed: 5505 }), { hasAlpha: true }),
    saveRawWebp("tray-floor-sunset-dark.webp", makeSunsetFloorOverlay({ wispRgb: [253, 186, 116], maxAlpha: 0.14, toothAmp: 0.025, seed: 5606 }), { hasAlpha: true }),
    saveSvgWebp("tray-frame-sunset-light.webp", makeSunsetFrameSvg("light")),
    saveSvgWebp("tray-frame-sunset-dark.webp", makeSunsetFrameSvg("dark")),

    // Frost edges, floors, frames
    saveRawWebp("tile-edge-frost-light.webp", makeFrostEdge({ upper: [138, 184, 238], bevelHi: [226, 244, 255], wall: [124, 176, 236], wallLo: [70, 116, 188], facetAmp: 10, seed: 6303 })),
    saveRawWebp("tile-edge-frost-dark.webp", makeFrostEdge({ upper: [18, 38, 72], bevelHi: [96, 156, 224], wall: [20, 44, 82], wallLo: [8, 18, 38], facetAmp: 8, seed: 6404 })),
    saveRawWebp("tray-floor-frost-light.webp", makeFrostFloor({ low: [76, 146, 232], mid: [156, 210, 250], snow: [255, 255, 255], snowOpacityScale: 0.92, seed: 6505 })),
    saveRawWebp("tray-floor-frost-dark.webp", makeFrostFloor({ low: [14, 24, 48], mid: [28, 54, 118], snow: [224, 242, 254], snowOpacityScale: 0.72, seed: 6606 })),
    saveSvgWebp("tray-frame-frost-light.webp", makeFrostFrameSvg("light")),
    saveSvgWebp("tray-frame-frost-dark.webp", makeFrostFrameSvg("dark")),
  ]);

  const faceChecks = [
    { label: "ocean-light",  ...oceanFaceL, inks: [[2, 8, 23], [22, 78, 99]],    dark: false },
    { label: "ocean-dark",   ...oceanFaceD, inks: [[248, 250, 252], [207, 250, 254]], dark: true },
    { label: "sunset-light", ...sunsetFaceL, inks: [[2, 8, 23], [124, 45, 18]],  dark: false },
    { label: "sunset-dark",  ...sunsetFaceD, inks: [[248, 250, 252], [255, 237, 213]], dark: true },
    { label: "frost-light",  ...frostFaceL, inks: [[2, 8, 23], [30, 58, 138]],   dark: false },
    { label: "frost-dark",   ...frostFaceD, inks: [[248, 250, 252], [224, 242, 254]], dark: true },
  ];

  const seamChecks = await Promise.all([
    inspectDecodedWebp(otherResults[0].outPath, { checkY: false }).then((m) => ["ocean-edge-L", m]),
    inspectDecodedWebp(otherResults[1].outPath, { checkY: false }).then((m) => ["ocean-edge-D", m]),
    inspectDecodedWebp(otherResults[2].outPath).then((m) => ["ocean-floor-L", m]),
    inspectDecodedWebp(otherResults[3].outPath).then((m) => ["ocean-floor-D", m]),
    inspectDecodedWebp(otherResults[6].outPath, { checkY: false }).then((m) => ["sunset-edge-L", m]),
    inspectDecodedWebp(otherResults[7].outPath, { checkY: false }).then((m) => ["sunset-edge-D", m]),
    inspectDecodedWebp(otherResults[8].outPath).then((m) => ["sunset-floor-L", m]),
    inspectDecodedWebp(otherResults[9].outPath).then((m) => ["sunset-floor-D", m]),
    inspectDecodedWebp(otherResults[12].outPath, { checkY: false }).then((m) => ["frost-edge-L", m]),
    inspectDecodedWebp(otherResults[13].outPath, { checkY: false }).then((m) => ["frost-edge-D", m]),
    inspectDecodedWebp(otherResults[14].outPath).then((m) => ["frost-floor-L", m]),
    inspectDecodedWebp(otherResults[15].outPath).then((m) => ["frost-floor-D", m]),
  ]);

  const frameChecks = await Promise.all([
    verifyFrameInteriorTransparent(otherResults[4].outPath, 64).then((a) => ["ocean-frame-L", a]),
    verifyFrameInteriorTransparent(otherResults[5].outPath, 64).then((a) => ["ocean-frame-D", a]),
    verifyFrameInteriorTransparent(otherResults[10].outPath, 64).then((a) => ["sunset-frame-L", a]),
    verifyFrameInteriorTransparent(otherResults[11].outPath, 64).then((a) => ["sunset-frame-D", a]),
    verifyFrameInteriorTransparent(otherResults[16].outPath, 64).then((a) => ["frost-frame-L", a]),
    verifyFrameInteriorTransparent(otherResults[17].outPath, 64).then((a) => ["frost-frame-D", a]),
  ]);

  const allResults = [...faceChecks.map((f) => f.result), ...otherResults];
  const failures = [];

  for (const r of allResults) {
    if (r.bytes >= MAX_FILE_BYTES) failures.push(`${r.filename}: ${r.kb} KB exceeds 20 KB cap`);
  }

  console.log("\nBatch 2 v2 board skins (Ocean, Sunset, Frost) written to", OUT_DIR);
  console.table(allResults.map((r) => ({ file: r.filename, kb: r.kb, under20KB: r.bytes < MAX_FILE_BYTES ? "PASS" : "FAIL" })));

  console.log("Post-WebP decoded A1 face gates:");
  for (const f of faceChecks) {
    const faceL = f.dark ? f.metrics.maxL : f.metrics.minL;
    const crs = f.inks.map(([r, g, b]) => +contrastRatio(faceL, relLuminance(r, g, b)).toFixed(2));
    const minCR = Math.min(...crs);
    console.log(`  ${f.label.padEnd(13)}: lumDelta=${f.metrics.lumDeltaPct}% (<8%), grainStd=${f.metrics.grainStdRgb} RGB, contrast=${crs.join(" / ")}:1 (>=${MIN_LETTER_CONTRAST}:1), scale=${f.result.scale}, seam=${f.metrics.seamPmDelta}/${f.metrics.maxInteriorStep}`);

    if (f.metrics.lumDeltaPct >= MAX_LUM_DELTA_PCT) failures.push(`${f.label} lumDelta ${f.metrics.lumDeltaPct}% >= ${MAX_LUM_DELTA_PCT}%`);
    if (minCR < MIN_LETTER_CONTRAST) failures.push(`${f.label} contrast ${minCR}:1 < ${MIN_LETTER_CONTRAST}:1`);
    if (f.metrics.seamPmDelta > Math.max(f.metrics.maxInteriorStep * 1.25, f.metrics.maxInteriorStep + 2)) {
      failures.push(`${f.label} wrap seam ${f.metrics.seamPmDelta} exceeds interior ${f.metrics.maxInteriorStep}`);
    }
  }

  for (const [label, m] of seamChecks) {
    if (m.seamPmDelta > Math.max(m.maxInteriorStep * 1.25, m.maxInteriorStep + 2)) {
      failures.push(`${label} wrap seam ${m.seamPmDelta} exceeds interior ${m.maxInteriorStep}`);
    }
  }
  for (const [label, a] of frameChecks) {
    if (a !== 0) failures.push(`${label} interior maxAlpha=${a} (must be 0)`);
  }

  if (QA_MODE) {
    await fs.mkdir(QA_DIR, { recursive: true });
    const tile2x2 = async (file, bg = { r: 0, g: 0, b: 0, alpha: 0 }) => {
      const q = await sharp(await fs.readFile(path.join(OUT_DIR, file))).resize(128, 128).toBuffer();
      return sharp({ create: { width: 256, height: 256, channels: 4, background: bg } })
        .composite([
          { input: q, left: 0, top: 0 }, { input: q, left: 128, top: 0 },
          { input: q, left: 0, top: 128 }, { input: q, left: 128, top: 128 },
        ])
        .png()
        .toBuffer();
    };

    const makeSunsetGrad = (stops) => Buffer.from(
      `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs>` +
      `<linearGradient id="g" x1="14%" y1="0%" x2="86%" y2="100%">` +
      `<stop offset="0%" stop-color="${stops[0]}"/><stop offset="60%" stop-color="${stops[1]}"/><stop offset="100%" stop-color="${stops[2]}"/>` +
      `</linearGradient></defs><rect width="256" height="256" fill="url(#g)"/></svg>`,
    );

    const sunsetFloorLightPreview = await sharp(makeSunsetGrad(["#fdba74", "#fb7185", "#c084fc"]))
      .composite([{ input: await tile2x2("tray-floor-sunset-light.webp") }])
      .png()
      .toBuffer();
    const sunsetFloorDarkPreview = await sharp(makeSunsetGrad(["#7c2d12", "#881337", "#3b0764"]))
      .composite([{ input: await tile2x2("tray-floor-sunset-dark.webp") }])
      .png()
      .toBuffer();

    const skins = [
      { id: "ocean",  bgL: { r: 194, g: 234, b: 245, alpha: 1 }, bgD: { r: 11, g: 41, b: 66, alpha: 1 } },
      { id: "sunset", bgL: { r: 252, g: 236, b: 226, alpha: 1 }, bgD: { r: 42, g: 19, b: 27, alpha: 1 }, floorL: sunsetFloorLightPreview, floorD: sunsetFloorDarkPreview },
      { id: "frost",  bgL: { r: 234, g: 245, b: 254, alpha: 1 }, bgD: { r: 25, g: 44, b: 78, alpha: 1 } },
    ];

    const composites = [];
    for (let row = 0; row < skins.length; row++) {
      const { id, bgL, bgD, floorL, floorD } = skins[row];
      const y = row * 256;
      composites.push(
        { input: await tile2x2(`tile-face-${id}-light.webp`, bgL), left: 0, top: y },
        { input: await tile2x2(`tile-face-${id}-dark.webp`, bgD), left: 256, top: y },
        { input: floorL ?? await tile2x2(`tray-floor-${id}-light.webp`), left: 512, top: y },
        { input: await sharp(await fs.readFile(path.join(OUT_DIR, `tray-frame-${id}-light.webp`))).resize(256, 256).toBuffer(), left: 512, top: y },
        { input: floorD ?? await tile2x2(`tray-floor-${id}-dark.webp`), left: 768, top: y },
        { input: await sharp(await fs.readFile(path.join(OUT_DIR, `tray-frame-${id}-dark.webp`))).resize(256, 256).toBuffer(), left: 768, top: y },
        { input: await sharp(await fs.readFile(path.join(OUT_DIR, `tile-edge-${id}-light.webp`))).resize(256, 64).toBuffer(), left: 1024, top: y + 48 },
        { input: await sharp(await fs.readFile(path.join(OUT_DIR, `tile-edge-${id}-dark.webp`))).resize(256, 64).toBuffer(), left: 1024, top: y + 144 },
      );
    }

    const qaPath = path.join(QA_DIR, "qa-skins-batch2.png");
    await sharp({ create: { width: 1280, height: 768, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } } })
      .composite(composites)
      .png()
      .toFile(qaPath);
    console.log("QA contact sheet written to", qaPath);
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
