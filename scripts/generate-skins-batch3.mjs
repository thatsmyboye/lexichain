#!/usr/bin/env node
/**
 * Generates the board materials for the Midnight, Neon, Harvest, Lunar and
 * Bloom skins into public/assets/board/: tile faces, tile edges, tray floors
 * and 9-slice tray frames. Midnight, Harvest and Bloom have light and dark
 * faces and edges; Neon and Lunar look the same in both themes. The output is
 * committed; this script is not part of the build. Re-run it after changing
 * any of the numbers below:
 *
 *   node scripts/generate-skins-batch3.mjs          write the 28 files
 *   node scripts/generate-skins-batch3.mjs --qa     also write a contact sheet to .tmp/
 *
 * Every file is re-read after it is written. The script exits non-zero if a
 * file reaches 20 KB, if a tile face spans 8% or more in luminance or drops
 * below its contrast floor with the letter colors it is checked against, if a
 * tiling image shows a seam, or if a frame is not empty in the middle.
 *
 * The contrast floor is 7:1, except Lunar at 5.5:1: a red this bright cannot
 * reach 7:1 under cream letters. src/index.css shades Lunar's face in the
 * dark theme, which is not measured here.
 *
 * Midnight's, Harvest's, Lunar's and Bloom's tray floors are translucent and
 * sit over the gradients in src/index.css.
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

// ---------------------------------------------------------------------------
// Deterministic periodic 2D noise & geometry helpers (mathematically seamless)
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

function wrapDelta(a, b, period) {
  let d = a - b;
  if (d > period * 0.5) d -= period;
  if (d < -period * 0.5) d += period;
  return d;
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

function buildToroidalDots(size, layers, seed) {
  const dots = [];
  layers.forEach((layer, idx) => {
    const cell = size / layer.gridN;
    const lSeed = seed + idx * 97;
    for (let gy = 0; gy < layer.gridN; gy++) {
      for (let gx = 0; gx < layer.gridN; gx++) {
        if (hash2(gx, gy, lSeed + 1) > layer.density) continue;
        dots.push({
          x: (gx + 0.16 + 0.68 * hash2(gx, gy, lSeed + 2)) * cell,
          y: (gy + 0.16 + 0.68 * hash2(gx, gy, lSeed + 3)) * cell,
          r: lerp(layer.rMin, layer.rMax, hash2(gx, gy, lSeed + 4)),
          alpha: lerp(layer.aMin, layer.aMax, hash2(gx, gy, lSeed + 5)),
          diamond: layer.diamond ?? false,
          tintIdx: Math.floor(hash2(gx, gy, lSeed + 6) * 3),
        });
      }
    }
  });
  return dots;
}

// ---------------------------------------------------------------------------
// 1. MIDNIGHT (periwinkle/astral speckled slate faces, slate edges, starry tray)
// ---------------------------------------------------------------------------
function makeMidnightFace({ base, slateHi, slateLo, micaLight, micaDark, dotScale = 1, maxLumSpan, seed }, scale = 1) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const maxHalfLum = maxLumSpan * scale * 0.5;

  const lightDots = buildToroidalDots(S, [
    { gridN: 7, density: 0.62, rMin: 1.7 * dotScale, rMax: 2.9 * dotScale, aMin: 0.50, aMax: 0.90 },
  ], seed + 40);
  const darkDots = buildToroidalDots(S, [
    { gridN: 6, density: 0.62, rMin: 1.8 * dotScale, rMax: 3.1 * dotScale, aMin: 0.44, aMax: 0.78 },
  ], seed + 140);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const broad = periodicNoise(x, y, S, S, 8, 8, seed + 1);
      const mid = periodicNoise(x, y, S, S, 24, 24, seed + 2);
      const fine = (periodicNoise(x, y, S, S, 48, 48, seed + 3) - 0.5) * 0.24;
      const t = Math.max(0, Math.min(1, 0.5 + ((broad * 0.55 + mid * 0.45 - 0.5) * 1.1 + fine) * scale));

      let r = lerp(slateHi[0], slateLo[0], t);
      let g = lerp(slateHi[1], slateLo[1], t);
      let b = lerp(slateHi[2], slateLo[2], t);

      for (let k = 0; k < darkDots.length; k++) {
        const d = darkDots[k];
        const dx = wrapDelta(x, d.x, S);
        if (Math.abs(dx) > d.r) continue;
        const dy = wrapDelta(y, d.y, S);
        if (Math.abs(dy) > d.r) continue;
        const dist = Math.hypot(dx, dy);
        if (dist < d.r) {
          const w = (1 - smoothstep(d.r * 0.35, d.r, dist)) * d.alpha * scale;
          r = lerp(r, micaDark[0], w);
          g = lerp(g, micaDark[1], w);
          b = lerp(b, micaDark[2], w);
        }
      }
      for (let k = 0; k < lightDots.length; k++) {
        const d = lightDots[k];
        const dx = wrapDelta(x, d.x, S);
        if (Math.abs(dx) > d.r) continue;
        const dy = wrapDelta(y, d.y, S);
        if (Math.abs(dy) > d.r) continue;
        const dist = Math.hypot(dx, dy);
        if (dist < d.r) {
          const w = (1 - smoothstep(d.r * 0.3, d.r, dist)) * d.alpha * scale;
          r = lerp(r, micaLight[0], w);
          g = lerp(g, micaLight[1], w);
          b = lerp(b, micaLight[2], w);
        }
      }

      const [cr, cg, cb] = clampRgbToLuminanceBand(base, [r, g, b], maxHalfLum);
      const i = (y * S + x) * 4;
      buf[i] = cr;
      buf[i + 1] = cg;
      buf[i + 2] = cb;
      buf[i + 3] = 255;
    }
  }
  return { buf, width: S, height: S };
}

function makeMidnightEdge({ upper, bevelHi, wall, wallLo, grainAmp, seed }) {
  const W = 256;
  const H = 32;
  const buf = Buffer.alloc(W * H * 4);

  for (let y = 0; y < H; y++) {
    const rowGrain = (hash2(0, y, seed + 17) - 0.5) * grainAmp * 0.6;
    for (let x = 0; x < W; x++) {
      const strata = (periodicNoise(x, y, W, H, 14, 10, seed + 1) - 0.5) * grainAmp;
      const glint = smoothstep(0.84, 0.96, periodicNoise(x, y, W, H, 40, 12, seed + 2)) * (grainAmp * 1.1);
      let rgb;
      if (y < 22) rgb = upper;
      else if (y === 22) rgb = [lerp(upper[0], bevelHi[0], 0.72), lerp(upper[1], bevelHi[1], 0.72), lerp(upper[2], bevelHi[2], 0.72)];
      else if (y <= 24) rgb = bevelHi;
      else if (y === 25) rgb = [lerp(bevelHi[0], wall[0], 0.58), lerp(bevelHi[1], wall[1], 0.58), lerp(bevelHi[2], wall[2], 0.58)];
      else if (y <= 29) {
        const t = ((y - 26) / 3) * 0.35;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      } else {
        const t = 0.7 + (y - 30) * 0.3;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      }

      const d = strata + rowGrain + glint;
      const i = (y * W + x) * 4;
      buf[i] = clampByte(rgb[0] + d * 0.9);
      buf[i + 1] = clampByte(rgb[1] + d * 0.95);
      buf[i + 2] = clampByte(rgb[2] + d * 1.15);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: W, height: H };
}

function makeMidnightFloorOverlay(seed = 7505) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const stars = buildToroidalDots(S, [
    { gridN: 3, density: 0.65, rMin: 3.4, rMax: 5.0, aMin: 0.65, aMax: 0.94, diamond: true },
    { gridN: 6, density: 0.56, rMin: 1.7, rMax: 2.8, aMin: 0.42, aMax: 0.80 },
    { gridN: 9, density: 0.45, rMin: 1.2, rMax: 1.8, aMin: 0.24, aMax: 0.52 },
  ], seed);
  const tints = [[255, 255, 255], [224, 231, 255], [199, 210, 254]];

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const mist = smoothstep(0.45, 0.92, periodicNoise(x, y, S, S, 4, 4, seed + 1)) * 0.08;
      let a = mist;
      let r = 199;
      let g = 210;
      let b = 254;

      for (let k = 0; k < stars.length; k++) {
        const st = stars[k];
        const dx = Math.abs(wrapDelta(x, st.x, S));
        if (dx > st.r) continue;
        const dy = Math.abs(wrapDelta(y, st.y, S));
        if (dy > st.r) continue;

        let shape = 0;
        if (st.diamond) {
          const dEuclid = Math.hypot(dx, dy);
          const halo = (1 - smoothstep(st.r * 0.15, st.r * 0.72, dEuclid)) * 0.65;
          const cross = (1 - smoothstep(0.0, 1.35, Math.min(dx, dy))) * (1 - smoothstep(0.0, st.r, Math.max(dx, dy)));
          shape = Math.max(halo, cross);
        } else {
          const d = Math.hypot(dx, dy);
          if (d < st.r) shape = 1 - smoothstep(st.r * 0.28, st.r, d);
        }

        if (shape > 0) {
          const sa = shape * st.alpha;
          const tint = tints[st.tintIdx];
          if (sa > a) {
            r = tint[0];
            g = tint[1];
            b = tint[2];
          }
          a = 1 - (1 - a) * (1 - sa);
        }
      }

      const i = (y * S + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = clampByte(a * 255);
    }
  }
  return { buf, width: S, height: S };
}

function makeMidnightFrameSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4F46E5"/>
      <stop offset="55%" stop-color="#312E81"/>
      <stop offset="100%" stop-color="#1E1B4B"/>
    </linearGradient>
    <clipPath id="cavity"><rect x="14" y="14" width="484" height="484" rx="27" ry="27"/></clipPath>
    <filter id="recess-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <g clip-path="url(#cavity)">
    <rect x="8" y="10" width="496" height="496" rx="29" ry="29" fill="none" stroke="#090720" stroke-width="14" stroke-opacity="0.62" filter="url(#recess-blur)"/>
  </g>
  <path fill-rule="evenodd" fill="url(#rim)" d="
    M41 2 H471 A39 39 0 0 1 510 41 V471 A39 39 0 0 1 471 510 H41 A39 39 0 0 1 2 471 V41 A39 39 0 0 1 41 2 Z
    M41 14 H471 A27 27 0 0 1 498 41 V471 A27 27 0 0 1 471 498 H41 A27 27 0 0 1 14 471 V41 A27 27 0 0 1 41 14 Z
  "/>
  <rect x="2" y="2" width="508" height="508" rx="39" fill="none" stroke="#A5B4FC" stroke-width="2" stroke-opacity="0.65"/>
  <rect x="14" y="14" width="484" height="484" rx="27" fill="none" stroke="#0F0D2E" stroke-width="1.8"/>
  <path d="M41 4.5 H468 M4.5 41 V468" fill="none" stroke="#E0E7FF" stroke-width="2" stroke-opacity="0.68"/>
  <g fill="#E0E7FF" fill-opacity="0.88">
    <polygon points="22,15 23.6,20.4 29,22 23.6,23.6 22,29 20.4,23.6 15,22 20.4,20.4"/>
    <polygon points="490,15 491.6,20.4 497,22 491.6,23.6 490,29 488.4,23.6 483,22 488.4,20.4"/>
    <polygon points="22,483 23.6,488.4 29,490 23.6,491.6 22,497 20.4,491.6 15,490 20.4,488.4"/>
    <polygon points="490,483 491.6,488.4 497,490 491.6,491.6 490,497 488.4,491.6 483,490 488.4,488.4"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// 2. NEON (unchanged from v1 — approved)
// ---------------------------------------------------------------------------
function makeNeonFace(seed = 8101, scale = 1) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const base = [10, 17, 36];
  const maxHalfLum = 0.036 * scale * 0.5;

  for (let y = 0; y < S; y++) {
    const scan = (Math.sin((y / 4) * Math.PI * 2) * 0.5) * 2.2 * scale;
    for (let x = 0; x < S; x++) {
      const brush = (periodicNoise(x, y, S, S, 8, 48, seed + 1) - 0.5) * 9.0 * scale;
      const grain = (periodicNoise(x, y, S, S, 32, 32, seed + 2) - 0.5) * 4.5 * scale;
      const sheen = Math.sin(((x + y) / S) * Math.PI * 2) * 3.0 * scale;
      const d = brush + grain + scan + sheen;

      const raw = [base[0] + d * 0.55, base[1] + d * 1.15, base[2] + d * 1.45];
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

function makeNeonEdge(seed = 8303) {
  const W = 256;
  const H = 32;
  const buf = Buffer.alloc(W * H * 4);
  const upper = [12, 86, 114];
  const bevelHi = [56, 224, 246];
  const wall = [14, 116, 144];
  const wallLo = [6, 36, 56];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const pulse = Math.sin((x / W) * Math.PI * 8) * 5.0;
      const micro = (periodicNoise(x, y, W, H, 32, 8, seed + 1) - 0.5) * 6.0;
      let rgb;
      if (y < 22) rgb = upper;
      else if (y === 22) rgb = [lerp(upper[0], bevelHi[0], 0.72), lerp(upper[1], bevelHi[1], 0.72), lerp(upper[2], bevelHi[2], 0.72)];
      else if (y <= 24) rgb = bevelHi;
      else if (y === 25) rgb = [lerp(bevelHi[0], wall[0], 0.62), lerp(bevelHi[1], wall[1], 0.62), lerp(bevelHi[2], wall[2], 0.62)];
      else if (y <= 29) {
        const t = ((y - 26) / 3) * 0.4;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      } else {
        const t = 0.72 + (y - 30) * 0.28;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      }

      const d = pulse + micro;
      const i = (y * W + x) * 4;
      buf[i] = clampByte(rgb[0] + d * 0.4);
      buf[i + 1] = clampByte(rgb[1] + d * 1.0);
      buf[i + 2] = clampByte(rgb[2] + d * 1.1);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: W, height: H };
}

function makeNeonFloor() {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const bg = [5, 8, 22];

  for (let y = 0; y < S; y++) {
    const dy = Math.abs((y % 32) - 16);
    const hLine = Math.exp(-((dy / 1.15) ** 2));
    for (let x = 0; x < S; x++) {
      const dx = Math.abs((x % 32) - 16);
      const vLine = Math.exp(-((dx / 1.15) ** 2));
      const node = Math.exp(-((Math.hypot(dx, dy) / 2.6) ** 2));

      const i = (y * S + x) * 4;
      buf[i] = clampByte(bg[0] + hLine * 10 + vLine * 38 + node * 46);
      buf[i + 1] = clampByte(bg[1] + hLine * 34 + vLine * 10 + node * 64);
      buf[i + 2] = clampByte(bg[2] + hLine * 42 + vLine * 28 + node * 72);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: S, height: S };
}

function makeNeonFrameSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0C243C"/>
      <stop offset="50%" stop-color="#08132B"/>
      <stop offset="100%" stop-color="#1E0B33"/>
    </linearGradient>
    <clipPath id="cavity"><rect x="14" y="14" width="484" height="484" rx="27" ry="27"/></clipPath>
    <filter id="recess-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5.5"/></filter>
  </defs>
  <g clip-path="url(#cavity)">
    <rect x="8" y="10" width="496" height="496" rx="29" ry="29" fill="none" stroke="#EC4899" stroke-width="10" stroke-opacity="0.28" filter="url(#recess-blur)"/>
  </g>
  <path fill-rule="evenodd" fill="url(#rim)" d="
    M41 2 H471 A39 39 0 0 1 510 41 V471 A39 39 0 0 1 471 510 H41 A39 39 0 0 1 2 471 V41 A39 39 0 0 1 41 2 Z
    M41 14 H471 A27 27 0 0 1 498 41 V471 A27 27 0 0 1 471 498 H41 A27 27 0 0 1 14 471 V41 A27 27 0 0 1 41 14 Z
  "/>
  <rect x="2" y="2" width="508" height="508" rx="39" fill="none" stroke="#22D3EE" stroke-width="2.4" stroke-opacity="0.88"/>
  <rect x="14" y="14" width="484" height="484" rx="27" fill="none" stroke="#EC4899" stroke-width="1.6" stroke-opacity="0.62"/>
  <path d="M41 5 H468 M5 41 V468" fill="none" stroke="#A5F3FC" stroke-width="1.8" stroke-opacity="0.72"/>
  <g fill="none" stroke="#22D3EE" stroke-width="2.2" stroke-linecap="square">
    <path d="M16 30 L30 16"/>
    <path d="M482 16 L496 30"/>
    <path d="M16 482 L30 496"/>
    <path d="M482 496 L496 482"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// 3. HARVEST (warm golden parchment #d9c496 light / chestnut dark)
// ---------------------------------------------------------------------------
function makeHarvestFace({ base, paperHi, paperLo, fiberWeight, fleckWeight, maxLumSpan, seed }, scale = 1) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const maxHalfLum = maxLumSpan * scale * 0.5;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const broad = periodicNoise(x, y, S, S, 6, 6, seed + 1);
      const fiberH = (periodicNoise(x, y, S, S, 8, 48, seed + 2) - 0.5) * fiberWeight;
      const fiberV = (periodicNoise(x, y, S, S, 48, 8, seed + 3) - 0.5) * (fiberWeight * 0.72);
      const fleck = smoothstep(0.74, 0.93, periodicNoise(x, y, S, S, 36, 36, seed + 4)) * fleckWeight;

      const t = Math.max(0, Math.min(1, 0.5 + ((broad - 0.5) * 0.92 + fiberH + fiberV + fleck) * scale));
      const raw = [
        lerp(paperHi[0], paperLo[0], t),
        lerp(paperHi[1], paperLo[1], t),
        lerp(paperHi[2], paperLo[2], t),
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

function makeHarvestEdge({ upper, bevelHi, wall, wallLo, grainAmp, seed }) {
  const W = 256;
  const H = 32;
  const buf = Buffer.alloc(W * H * 4);

  for (let y = 0; y < H; y++) {
    const sheetLine = Math.sin(y * Math.PI * 0.9) * (grainAmp * 0.45);
    for (let x = 0; x < W; x++) {
      const pulp = (periodicNoise(x, y, W, H, 20, 12, seed + 1) - 0.5) * grainAmp;
      let rgb;
      if (y < 22) rgb = upper;
      else if (y === 22) rgb = [lerp(upper[0], bevelHi[0], 0.72), lerp(upper[1], bevelHi[1], 0.72), lerp(upper[2], bevelHi[2], 0.72)];
      else if (y <= 24) rgb = bevelHi;
      else if (y === 25) rgb = [lerp(bevelHi[0], wall[0], 0.58), lerp(bevelHi[1], wall[1], 0.58), lerp(bevelHi[2], wall[2], 0.58)];
      else if (y <= 29) {
        const t = ((y - 26) / 3) * 0.36;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      } else {
        const t = 0.72 + (y - 30) * 0.28;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      }

      const d = pulp + sheetLine;
      const i = (y * W + x) * 4;
      buf[i] = clampByte(rgb[0] + d * 1.05);
      buf[i + 1] = clampByte(rgb[1] + d * 0.85);
      buf[i + 2] = clampByte(rgb[2] + d * 0.55);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: W, height: H };
}

function makeHarvestFloorOverlay(seed = 9505) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const sparks = buildToroidalDots(S, [
    { gridN: 4, density: 0.55, rMin: 2.0, rMax: 3.4, aMin: 0.28, aMax: 0.56 },
    { gridN: 7, density: 0.42, rMin: 1.3, rMax: 2.0, aMin: 0.16, aMax: 0.36 },
  ], seed + 50);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const haze = smoothstep(0.32, 0.88, periodicNoise(x, y, S, S, 4, 8, seed + 1)) * 0.12;
      let a = haze;
      let r = 253;
      let g = 186;
      let b = 116;

      for (let k = 0; k < sparks.length; k++) {
        const sp = sparks[k];
        const dx = wrapDelta(x, sp.x, S);
        if (Math.abs(dx) > sp.r) continue;
        const dy = wrapDelta(y, sp.y, S);
        if (Math.abs(dy) > sp.r) continue;
        const d = Math.hypot(dx, dy);
        if (d < sp.r) {
          const sa = (1 - smoothstep(sp.r * 0.2, sp.r, d)) * sp.alpha;
          if (sa > a) {
            r = 254;
            g = 240;
            b = 164;
          }
          a = 1 - (1 - a) * (1 - sa);
        }
      }

      const i = (y * S + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = clampByte(a * 255);
    }
  }
  return { buf, width: S, height: S };
}

function makeHarvestFrameSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#D97706"/>
      <stop offset="52%" stop-color="#9A3412"/>
      <stop offset="100%" stop-color="#4C1D95"/>
    </linearGradient>
    <clipPath id="cavity"><rect x="14" y="14" width="484" height="484" rx="27" ry="27"/></clipPath>
    <filter id="recess-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <g clip-path="url(#cavity)">
    <rect x="8" y="10" width="496" height="496" rx="29" ry="29" fill="none" stroke="#1E0A3C" stroke-width="14" stroke-opacity="0.58" filter="url(#recess-blur)"/>
  </g>
  <path fill-rule="evenodd" fill="url(#rim)" d="
    M41 2 H471 A39 39 0 0 1 510 41 V471 A39 39 0 0 1 471 510 H41 A39 39 0 0 1 2 471 V41 A39 39 0 0 1 41 2 Z
    M41 14 H471 A27 27 0 0 1 498 41 V471 A27 27 0 0 1 471 498 H41 A27 27 0 0 1 14 471 V41 A27 27 0 0 1 41 14 Z
  "/>
  <rect x="2" y="2" width="508" height="508" rx="39" fill="none" stroke="#FB923C" stroke-width="2" stroke-opacity="0.78"/>
  <rect x="14" y="14" width="484" height="484" rx="27" fill="none" stroke="#431407" stroke-width="1.8"/>
  <path d="M41 4.5 H468 M4.5 41 V468" fill="none" stroke="#FDE68A" stroke-width="2" stroke-opacity="0.68"/>
  <g fill="#FEF3C7" fill-opacity="0.78">
    <polygon points="22,16 27,22 22,28 17,22"/>
    <polygon points="490,16 495,22 490,28 485,22"/>
    <polygon points="22,484 27,490 22,496 17,490"/>
    <polygon points="490,484 495,490 490,496 485,490"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// 4. LUNAR v2 (bright glossy imperial red lacquer #9c1c1a, zero cloudy mottling)
// ---------------------------------------------------------------------------
function makeLunarFace(seed = 10101, scale = 1) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  // Vibrant cinnabar red close to live #ab2220 while lifting light-mode contrast over 5.5:1
  const base = [156, 28, 26];
  const hi = [166, 33, 30];
  const lo = [146, 23, 22];
  const maxHalfLum = 0.022 * scale * 0.5;

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Smooth silk-polished lacquer sheen (no low-frequency clouds): diagonal specular + fine buffing lines
      const silk = Math.sin(((x + y) / S) * Math.PI * 2) * 0.34;
      const polish = (periodicNoise(x, y, S, S, 6, 48, seed + 2) - 0.5) * 0.28;
      const fine = (periodicNoise(x, y, S, S, 32, 32, seed + 3) - 0.5) * 0.14;

      const t = Math.max(0, Math.min(1, 0.5 + (silk + polish + fine) * scale));
      const raw = [lerp(hi[0], lo[0], t), lerp(hi[1], lo[1], t), lerp(hi[2], lo[2], t)];
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

function makeLunarEdge(seed = 10303) {
  const W = 256;
  const H = 32;
  const buf = Buffer.alloc(W * H * 4);
  const upper = [112, 18, 18];
  const goldLip = [234, 168, 34];
  const wall = [76, 11, 11];
  const wallLo = [36, 4, 4];

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const gloss = (periodicNoise(x, y, W, H, 16, 8, seed + 1) - 0.5) * 7.0;
      let rgb;
      if (y < 22) rgb = upper;
      else if (y === 22) rgb = [lerp(upper[0], goldLip[0], 0.78), lerp(upper[1], goldLip[1], 0.78), lerp(upper[2], goldLip[2], 0.78)];
      else if (y <= 24) rgb = goldLip;
      else if (y === 25) rgb = [lerp(goldLip[0], wall[0], 0.68), lerp(goldLip[1], wall[1], 0.68), lerp(goldLip[2], wall[2], 0.68)];
      else if (y <= 29) {
        const t = ((y - 26) / 3) * 0.4;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      } else {
        const t = 0.72 + (y - 30) * 0.28;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      }

      const i = (y * W + x) * 4;
      buf[i] = clampByte(rgb[0] + gloss);
      buf[i + 1] = clampByte(rgb[1] + gloss * 0.6);
      buf[i + 2] = clampByte(rgb[2] + gloss * 0.35);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: W, height: H };
}

function makeLunarFloorOverlay() {
  const S = 256;
  const P = 64;
  const buf = Buffer.alloc(S * S * 4);

  for (let y = 0; y < S; y++) {
    const uy = (y % P) - P * 0.5 + 0.5;
    for (let x = 0; x < S; x++) {
      const ux = (x % P) - P * 0.5 + 0.5;
      const ax = Math.abs(ux);
      const ay = Math.abs(uy);

      const manhattan = ax + ay;
      const outerDiamond = Math.exp(-(((manhattan - 24) / 1.45) ** 2)) * 0.24;
      const innerDiamond = Math.exp(-(((manhattan - 11) / 1.35) ** 2)) * 0.18;
      const centerPip = (1 - smoothstep(1.8, 3.6, Math.hypot(ax, ay))) * 0.30;
      const cellEdgeLink = Math.exp(-(((Math.abs(ax - 32) + Math.abs(ay - 32)) / 2.2) ** 2)) * 0.20;

      const a = Math.min(0.36, Math.max(outerDiamond, innerDiamond, centerPip, cellEdgeLink));
      const i = (y * S + x) * 4;
      buf[i] = 252;
      buf[i + 1] = 205;
      buf[i + 2] = 66;
      buf[i + 3] = clampByte(a * 255);
    }
  }
  return { buf, width: S, height: S };
}

function makeLunarFrameSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#B91C1C"/>
      <stop offset="55%" stop-color="#7F1D1D"/>
      <stop offset="100%" stop-color="#450A0A"/>
    </linearGradient>
    <clipPath id="cavity"><rect x="16" y="16" width="480" height="480" rx="25" ry="25"/></clipPath>
    <filter id="recess-blur" x="-10%" y="-10%" width="120%" height="120%"><feGaussianBlur stdDeviation="5"/></filter>
  </defs>
  <g clip-path="url(#cavity)">
    <rect x="9" y="11" width="494" height="494" rx="28" ry="28" fill="none" stroke="#280404" stroke-width="14" stroke-opacity="0.64" filter="url(#recess-blur)"/>
  </g>
  <path fill-rule="evenodd" fill="url(#rim)" d="
    M41 2 H471 A39 39 0 0 1 510 41 V471 A39 39 0 0 1 471 510 H41 A39 39 0 0 1 2 471 V41 A39 39 0 0 1 41 2 Z
    M41 16 H471 A25 25 0 0 1 496 41 V471 A25 25 0 0 1 471 496 H41 A25 25 0 0 1 16 471 V41 A25 25 0 0 1 41 16 Z
  "/>
  <rect x="2.5" y="2.5" width="507" height="507" rx="38.5" fill="none" stroke="#F59E0B" stroke-width="2.6"/>
  <rect x="9" y="9" width="494" height="494" rx="32" fill="none" stroke="#FDE68A" stroke-width="1.3" stroke-opacity="0.72"/>
  <rect x="16" y="16" width="480" height="480" rx="25" fill="none" stroke="#F59E0B" stroke-width="2" stroke-opacity="0.88"/>
  <path d="M41 5.5 H468 M5.5 41 V468" fill="none" stroke="#FEF3C7" stroke-width="1.6" stroke-opacity="0.7"/>
  <g fill="none" stroke="#FDE68A" stroke-width="2" stroke-linejoin="bevel">
    <rect x="17" y="17" width="11" height="11" rx="2"/>
    <rect x="484" y="17" width="11" height="11" rx="2"/>
    <rect x="17" y="484" width="11" height="11" rx="2"/>
    <rect x="484" y="484" width="11" height="11" rx="2"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// 5. BLOOM v2 (#eed9de blush pink paper + luminance-matched visible petals)
// ---------------------------------------------------------------------------
function buildToroidalPetals(size, gridN, density, rMin, rMax, seed) {
  const petals = [];
  const cell = size / gridN;
  for (let gy = 0; gy < gridN; gy++) {
    for (let gx = 0; gx < gridN; gx++) {
      if (hash2(gx, gy, seed + 1) > density) continue;
      const angle = hash2(gx, gy, seed + 4) * Math.PI;
      const rx = lerp(rMin, rMax, hash2(gx, gy, seed + 5));
      const ry = rx * lerp(0.46, 0.68, hash2(gx, gy, seed + 6));
      petals.push({
        x: (gx + 0.16 + 0.68 * hash2(gx, gy, seed + 2)) * cell,
        y: (gy + 0.16 + 0.68 * hash2(gx, gy, seed + 3)) * cell,
        rx,
        ry,
        cos: Math.cos(angle),
        sin: Math.sin(angle),
        kind: hash2(gx, gy, seed + 7) < 0.70 ? 0 : 1,
        alpha: lerp(0.50, 0.85, hash2(gx, gy, seed + 8)),
      });
    }
  }
  return petals;
}

function makeBloomFace({ base, paperHi, paperLo, petalRgb, leafRgb, petalWeight, maxLumSpan, seed }, scale = 1) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const maxHalfLum = maxLumSpan * scale * 0.5;
  const petals = buildToroidalPetals(S, 5, 0.60, 8.5, 16.5, seed + 40);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const ragBroad = periodicNoise(x, y, S, S, 8, 8, seed + 1);
      const ragFine = (periodicNoise(x, y, S, S, 36, 36, seed + 2) - 0.5) * 0.24;
      const t = Math.max(0, Math.min(1, 0.5 + ((ragBroad - 0.5) * 0.85 + ragFine) * scale));
      let r = lerp(paperHi[0], paperLo[0], t);
      let g = lerp(paperHi[1], paperLo[1], t);
      let b = lerp(paperHi[2], paperLo[2], t);

      for (let k = 0; k < petals.length; k++) {
        const p = petals[k];
        const dx = wrapDelta(x, p.x, S);
        if (Math.abs(dx) > p.rx) continue;
        const dy = wrapDelta(y, p.y, S);
        if (Math.abs(dy) > p.rx) continue;
        const u = dx * p.cos + dy * p.sin;
        const v = -dx * p.sin + dy * p.cos;
        const d = Math.hypot(u / p.rx, v / p.ry);
        if (d < 1) {
          const w = (1 - smoothstep(0.42, 1.0, d)) * p.alpha * petalWeight * scale;
          const tint = p.kind === 0 ? petalRgb : leafRgb;
          r = lerp(r, tint[0], w);
          g = lerp(g, tint[1], w);
          b = lerp(b, tint[2], w);
        }
      }

      const [cr, cg, cb] = clampRgbToLuminanceBand(base, [r, g, b], maxHalfLum);
      const i = (y * S + x) * 4;
      buf[i] = cr;
      buf[i + 1] = cg;
      buf[i + 2] = cb;
      buf[i + 3] = 255;
    }
  }
  return { buf, width: S, height: S };
}

function makeBloomEdge({ upper, bevelHi, wall, wallLo, grainAmp, seed }) {
  const W = 256;
  const H = 32;
  const buf = Buffer.alloc(W * H * 4);

  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const cotton = (periodicNoise(x, y, W, H, 24, 10, seed + 1) - 0.5) * grainAmp;
      let rgb;
      if (y < 22) rgb = upper;
      else if (y === 22) rgb = [lerp(upper[0], bevelHi[0], 0.72), lerp(upper[1], bevelHi[1], 0.72), lerp(upper[2], bevelHi[2], 0.72)];
      else if (y <= 24) rgb = bevelHi;
      else if (y === 25) rgb = [lerp(bevelHi[0], wall[0], 0.58), lerp(bevelHi[1], wall[1], 0.58), lerp(bevelHi[2], wall[2], 0.58)];
      else if (y <= 29) {
        const t = ((y - 26) / 3) * 0.34;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      } else {
        const t = 0.7 + (y - 30) * 0.3;
        rgb = [lerp(wall[0], wallLo[0], t), lerp(wall[1], wallLo[1], t), lerp(wall[2], wallLo[2], t)];
      }

      const i = (y * W + x) * 4;
      buf[i] = clampByte(rgb[0] + cotton);
      buf[i + 1] = clampByte(rgb[1] + cotton * 0.9);
      buf[i + 2] = clampByte(rgb[2] + cotton * 0.95);
      buf[i + 3] = 255;
    }
  }
  return { buf, width: W, height: H };
}

function makeBloomFloorOverlay({ petalRgb, leafRgb, maxAlpha, seed }) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  const petals = buildToroidalPetals(S, 4, 0.62, 10, 18, seed);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      let a = smoothstep(0.4, 0.9, periodicNoise(x, y, S, S, 6, 6, seed + 1)) * (maxAlpha * 0.25);
      let r = petalRgb[0];
      let g = petalRgb[1];
      let b = petalRgb[2];

      for (let k = 0; k < petals.length; k++) {
        const p = petals[k];
        const dx = wrapDelta(x, p.x, S);
        if (Math.abs(dx) > p.rx) continue;
        const dy = wrapDelta(y, p.y, S);
        if (Math.abs(dy) > p.rx) continue;
        const u = dx * p.cos + dy * p.sin;
        const v = -dx * p.sin + dy * p.cos;
        const d = Math.hypot(u / p.rx, v / p.ry);
        if (d < 1) {
          const pa = (1 - smoothstep(0.3, 1.0, d)) * p.alpha * maxAlpha;
          const tint = p.kind === 0 ? petalRgb : leafRgb;
          if (pa > a) {
            r = tint[0];
            g = tint[1];
            b = tint[2];
          }
          a = 1 - (1 - a) * (1 - pa);
        }
      }

      const i = (y * S + x) * 4;
      buf[i] = r;
      buf[i + 1] = g;
      buf[i + 2] = b;
      buf[i + 3] = clampByte(a * 255);
    }
  }
  return { buf, width: S, height: S };
}

function makeBloomFrameSvg(theme) {
  const t = theme === "light"
    ? {
        rimStart: "#FFF1F7", rimMid: "#FBCFE8", rimEnd: "#D9F99D",
        outerStroke: "#DB2777", innerStroke: "#9D174D", innerOpacity: 0.48,
        hiEdge: "#FFFFFF", hiOpacity: 0.96,
        recess: "#9D174D", recessOpacity: 0.24,
        petal: "#FFFFFF", petalOpacity: 0.85,
      }
    : {
        rimStart: "#831843", rimMid: "#500724", rimEnd: "#14532D",
        outerStroke: "#F472B6", innerStroke: "#1A0510", innerOpacity: 0.88,
        hiEdge: "#FBCFE8", hiOpacity: 0.44,
        recess: "#000000", recessOpacity: 0.6,
        petal: "#FBCFE8", petalOpacity: 0.56,
      };

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <linearGradient id="rim" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${t.rimStart}"/>
      <stop offset="56%" stop-color="${t.rimMid}"/>
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
  <rect x="2" y="2" width="508" height="508" rx="39" fill="none" stroke="${t.outerStroke}" stroke-width="2" stroke-opacity="0.72"/>
  <rect x="14" y="14" width="484" height="484" rx="27" fill="none" stroke="${t.innerStroke}" stroke-width="1.6" stroke-opacity="${t.innerOpacity}"/>
  <path d="M41 4.5 H468 M4.5 41 V468" fill="none" stroke="${t.hiEdge}" stroke-width="2" stroke-opacity="${t.hiOpacity}"/>
  <g fill="${t.petal}" fill-opacity="${t.petalOpacity}">
    <path d="M36 9 L44 6 L50 9 L44 12 Z"/><path d="M9 36 L6 44 L9 50 L12 44 Z"/>
    <path d="M476 9 L468 6 L462 9 L468 12 Z"/><path d="M503 36 L506 44 L503 50 L500 44 Z"/>
    <path d="M36 503 L44 506 L50 503 L44 500 Z"/><path d="M9 476 L6 468 L9 462 L12 468 Z"/>
    <path d="M476 503 L468 506 L462 503 L468 500 Z"/><path d="M503 476 L506 468 L503 462 L500 468 Z"/>
  </g>
</svg>`;
}

// ---------------------------------------------------------------------------
// Post-decode verification & closed-loop encoders
// ---------------------------------------------------------------------------
async function inspectDecodedWebp(filePath, { checkY = true } = {}) {
  const fileBuf = await fs.readFile(filePath);
  const { data, info } = await sharp(fileBuf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;

  let minL = 1;
  let maxL = 0;
  let sumG = 0;
  let sumG2 = 0;
  const n = w * h;

  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
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

async function generateAndVerifyFace(filename, buildRaw) {
  const outPath = path.join(OUT_DIR, filename);
  let scale = 1.0;
  let lastResult = null;
  let lastMetrics = null;

  for (let attempt = 0; attempt < 10; attempt++) {
    const raw = buildRaw(scale);
    const { bytes } = await encodeUnderBudget(
      () => sharp(raw.buf, { raw: { width: raw.width, height: raw.height, channels: 4 } }),
      outPath,
      false,
    );
    const metrics = await inspectDecodedWebp(outPath);
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
// Main pipeline (Midnight, Neon, Harvest, Lunar, Bloom = 28 WebP files)
// ---------------------------------------------------------------------------
async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const [
    midFaceL, midFaceD,
    neonFace,
    harvFaceL, harvFaceD,
    lunarFace,
    bloomFaceL, bloomFaceD,
  ] = await Promise.all([
    generateAndVerifyFace("tile-face-midnight-light.webp", (scale) => makeMidnightFace({
      base: [212, 218, 246], slateHi: [220, 225, 250], slateLo: [204, 210, 241],
      micaLight: [255, 255, 255], micaDark: [148, 156, 218], dotScale: 1.05, maxLumSpan: 0.056, seed: 7101,
    }, scale)),
    generateAndVerifyFace("tile-face-midnight-dark.webp", (scale) => makeMidnightFace({
      base: [26, 28, 58], slateHi: [36, 39, 76], slateLo: [16, 18, 42],
      micaLight: [108, 118, 178], micaDark: [10, 10, 28], dotScale: 1.0, maxLumSpan: 0.046, seed: 7202,
    }, scale)),
    generateAndVerifyFace("tile-face-neon.webp", (scale) => makeNeonFace(8101, scale)),
    generateAndVerifyFace("tile-face-harvest-light.webp", (scale) => makeHarvestFace({
      base: [217, 196, 150], paperHi: [226, 206, 160], paperLo: [207, 185, 138],
      fiberWeight: 0.38, fleckWeight: 0.30, maxLumSpan: 0.056, seed: 9101,
    }, scale)),
    generateAndVerifyFace("tile-face-harvest-dark.webp", (scale) => makeHarvestFace({
      base: [40, 22, 14], paperHi: [56, 32, 20], paperLo: [24, 13, 8],
      fiberWeight: 0.38, fleckWeight: 0.28, maxLumSpan: 0.044, seed: 9202,
    }, scale)),
    generateAndVerifyFace("tile-face-lunar.webp", (scale) => makeLunarFace(10101, scale)),
    generateAndVerifyFace("tile-face-bloom-light.webp", (scale) => makeBloomFace({
      base: [238, 217, 222], paperHi: [243, 223, 228], paperLo: [233, 211, 216],
      // Luminance-matched rose & sage tints keep vivid chroma inside the 7.2% luminance cap
      petalRgb: [255, 202, 230], leafRgb: [200, 228, 168], petalWeight: 0.82, maxLumSpan: 0.056, seed: 11101,
    }, scale)),
    generateAndVerifyFace("tile-face-bloom-dark.webp", (scale) => makeBloomFace({
      base: [42, 16, 34], paperHi: [58, 24, 48], paperLo: [26, 9, 22],
      petalRgb: [124, 38, 84], leafRgb: [38, 72, 40], petalWeight: 0.42, maxLumSpan: 0.044, seed: 11202,
    }, scale)),
  ]);

  const otherResults = await Promise.all([
    // Midnight (4)
    saveRawWebp("tile-edge-midnight-light.webp", makeMidnightEdge({ upper: [142, 150, 208], bevelHi: [192, 200, 242], wall: [129, 137, 196], wallLo: [84, 92, 148], grainAmp: 8, seed: 7303 })),
    saveRawWebp("tile-edge-midnight-dark.webp", makeMidnightEdge({ upper: [26, 24, 56], bevelHi: [78, 84, 148], wall: [20, 18, 46], wallLo: [9, 8, 24], grainAmp: 7, seed: 7404 })),
    saveRawWebp("tray-floor-midnight.webp", makeMidnightFloorOverlay(7505), { hasAlpha: true }),
    saveSvgWebp("tray-frame-midnight.webp", makeMidnightFrameSvg()),

    // Neon (3)
    saveRawWebp("tile-edge-neon.webp", makeNeonEdge(8303)),
    saveRawWebp("tray-floor-neon.webp", makeNeonFloor()),
    saveSvgWebp("tray-frame-neon.webp", makeNeonFrameSvg()),

    // Harvest (4)
    saveRawWebp("tile-edge-harvest-light.webp", makeHarvestEdge({ upper: [204, 146, 72], bevelHi: [240, 196, 126], wall: [194, 134, 58], wallLo: [128, 76, 26], grainAmp: 9, seed: 9303 })),
    saveRawWebp("tile-edge-harvest-dark.webp", makeHarvestEdge({ upper: [38, 22, 12], bevelHi: [96, 56, 28], wall: [28, 16, 8], wallLo: [14, 7, 4], grainAmp: 7, seed: 9404 })),
    saveRawWebp("tray-floor-harvest.webp", makeHarvestFloorOverlay(9505), { hasAlpha: true }),
    saveSvgWebp("tray-frame-harvest.webp", makeHarvestFrameSvg()),

    // Lunar (3)
    saveRawWebp("tile-edge-lunar.webp", makeLunarEdge(10303)),
    saveRawWebp("tray-floor-lunar.webp", makeLunarFloorOverlay(), { hasAlpha: true }),
    saveSvgWebp("tray-frame-lunar.webp", makeLunarFrameSvg()),

    // Bloom (6)
    saveRawWebp("tile-edge-bloom-light.webp", makeBloomEdge({ upper: [232, 156, 186], bevelHi: [252, 212, 230], wall: [224, 143, 174], wallLo: [168, 86, 122], grainAmp: 7, seed: 11303 })),
    saveRawWebp("tile-edge-bloom-dark.webp", makeBloomEdge({ upper: [46, 20, 48], bevelHi: [118, 56, 102], wall: [32, 14, 36], wallLo: [16, 7, 19], grainAmp: 6, seed: 11404 })),
    saveRawWebp("tray-floor-bloom-light.webp", makeBloomFloorOverlay({ petalRgb: [255, 255, 255], leafRgb: [236, 252, 203], maxAlpha: 0.42, seed: 11505 }), { hasAlpha: true }),
    saveRawWebp("tray-floor-bloom-dark.webp", makeBloomFloorOverlay({ petalRgb: [244, 114, 182], leafRgb: [134, 239, 172], maxAlpha: 0.18, seed: 11606 }), { hasAlpha: true }),
    saveSvgWebp("tray-frame-bloom-light.webp", makeBloomFrameSvg("light")),
    saveSvgWebp("tray-frame-bloom-dark.webp", makeBloomFrameSvg("dark")),
  ]);

  const faceChecks = [
    { label: "midnight-L", ...midFaceL,   inks: [[2, 8, 23], [30, 27, 75]],      dark: false, minCR: 7.0 },
    { label: "midnight-D", ...midFaceD,   inks: [[248, 250, 252], [224, 231, 255]], dark: true,  minCR: 7.0 },
    { label: "neon",       ...neonFace,   inks: [[248, 250, 252], [207, 250, 254]], dark: true,  minCR: 7.0 },
    { label: "harvest-L",  ...harvFaceL,  inks: [[2, 8, 23], [67, 20, 7]],       dark: false, minCR: 7.0 },
    { label: "harvest-D",  ...harvFaceD,  inks: [[248, 250, 252], [255, 237, 213]], dark: true,  minCR: 7.0 },
    { label: "lunar",      ...lunarFace,  inks: [[254, 243, 199], [253, 230, 138]], dark: true,  minCR: 5.5 },
    { label: "bloom-L",    ...bloomFaceL, inks: [[2, 8, 23], [80, 7, 36]],       dark: false, minCR: 7.0 },
    { label: "bloom-D",    ...bloomFaceD, inks: [[248, 250, 252], [252, 231, 243]], dark: true,  minCR: 7.0 },
  ];

  const seamIndices = [
    [0, "midnight-edge-L", false], [1, "midnight-edge-D", false], [2, "midnight-floor", true],
    [4, "neon-edge", false], [5, "neon-floor", true],
    [7, "harvest-edge-L", false], [8, "harvest-edge-D", false], [9, "harvest-floor", true],
    [11, "lunar-edge", false], [12, "lunar-floor", true],
    [14, "bloom-edge-L", false], [15, "bloom-edge-D", false], [16, "bloom-floor-L", true], [17, "bloom-floor-D", true],
  ];
  const frameIndices = [
    [3, "midnight-frame"], [6, "neon-frame"], [10, "harvest-frame"],
    [13, "lunar-frame"], [18, "bloom-frame-L"], [19, "bloom-frame-D"],
  ];

  const seamChecks = await Promise.all(
    seamIndices.map(([idx, label, checkY]) => inspectDecodedWebp(otherResults[idx].outPath, { checkY }).then((m) => [label, m])),
  );
  const frameChecks = await Promise.all(
    frameIndices.map(([idx, label]) => verifyFrameInteriorTransparent(otherResults[idx].outPath, 64).then((a) => [label, a])),
  );

  const allResults = [...faceChecks.map((f) => f.result), ...otherResults];
  const failures = [];

  for (const r of allResults) {
    if (r.bytes >= MAX_FILE_BYTES) failures.push(`${r.filename}: ${r.kb} KB exceeds 20 KB cap`);
  }

  const totalKb = +allResults.reduce((s, r) => s + r.kb, 0).toFixed(1);
  console.log(`\nBatch 3 v2 board skins (Midnight, Neon, Harvest, Lunar, Bloom) written to ${OUT_DIR} (${allResults.length} files, ${totalKb} KB total)`);
  console.table(allResults.map((r) => ({ file: r.filename, kb: r.kb, under20KB: r.bytes < MAX_FILE_BYTES ? "PASS" : "FAIL" })));

  console.log("Post-WebP decoded A1 face gates:");
  for (const f of faceChecks) {
    const faceL = f.dark ? f.metrics.maxL : f.metrics.minL;
    const crs = f.inks.map(([r, g, b]) => +contrastRatio(faceL, relLuminance(r, g, b)).toFixed(2));
    const minCR = Math.min(...crs);
    console.log(`  ${f.label.padEnd(11)}: lumDelta=${f.metrics.lumDeltaPct}% (<8%), grainStd=${f.metrics.grainStdRgb} RGB, contrast=${crs.join(" / ")}:1 (>=${f.minCR}:1), scale=${f.result.scale}, seam=${f.metrics.seamPmDelta}/${f.metrics.maxInteriorStep}`);

    if (f.metrics.lumDeltaPct >= MAX_LUM_DELTA_PCT) failures.push(`${f.label} lumDelta ${f.metrics.lumDeltaPct}% >= ${MAX_LUM_DELTA_PCT}%`);
    if (minCR < f.minCR) failures.push(`${f.label} contrast ${minCR}:1 < ${f.minCR}:1`);
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

    const makeGradTray = async (svgBg, overlayFile, frameFile) => sharp(Buffer.from(svgBg))
      .composite([
        { input: await tile2x2(overlayFile) },
        { input: await sharp(await fs.readFile(path.join(OUT_DIR, frameFile))).resize(256, 256).toBuffer() },
      ])
      .png()
      .toBuffer();

    const gradSvg = (c1, c2) => `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="15%" y1="0%" x2="85%" y2="100%"><stop offset="0%" stop-color="${c1}"/><stop offset="100%" stop-color="${c2}"/></linearGradient></defs><rect width="256" height="256" fill="url(#g)"/></svg>`;
    const harvestBg = `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256"><defs><linearGradient id="g" x1="10%" y1="0%" x2="90%" y2="100%"><stop offset="0%" stop-color="#4c1d95"/><stop offset="100%" stop-color="#7c2d12"/></linearGradient><radialGradient id="m" cx="88%" cy="10%" r="16%"><stop offset="0%" stop-color="#fef3c7"/><stop offset="55%" stop-color="#fcd34d"/><stop offset="100%" stop-color="#fcd34d" stop-opacity="0"/></radialGradient></defs><rect width="256" height="256" fill="url(#g)"/><rect width="256" height="256" fill="url(#m)"/></svg>`;

    const rows = [
      {
        f1: await tile2x2("tile-face-midnight-light.webp"),
        f2: await tile2x2("tile-face-midnight-dark.webp"),
        t1: await makeGradTray(gradSvg("#3730a3", "#1e1b4b"), "tray-floor-midnight.webp", "tray-frame-midnight.webp"),
        t2: await makeGradTray(gradSvg("#3730a3", "#1e1b4b"), "tray-floor-midnight.webp", "tray-frame-midnight.webp"),
        e1: "tile-edge-midnight-light.webp",
        e2: "tile-edge-midnight-dark.webp",
      },
      {
        f1: await tile2x2("tile-face-neon.webp"),
        f2: await tile2x2("tile-face-neon.webp"),
        t1: await sharp(await tile2x2("tray-floor-neon.webp")).composite([{ input: await sharp(await fs.readFile(path.join(OUT_DIR, "tray-frame-neon.webp"))).resize(256, 256).toBuffer() }]).png().toBuffer(),
        t2: await sharp(await tile2x2("tray-floor-neon.webp")).composite([{ input: await sharp(await fs.readFile(path.join(OUT_DIR, "tray-frame-neon.webp"))).resize(256, 256).toBuffer() }]).png().toBuffer(),
        e1: "tile-edge-neon.webp",
        e2: "tile-edge-neon.webp",
      },
      {
        f1: await tile2x2("tile-face-harvest-light.webp"),
        f2: await tile2x2("tile-face-harvest-dark.webp"),
        t1: await makeGradTray(harvestBg, "tray-floor-harvest.webp", "tray-frame-harvest.webp"),
        t2: await makeGradTray(harvestBg, "tray-floor-harvest.webp", "tray-frame-harvest.webp"),
        e1: "tile-edge-harvest-light.webp",
        e2: "tile-edge-harvest-dark.webp",
      },
      {
        f1: await tile2x2("tile-face-lunar.webp"),
        f2: await tile2x2("tile-face-lunar.webp"),
        t1: await makeGradTray(gradSvg("#991b1b", "#450a0a"), "tray-floor-lunar.webp", "tray-frame-lunar.webp"),
        t2: await makeGradTray(gradSvg("#991b1b", "#450a0a"), "tray-floor-lunar.webp", "tray-frame-lunar.webp"),
        e1: "tile-edge-lunar.webp",
        e2: "tile-edge-lunar.webp",
      },
      {
        f1: await tile2x2("tile-face-bloom-light.webp"),
        f2: await tile2x2("tile-face-bloom-dark.webp"),
        t1: await makeGradTray(gradSvg("#fbcfe8", "#bbf7d0"), "tray-floor-bloom-light.webp", "tray-frame-bloom-light.webp"),
        t2: await makeGradTray(gradSvg("#500724", "#14532d"), "tray-floor-bloom-dark.webp", "tray-frame-bloom-dark.webp"),
        e1: "tile-edge-bloom-light.webp",
        e2: "tile-edge-bloom-dark.webp",
      },
    ];

    const composites = [];
    for (let r = 0; r < rows.length; r++) {
      const y = r * 256;
      const row = rows[r];
      composites.push(
        { input: row.f1, left: 0, top: y },
        { input: row.f2, left: 256, top: y },
        { input: row.t1, left: 512, top: y },
        { input: row.t2, left: 768, top: y },
        { input: await sharp(await fs.readFile(path.join(OUT_DIR, row.e1))).resize(256, 64).toBuffer(), left: 1024, top: y + 48 },
        { input: await sharp(await fs.readFile(path.join(OUT_DIR, row.e2))).resize(256, 64).toBuffer(), left: 1024, top: y + 144 },
      );
    }

    const qaPath = path.join(QA_DIR, "qa-skins-batch3.png");
    await sharp({ create: { width: 1280, height: 1280, channels: 4, background: { r: 15, g: 23, b: 42, alpha: 1 } } })
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
