#!/usr/bin/env node
/**
 * Generates the special-tile art into public/assets/special/: one surface
 * overlay per special tile (three for Multiplier, one per value, and a light
 * and a dark one for Ghost) plus the light-mode frost texture. The overlays sit
 * on top of the tile gradients in GameTile.tsx; they do not replace them. The
 * output is committed; this script is not part of the build. Re-run it after
 * changing any of the art below:
 *
 *   node scripts/generate-special-tiles.mjs          write the 17 files
 *   node scripts/generate-special-tiles.mjs --qa     also write a contact sheet to .tmp/
 *
 * Every file is re-read after it is written. The script exits non-zero if a
 * file reaches 20 KB, if a surface lowers letter contrast in the letter zone
 * by more than 0.15, or if the frost texture shows a seam when tiled.
 *
 * The letter zone is 27% to 72% of the tile's width and 31% to 68% of its
 * height. That is the ink of the widest and tallest letters (W, M, Q, J, ?)
 * measured on real tiles, from a 5x5 board on a 320 px phone up to desktop.
 * Art outside the zone may be as strong as it likes. On landscape phones the
 * letters are larger than the zone; see the note on .tile-special-surface in
 * src/index.css.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const OUT_DIR = path.resolve("public/assets/special");
const QA_DIR = path.resolve(".tmp");
const QA_MODE = process.argv.includes("--qa");

const MAX_FILE_BYTES = 20 * 1024;
const TARGET_FILE_BYTES = 16 * 1024;
const MAX_CONTRAST_DROP = 0.15;
// The part of the tile a letter can cover, as shares of its width and height
// (see the header for where the numbers come from).
const LETTER_ZONE = { x: [0.27, 0.72], y: [0.31, 0.68] };

// Exact live Tailwind stops & text colors from src/components/game/GameTile.tsx
const LIVE_TILE_PALETTES = {
  stone:           { from: [107, 114, 128], to: [55, 65, 81],    text: [255, 255, 255] },
  wild:            { from: [168, 85, 247],  via: [236, 72, 153], to: [239, 68, 68], text: [255, 255, 255] },
  xfactor:         { from: [249, 115, 22],  to: [220, 38, 38],   text: [255, 255, 255] },
  "multiplier-2x": { from: [59, 130, 246],  to: [29, 78, 216],   text: [255, 255, 255] },
  "multiplier-3x": { from: [59, 130, 246],  to: [29, 78, 216],   text: [255, 255, 255] },
  "multiplier-4x": { from: [59, 130, 246],  to: [29, 78, 216],   text: [255, 255, 255] },
  shuffle:         { from: [254, 202, 202], to: [252, 165, 165], text: [127, 29, 29] },
  freeze:          { from: [165, 243, 252], to: [147, 197, 253], text: [23, 37, 84] },
  decay:           { from: [254, 240, 138], to: [74, 222, 128],  text: [5, 46, 22] },
  mirror:          { from: [229, 231, 235], to: [156, 163, 175], text: [17, 24, 39] },
  magnet:          { from: [239, 68, 68],   to: [75, 85, 99],    text: [255, 255, 255] },
  bomb:            { from: [220, 38, 38],   to: [17, 24, 39],    text: [255, 255, 255], round: true },
  chain:           { from: [217, 119, 6],   to: [146, 64, 14],   text: [255, 255, 255] },
  "ghost-light":   { from: [255, 255, 255], to: [229, 231, 235], text: [55, 65, 81] },
  "ghost-dark":    { from: [51, 65, 85],    to: [30, 41, 59],    text: [229, 231, 235] },
  tax:             { from: [253, 224, 71],  to: [234, 179, 8],   text: [66, 32, 6] },
};

// ---------------------------------------------------------------------------
// Deterministic periodic noise helpers
// ---------------------------------------------------------------------------
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) ^ Math.imul(iy, 668265263) ^ Math.imul(seed, 2246822519);
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

function fade(t) {
  return t * t * t * (t * (t * 6 - 15) + 10);
}

function periodicNoise(x, y, size, period, seed) {
  const gx = (x / size) * period;
  const gy = (y / size) * period;
  const x0 = Math.floor(gx) % period;
  const y0 = Math.floor(gy) % period;
  const x1 = (x0 + 1) % period;
  const y1 = (y0 + 1) % period;
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

function sampleTileGradient(spec, x, y, S) {
  const t = Math.max(0, Math.min(1, (x + y) / (2 * (S - 1))));
  if (!spec.via) {
    return [lerp(spec.from[0], spec.to[0], t), lerp(spec.from[1], spec.to[1], t), lerp(spec.from[2], spec.to[2], t)];
  }
  if (t < 0.5) {
    const u = t * 2;
    return [lerp(spec.from[0], spec.via[0], u), lerp(spec.from[1], spec.via[1], u), lerp(spec.from[2], spec.via[2], u)];
  }
  const u = (t - 0.5) * 2;
  return [lerp(spec.via[0], spec.to[0], u), lerp(spec.via[1], spec.to[1], u), lerp(spec.via[2], spec.to[2], u)];
}

// Soft low-entropy stone/corrosion grain (compresses cleanly with lossy alpha)
function makeGrainLayer({ rgb, maxAlpha, period, rimOnly = false, seed }) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const n1 = periodicNoise(x, y, S, period, seed);
      const n2 = periodicNoise(x, y, S, period * 2, seed + 5);
      let a = (n1 * 0.72 + n2 * 0.28) * maxAlpha;
      if (rimOnly) {
        const edgeDist = Math.min(x, y, S - 1 - x, S - 1 - y) / (S * 0.5);
        a *= 1 - smoothstep(0.14, 0.44, edgeDist);
      }
      const i = (y * S + x) * 4;
      buf[i] = rgb[0];
      buf[i + 1] = rgb[1];
      buf[i + 2] = rgb[2];
      buf[i + 3] = clampByte(a * 255);
    }
  }
  return buf;
}

// ---------------------------------------------------------------------------
// B1: 16 Special Tile Object-Motif Surfaces (256x256, center letter protected)
// ---------------------------------------------------------------------------
const SURFACE_SVGS = {
  // Carved monolithic rock slab with beveled quarry faces and fissure cracks
  stone: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <!-- Stepped stone block bevels -->
    <polygon points="0,0 256,0 236,20 20,20" fill="#FFFFFF" fill-opacity="0.2"/>
    <polygon points="0,0 20,20 20,236 0,256" fill="#FFFFFF" fill-opacity="0.14"/>
    <polygon points="256,0 256,256 236,236 236,20" fill="#0F172A" fill-opacity="0.36"/>
    <polygon points="0,256 20,236 236,236 256,256" fill="#0F172A" fill-opacity="0.44"/>
    <!-- Chiseled inner quarry rock planes (dark-tinted so white text gains contrast) -->
    <polygon points="20,20 236,20 236,236 20,236" fill="#111827" fill-opacity="0.1"/>
    <polygon points="20,20 128,20 72,58 20,96" fill="#0F172A" fill-opacity="0.14"/>
    <polygon points="236,236 128,236 184,198 236,160" fill="#0F172A" fill-opacity="0.22"/>
    <rect x="20" y="20" width="216" height="216" fill="none" stroke="#0F172A" stroke-width="2.2" stroke-opacity="0.42"/>
    <!-- Quarry fissure cracks entering from the perimeter -->
    <g fill="none" stroke-linejoin="bevel">
      <polyline points="0,84 26,78 44,94 54,88" stroke="#0F172A" stroke-width="3.4" stroke-opacity="0.62"/>
      <polyline points="0,87 26,81 44,97" stroke="#FFFFFF" stroke-width="1.4" stroke-opacity="0.22"/>
      <polyline points="170,0 162,26 176,42 170,54" stroke="#0F172A" stroke-width="3.2" stroke-opacity="0.58"/>
      <polyline points="256,162 228,170 212,154 202,160" stroke="#0F172A" stroke-width="3.4" stroke-opacity="0.62"/>
      <polyline points="72,256 84,226 74,210" stroke="#0F172A" stroke-width="3.2" stroke-opacity="0.54"/>
    </g>
  </svg>`,

  wild: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <radialGradient id="w-c" cx="50%" cy="50%" r="52%">
      <stop offset="0%" stop-color="#1E0542" stop-opacity="0.14"/>
      <stop offset="68%" stop-color="#1E0542" stop-opacity="0.06"/>
      <stop offset="100%" stop-color="#1E0542" stop-opacity="0.24"/>
    </radialGradient>
    <rect width="256" height="256" fill="url(#w-c)"/>
    <rect x="8" y="8" width="240" height="240" rx="22" fill="none" stroke="#FFFFFF" stroke-width="2.5" stroke-opacity="0.38"/>
    <rect x="16" y="16" width="224" height="224" rx="16" fill="none" stroke="#FEF08A" stroke-width="1.5" stroke-opacity="0.28" stroke-dasharray="18 10"/>
    <polygon points="128,11 138,18 128,25 118,18" fill="#FFFFFF" fill-opacity="0.45"/>
    <polygon points="128,231 138,238 128,245 118,238" fill="#FEF08A" fill-opacity="0.38"/>
    <polygon points="11,128 18,118 25,128 18,138" fill="#FFFFFF" fill-opacity="0.42"/>
    <polygon points="231,128 238,118 245,128 238,138" fill="#BAE6FD" fill-opacity="0.42"/>
  </svg>`,

  xfactor: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <radialGradient id="x-c" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#450A0A" stop-opacity="0.16"/>
      <stop offset="70%" stop-color="#450A0A" stop-opacity="0.08"/>
      <stop offset="100%" stop-color="#450A0A" stop-opacity="0.26"/>
    </radialGradient>
    <rect width="256" height="256" fill="url(#x-c)"/>
    <g stroke="#450A0A" stroke-width="3" stroke-opacity="0.34" stroke-linecap="square">
      <line x1="22" y1="22" x2="54" y2="54"/>
      <line x1="234" y1="22" x2="202" y2="54"/>
      <line x1="22" y1="234" x2="54" y2="202"/>
      <line x1="234" y1="234" x2="202" y2="202"/>
    </g>
    <g stroke="#FEF3C7" stroke-width="1.5" stroke-opacity="0.34" stroke-linecap="square">
      <line x1="26" y1="22" x2="54" y2="50"/>
      <line x1="230" y1="22" x2="202" y2="50"/>
      <line x1="26" y1="234" x2="54" y2="206"/>
      <line x1="230" y1="234" x2="202" y2="206"/>
    </g>
    <rect x="8" y="8" width="240" height="240" rx="22" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.28"/>
  </svg>`,

  // Multiplier Cut 1 (2x): Emerald-cut octagonal faceted sapphire gem
  "multiplier-2x": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <!-- 8 stepped crown facets around a calm dark-tinted emerald table -->
    <polygon points="56,12 200,12 184,38 72,38" fill="#FFFFFF" fill-opacity="0.2"/>
    <polygon points="12,56 56,12 72,38 38,72" fill="#FFFFFF" fill-opacity="0.28"/>
    <polygon points="12,200 12,56 38,72 38,184" fill="#FFFFFF" fill-opacity="0.1"/>
    <polygon points="200,12 244,56 218,72 184,38" fill="#1E3A8A" fill-opacity="0.16"/>
    <polygon points="244,56 244,200 218,184 218,72" fill="#0F172A" fill-opacity="0.28"/>
    <polygon points="244,200 200,244 184,218 218,184" fill="#0F172A" fill-opacity="0.36"/>
    <polygon points="200,244 56,244 72,218 184,218" fill="#0F172A" fill-opacity="0.3"/>
    <polygon points="56,244 12,200 38,184 72,218" fill="#1E3A8A" fill-opacity="0.2"/>
    <!-- Recessed gem table keeps white letter contrast high -->
    <polygon points="72,38 184,38 218,72 218,184 184,218 72,218 38,184 38,72" fill="#0F172A" fill-opacity="0.1"/>
    <!-- Crisp gem facet ridges -->
    <g fill="none" stroke-linejoin="bevel">
      <polygon points="56,12 200,12 244,56 244,200 200,244 56,244 12,200 12,56" stroke="#BAE6FD" stroke-width="2.2" stroke-opacity="0.5"/>
      <polygon points="72,38 184,38 218,72 218,184 184,218 72,218 38,184 38,72" stroke="#FFFFFF" stroke-width="1.8" stroke-opacity="0.4"/>
      <line x1="56" y1="12" x2="72" y2="38" stroke="#FFFFFF" stroke-width="1.8" stroke-opacity="0.4"/>
      <line x1="200" y1="12" x2="184" y2="38" stroke="#FFFFFF" stroke-width="1.8" stroke-opacity="0.32"/>
      <line x1="244" y1="56" x2="218" y2="72" stroke="#0F172A" stroke-width="1.8" stroke-opacity="0.36"/>
      <line x1="244" y1="200" x2="218" y2="184" stroke="#0F172A" stroke-width="1.8" stroke-opacity="0.4"/>
      <line x1="200" y1="244" x2="184" y2="218" stroke="#0F172A" stroke-width="1.8" stroke-opacity="0.4"/>
      <line x1="56" y1="244" x2="72" y2="218" stroke="#0F172A" stroke-width="1.8" stroke-opacity="0.34"/>
      <line x1="12" y1="200" x2="38" y2="184" stroke="#0F172A" stroke-width="1.8" stroke-opacity="0.32"/>
      <line x1="12" y1="56" x2="38" y2="72" stroke="#FFFFFF" stroke-width="1.8" stroke-opacity="0.42"/>
    </g>
  </svg>`,

  // Multiplier Cut 2 (3x): Hexagonal brilliant-cut gem with pointed cardinal bezel
  "multiplier-3x": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <!-- 6 pointed brilliant facets framing a dark-cushioned hexagonal table -->
    <polygon points="128,8 26,66 56,84 128,42" fill="#FFFFFF" fill-opacity="0.28"/>
    <polygon points="26,66 26,190 56,172 56,84" fill="#FFFFFF" fill-opacity="0.14"/>
    <polygon points="128,8 230,66 200,84 128,42" fill="#BAE6FD" fill-opacity="0.14"/>
    <polygon points="230,66 230,190 200,172 200,84" fill="#0F172A" fill-opacity="0.28"/>
    <polygon points="230,190 128,248 128,214 200,172" fill="#0F172A" fill-opacity="0.38"/>
    <polygon points="26,190 128,248 128,214 56,172" fill="#0F172A" fill-opacity="0.22"/>
    <polygon points="128,42 200,84 200,172 128,214 56,172 56,84" fill="#0F172A" fill-opacity="0.12"/>
    <g fill="none" stroke-linejoin="bevel">
      <polygon points="128,8 230,66 230,190 128,248 26,190 26,66" stroke="#BAE6FD" stroke-width="2.4" stroke-opacity="0.56"/>
      <polygon points="128,42 200,84 200,172 128,214 56,172 56,84" stroke="#FFFFFF" stroke-width="1.8" stroke-opacity="0.46"/>
      <line x1="128" y1="8" x2="128" y2="42" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.48"/>
      <line x1="26" y1="66" x2="56" y2="84" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.45"/>
      <line x1="230" y1="66" x2="200" y2="84" stroke="#0F172A" stroke-width="1.8" stroke-opacity="0.36"/>
      <line x1="230" y1="190" x2="200" y2="172" stroke="#0F172A" stroke-width="1.8" stroke-opacity="0.42"/>
      <line x1="128" y1="248" x2="128" y2="214" stroke="#0F172A" stroke-width="1.8" stroke-opacity="0.42"/>
      <line x1="26" y1="190" x2="56" y2="172" stroke="#0F172A" stroke-width="1.8" stroke-opacity="0.34"/>
    </g>
  </svg>`,

  // Multiplier Cut 3 (4x): 8-point Radiant Star-cut royal jewel
  "multiplier-4x": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <!-- 8-point star crown silhouette radiating around an octagonal center table -->
    <g stroke-linejoin="bevel">
      <polygon points="128,6 154,32 128,46 102,32" fill="#FFFFFF" fill-opacity="0.3"/>
      <polygon points="214,42 214,76 186,70 180,42" fill="#BAE6FD" fill-opacity="0.22"/>
      <polygon points="250,128 224,154 210,128 224,102" fill="#0F172A" fill-opacity="0.28"/>
      <polygon points="214,214 180,214 186,186 214,180" fill="#0F172A" fill-opacity="0.38"/>
      <polygon points="128,250 102,224 128,210 154,224" fill="#0F172A" fill-opacity="0.34"/>
      <polygon points="42,214 42,180 70,186 76,214" fill="#0F172A" fill-opacity="0.24"/>
      <polygon points="6,128 32,102 46,128 32,154" fill="#FFFFFF" fill-opacity="0.22"/>
      <polygon points="42,42 76,42 70,70 42,76" fill="#FFFFFF" fill-opacity="0.32"/>
    </g>
    <!-- Deep radiant octagon table cushion -->
    <polygon points="94,46 162,46 210,94 210,162 162,210 94,210 46,162 46,94" fill="#0F172A" fill-opacity="0.14"/>
    <g fill="none" stroke-linejoin="bevel">
      <polygon points="128,6 154,32 214,42 214,76 250,128 224,154 214,214 180,214 128,250 102,224 42,214 42,180 6,128 32,102 42,42 76,42" stroke="#E0F2FE" stroke-width="2.2" stroke-opacity="0.58"/>
      <polygon points="94,46 162,46 210,94 210,162 162,210 94,210 46,162 46,94" stroke="#FFFFFF" stroke-width="1.8" stroke-opacity="0.52"/>
    </g>
  </svg>`,

  magnet: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <radialGradient id="mg-c" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#111827" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#111827" stop-opacity="0.26"/>
    </radialGradient>
    <rect width="256" height="256" fill="url(#mg-c)"/>
    <rect x="8" y="8" width="240" height="240" rx="22" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.26"/>
    <g fill="none" stroke="#FFFFFF" stroke-opacity="0.24" stroke-width="2.4" stroke-dasharray="10 8">
      <path d="M22,82 A58,58 0 0 1 22,174"/>
      <path d="M36,96 A44,44 0 0 1 36,160"/>
      <path d="M234,82 A58,58 0 0 0 234,174"/>
      <path d="M220,96 A44,44 0 0 0 220,160"/>
    </g>
  </svg>`,

  // Smooth cast-iron round shell (crescent pushed to r=110, completely outside center letter zone)
  bomb: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <radialGradient id="b-sh" cx="38%" cy="34%" r="64%">
      <stop offset="0%" stop-color="#000000" stop-opacity="0"/>
      <stop offset="68%" stop-color="#000000" stop-opacity="0.12"/>
      <stop offset="100%" stop-color="#000000" stop-opacity="0.48"/>
    </radialGradient>
    <circle cx="128" cy="128" r="128" fill="url(#b-sh)"/>
    <path d="M24,104 A108,108 0 0 1 112,20" fill="none" stroke="#FFFFFF" stroke-width="5.5" stroke-opacity="0.28" stroke-linecap="round"/>
    <circle cx="128" cy="128" r="118" fill="none" stroke="#FFFFFF" stroke-width="2" stroke-opacity="0.2"/>
    <circle cx="128" cy="128" r="106" fill="none" stroke="#000000" stroke-width="2" stroke-opacity="0.34" stroke-dasharray="14 10"/>
  </svg>`,

  // Forged interlocking chain-link rim frame
  chain: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <radialGradient id="ch-c" cx="50%" cy="50%" r="55%">
      <stop offset="0%" stop-color="#451A03" stop-opacity="0.16"/>
      <stop offset="100%" stop-color="#451A03" stop-opacity="0.3"/>
    </radialGradient>
    <rect width="256" height="256" fill="url(#ch-c)"/>
    <rect x="10" y="10" width="236" height="236" rx="20" fill="none" stroke="#FEF3C7" stroke-width="2.5" stroke-opacity="0.34"/>
    <rect x="19" y="19" width="218" height="218" rx="14" fill="none" stroke="#451A03" stroke-width="2.5" stroke-opacity="0.48"/>
    <g fill="#FEF3C7" fill-opacity="0.36" stroke="#451A03" stroke-width="1.5" stroke-opacity="0.55">
      <rect x="104" y="10" width="48" height="9" rx="4"/>
      <rect x="104" y="237" width="48" height="9" rx="4"/>
      <rect x="10" y="104" width="9" height="48" rx="4"/>
      <rect x="237" y="104" width="9" height="48" rx="4"/>
    </g>
  </svg>`,

  "ghost-dark": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <g fill="none" stroke="#E2E8F0" stroke-width="2.5" stroke-opacity="0.32" stroke-linejoin="bevel">
      <polyline points="18,48 18,18 48,18"/>
      <polyline points="208,18 238,18 238,48"/>
      <polyline points="18,208 18,238 48,238"/>
      <polyline points="208,238 238,238 238,208"/>
    </g>
    <rect x="26" y="26" width="204" height="204" rx="14" fill="none" stroke="#CBD5E1" stroke-width="1.5" stroke-opacity="0.22" stroke-dasharray="10 10"/>
  </svg>`,

  shuffle: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <rect x="8" y="8" width="240" height="240" rx="22" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-opacity="0.55"/>
    <rect x="17" y="17" width="222" height="222" rx="16" fill="none" stroke="#991B1B" stroke-width="1.8" stroke-opacity="0.22"/>
    <g fill="none" stroke="#991B1B" stroke-width="3" stroke-opacity="0.28" stroke-linejoin="bevel">
      <polyline points="96,24 160,24 148,15"/>
      <polyline points="160,232 96,232 108,241"/>
    </g>
  </svg>`,

  freeze: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <polygon points="0,0 74,0 24,50 0,74" fill="#FFFFFF" fill-opacity="0.48"/>
    <polygon points="256,0 182,0 232,50 256,74" fill="#FFFFFF" fill-opacity="0.34"/>
    <polygon points="0,256 74,256 24,206 0,182" fill="#FFFFFF" fill-opacity="0.3"/>
    <polygon points="256,256 182,256 232,206 256,182" fill="#0284C7" fill-opacity="0.16"/>
    <rect x="8" y="8" width="240" height="240" rx="22" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-opacity="0.65"/>
    <rect x="18" y="18" width="220" height="220" rx="15" fill="none" stroke="#0369A1" stroke-width="1.6" stroke-opacity="0.26"/>
  </svg>`,

  decay: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <g fill="#365314" fill-opacity="0.26">
      <polygon points="0,0 52,0 28,20 18,46 0,58"/>
      <polygon points="256,0 208,0 228,16 240,42 256,52"/>
      <polygon points="0,256 0,196 20,218 46,232 62,256"/>
      <polygon points="256,256 196,256 218,236 238,214 256,200"/>
    </g>
    <rect x="10" y="10" width="236" height="236" rx="20" fill="none" stroke="#365314" stroke-width="2.2" stroke-opacity="0.28" stroke-dasharray="14 8 6 8"/>
  </svg>`,

  // Polished glass mirror planes (no pixel grain -> crisp reflection + tiny WebP)
  mirror: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <polygon points="32,0 110,0 0,110 0,32" fill="#FFFFFF" fill-opacity="0.36"/>
    <polygon points="150,0 182,0 0,182 0,150" fill="#FFFFFF" fill-opacity="0.22"/>
    <polygon points="256,120 256,166 166,256 120,256" fill="#FFFFFF" fill-opacity="0.26"/>
    <rect x="8" y="8" width="240" height="240" rx="22" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-opacity="0.76"/>
    <rect x="17" y="17" width="222" height="222" rx="16" fill="none" stroke="#374151" stroke-width="1.6" stroke-opacity="0.25"/>
  </svg>`,

  "ghost-light": `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <g fill="none" stroke="#475569" stroke-width="2.5" stroke-opacity="0.28" stroke-linejoin="bevel">
      <polyline points="18,48 18,18 48,18"/>
      <polyline points="208,18 238,18 238,48"/>
      <polyline points="18,208 18,238 48,238"/>
      <polyline points="208,238 238,238 238,208"/>
    </g>
    <rect x="26" y="26" width="204" height="204" rx="14" fill="none" stroke="#64748B" stroke-width="1.5" stroke-opacity="0.22" stroke-dasharray="10 10"/>
  </svg>`,

  // Sculpted gold coin stack nestled along the lower base + top hazard chevron trim
  tax: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256">
    <defs>
      <pattern id="haz" width="28" height="28" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
        <rect width="12" height="28" fill="#713F12" fill-opacity="0.32"/>
      </pattern>
      <clipPath id="haz-top"><rect x="44" y="6" width="168" height="15" rx="4"/></clipPath>
    </defs>
    <rect width="256" height="256" fill="url(#haz)" clip-path="url(#haz-top)"/>
    <!-- 3-tier sculpted coin stack flanking the lower-left (clear of center letter & bottom-right icon) -->
    <g stroke="#713F12" stroke-width="2" stroke-opacity="0.45" stroke-linejoin="bevel">
      <path d="M18,224 L26,218 H88 L96,224 V234 L88,240 H26 L18,234 Z" fill="#A16207" fill-opacity="0.28"/>
      <path d="M22,208 L30,202 H88 L96,208 V218 L88,224 H30 L22,218 Z" fill="#CA8A04" fill-opacity="0.26"/>
      <path d="M16,192 L24,186 H82 L90,192 V202 L82,208 H24 L16,202 Z" fill="#FEF08A" fill-opacity="0.42"/>
      <line x1="26" y1="191" x2="80" y2="191" stroke="#FFFFFF" stroke-width="1.8" stroke-opacity="0.55"/>
    </g>
    <!-- Companion 2-coin rim on lower-right edge -->
    <g stroke="#713F12" stroke-width="2" stroke-opacity="0.38" stroke-linejoin="bevel">
      <path d="M168,224 L176,218 H234 L242,224 V234 L234,240 H176 L168,234 Z" fill="#A16207" fill-opacity="0.24"/>
      <path d="M174,210 L182,204 H236 L242,210 V218 L236,224 H182 L174,218 Z" fill="#FEF08A" fill-opacity="0.36"/>
    </g>
    <rect x="8" y="8" width="240" height="240" rx="22" fill="none" stroke="#FEF9C3" stroke-width="2.5" stroke-opacity="0.58"/>
  </svg>`,
};

// Low-entropy procedural grain paired only with matte/forged surfaces
const GRAIN_SPECS = {
  stone:  { rgb: [15, 23, 42],    maxAlpha: 0.13, period: 16, rimOnly: false, seed: 2101 },
  decay:  { rgb: [54, 83, 20],    maxAlpha: 0.18, period: 16, rimOnly: true,  seed: 2102 },
  chain:  { rgb: [69, 26, 3],     maxAlpha: 0.12, period: 16, rimOnly: false, seed: 2105 },
  freeze: { rgb: [255, 255, 255], maxAlpha: 0.22, period: 14, rimOnly: true,  seed: 2106 },
};

// ---------------------------------------------------------------------------
// B3: Soft organic light-mode rime sheet (256x256 seamless; replaces cracked-glass look)
// ---------------------------------------------------------------------------
function makeSoftLightFrostRime(seed = 3101) {
  const S = 256;
  const buf = Buffer.alloc(S * S * 4);

  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      // Soft multi-octave frosted cloud (smooth gradients -> organic rime + compact WebP)
      const cloudBroad = periodicNoise(x, y, S, 6, seed);
      const cloudMid = periodicNoise(x, y, S, 12, seed + 11);
      // Gentle crystalline sparkle flecks without hard cell-wall cracks
      const sparkle = smoothstep(0.62, 0.90, periodicNoise(x, y, S, 24, seed + 23));
      const rime = Math.min(1, cloudBroad * 0.56 + cloudMid * 0.30 + sparkle * 0.32);

      const i = (y * S + x) * 4;
      buf[i] = clampByte(lerp(224, 255, rime));
      buf[i + 1] = clampByte(lerp(244, 255, rime));
      buf[i + 2] = 255;
      buf[i + 3] = clampByte(Math.min(0.80, rime * 0.78) * 255);
    }
  }
  return { buf, width: S, height: S };
}

// Closed encode loop: keeps every file comfortably under TARGET_FILE_BYTES
async function encodeUnderBudget(buildSharp, outPath) {
  const presets = [
    { quality: 88, alphaQuality: 86 },
    { quality: 84, alphaQuality: 80 },
    { quality: 80, alphaQuality: 74 },
    { quality: 74, alphaQuality: 68 },
  ];

  let lastBytes = 0;
  for (const preset of presets) {
    await buildSharp()
      .webp({ quality: preset.quality, alphaQuality: preset.alphaQuality, effort: 6 })
      .toFile(outPath);
    const { size } = await fs.stat(outPath);
    lastBytes = size;
    if (size <= TARGET_FILE_BYTES) return { bytes: size, preset };
  }
  return { bytes: lastBytes, preset: presets[presets.length - 1] };
}

// ---------------------------------------------------------------------------
// Post-decode verification (runs on saved WebP bytes)
// ---------------------------------------------------------------------------
async function checkSurfaceContrast(filePath, palette) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const S = info.width;
  const cx = S * 0.5;
  const cy = S * 0.5;
  const textL = relLuminance(palette.text[0], palette.text[1], palette.text[2]);
  const xLo = Math.round(S * LETTER_ZONE.x[0]);
  const xHi = Math.round(S * LETTER_ZONE.x[1]);
  const yLo = Math.round(S * LETTER_ZONE.y[0]);
  const yHi = Math.round(S * LETTER_ZONE.y[1]);
  const roundMaxR = 74; // on the round Bomb tile, the disc that holds the letter zone's corners

  let worstBaseCR = 21;
  let worstAfterCR = 21;
  let worstDelta = 0;

  for (let y = yLo; y <= yHi; y++) {
    for (let x = xLo; x <= xHi; x++) {
      if (palette.round && Math.hypot(x - cx, y - cy) > roundMaxR) continue;
      const bg = sampleTileGradient(palette, x, y, S);
      const baseCR = contrastRatio(textL, relLuminance(bg[0], bg[1], bg[2]));
      const i = (y * S + x) * 4;
      const a = data[i + 3] / 255;
      const compL = relLuminance(
        lerp(bg[0], data[i], a),
        lerp(bg[1], data[i + 1], a),
        lerp(bg[2], data[i + 2], a),
      );
      const afterCR = contrastRatio(textL, compL);
      const delta = afterCR - baseCR;
      if (baseCR < worstBaseCR) worstBaseCR = baseCR;
      if (afterCR < worstAfterCR) worstAfterCR = afterCR;
      if (delta < worstDelta) worstDelta = delta;
    }
  }

  return {
    baseCR: +worstBaseCR.toFixed(2),
    afterCR: +worstAfterCR.toFixed(2),
    delta: +worstDelta.toFixed(2),
  };
}

async function checkSeamlessWrap(filePath) {
  const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width: w, height: h } = info;
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
  let maxInterior = 0;
  for (let y = 0; y < h; y++) {
    maxSeam = Math.max(maxSeam, pmDiff((y * w) * 4, (y * w + (w - 1)) * 4));
    for (let x = 0; x < w - 1; x++) {
      maxInterior = Math.max(maxInterior, pmDiff((y * w + x) * 4, (y * w + x + 1) * 4));
    }
  }
  for (let x = 0; x < w; x++) {
    maxSeam = Math.max(maxSeam, pmDiff(x * 4, ((h - 1) * w + x) * 4));
  }
  for (let y = 0; y < h - 1; y++) {
    for (let x = 0; x < w; x++) {
      maxInterior = Math.max(maxInterior, pmDiff((y * w + x) * 4, ((y + 1) * w + x) * 4));
    }
  }
  return { seam: +maxSeam.toFixed(2), interior: +maxInterior.toFixed(2) };
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });

  const report = [];
  const failures = [];

  // B1: 16 special tile surfaces
  for (const [key, svg] of Object.entries(SURFACE_SVGS)) {
    const filename = `surface-${key}.webp`;
    const outPath = path.join(OUT_DIR, filename);
    const svgBuf = await sharp(Buffer.from(svg)).resize(256, 256).png().toBuffer();
    const grain = GRAIN_SPECS[key] ? makeGrainLayer(GRAIN_SPECS[key]) : null;

    const { bytes } = await encodeUnderBudget(
      () => grain
        ? sharp(grain, { raw: { width: 256, height: 256, channels: 4 } }).composite([{ input: svgBuf, blend: "over" }])
        : sharp(svgBuf),
      outPath,
    );

    const cr = await checkSurfaceContrast(outPath, LIVE_TILE_PALETTES[key]);
    const kb = +(bytes / 1024).toFixed(2);
    report.push({
      group: "B1",
      file: filename,
      kb,
      centerCR: `${cr.baseCR} -> ${cr.afterCR}`,
      delta: cr.delta >= 0 ? `+${cr.delta}` : `${cr.delta}`,
    });

    if (bytes >= MAX_FILE_BYTES) failures.push(`${filename}: ${kb} KB exceeds 20 KB cap`);
    if (cr.delta < -MAX_CONTRAST_DROP) failures.push(`${filename}: center contrast dropped by ${cr.delta} (limit -${MAX_CONTRAST_DROP})`);
  }

  // B3: Soft light-mode rime sheet (dark mode keeps plain cool cyan tint)
  const frostFile = "frost-crystals-light.webp";
  const frostPath = path.join(OUT_DIR, frostFile);
  const frostRaw = makeSoftLightFrostRime(3101);
  const { bytes: frostBytes } = await encodeUnderBudget(
    () => sharp(frostRaw.buf, { raw: { width: frostRaw.width, height: frostRaw.height, channels: 4 } }),
    frostPath,
  );
  const wrap = await checkSeamlessWrap(frostPath);
  const frostKb = +(frostBytes / 1024).toFixed(2);
  report.push({ group: "B3", file: frostFile, kb: frostKb, centerCR: "seamless", delta: `seam=${wrap.seam}/${wrap.interior}` });

  if (frostBytes >= MAX_FILE_BYTES) failures.push(`${frostFile}: ${frostKb} KB exceeds 20 KB cap`);
  if (wrap.seam > Math.max(wrap.interior * 1.25, wrap.interior + 2)) {
    failures.push(`${frostFile}: wrap seam ${wrap.seam} exceeds interior step ${wrap.interior}`);
  }

  const totalKb = +report.reduce((s, r) => s + r.kb, 0).toFixed(1);
  console.log(`\nSpecial tile B1 surfaces & B3 light frost rime written to ${OUT_DIR} (${totalKb} KB total)`);
  console.table(report);

  if (QA_MODE) {
    await fs.mkdir(QA_DIR, { recursive: true });
    const keys = Object.keys(SURFACE_SVGS);
    const composites = [];
    const tileSz = 128;
    const pad = 12;
    const cols = 6;

    for (let idx = 0; idx < keys.length; idx++) {
      const key = keys[idx];
      const pal = LIVE_TILE_PALETTES[key];
      const gradBuf = Buffer.alloc(tileSz * tileSz * 4);
      for (let y = 0; y < tileSz; y++) {
        for (let x = 0; x < tileSz; x++) {
          const rgb = sampleTileGradient(pal, x, y, tileSz);
          const i = (y * tileSz + x) * 4;
          gradBuf[i] = clampByte(rgb[0]);
          gradBuf[i + 1] = clampByte(rgb[1]);
          gradBuf[i + 2] = clampByte(rgb[2]);
          gradBuf[i + 3] = 255;
        }
      }

      const overlay = await sharp(path.join(OUT_DIR, `surface-${key}.webp`)).resize(tileSz, tileSz).toBuffer();
      const label = key === "wild" ? "?" : key.startsWith("multiplier-") ? key.slice(-2) : "A";
      const labelSvg = Buffer.from(
        `<svg xmlns="http://www.w3.org/2000/svg" width="${tileSz}" height="${tileSz}">` +
        `<text x="64" y="76" text-anchor="middle" font-family="sans-serif" font-weight="800" font-size="${label.length > 1 ? 36 : 44}" fill="rgb(${pal.text.join(",")})">${label}</text>` +
        `</svg>`,
      );

      let tileImg = sharp(gradBuf, { raw: { width: tileSz, height: tileSz, channels: 4 } })
        .composite([{ input: overlay }, { input: labelSvg }]);

      if (pal.round) {
        const mask = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${tileSz}" height="${tileSz}"><circle cx="64" cy="64" r="64" fill="#fff"/></svg>`);
        tileImg = sharp(await tileImg.png().toBuffer()).composite([{ input: mask, blend: "dest-in" }]);
      }

      const col = idx % cols;
      const row = Math.floor(idx / cols);
      composites.push({
        input: await tileImg.png().toBuffer(),
        left: pad + col * (tileSz + pad),
        top: pad + row * (tileSz + pad),
      });
    }

    // Add 2x2 tiled light frost rime sample in the final grid cell
    const q = await sharp(frostPath).resize(64, 64).toBuffer();
    const frostSample = await sharp({ create: { width: 128, height: 128, channels: 4, background: { r: 245, g: 247, b: 250, alpha: 1 } } })
      .composite([
        { input: q, left: 0, top: 0 }, { input: q, left: 64, top: 0 },
        { input: q, left: 0, top: 64 }, { input: q, left: 64, top: 64 },
      ])
      .png()
      .toBuffer();
    const fCol = keys.length % cols;
    const fRow = Math.floor(keys.length / cols);
    composites.push({
      input: frostSample,
      left: pad + fCol * (tileSz + pad),
      top: pad + fRow * (tileSz + pad),
    });

    const rows = Math.ceil((keys.length + 1) / cols);
    const qaPath = path.join(QA_DIR, "qa-special-tiles.png");
    await sharp({
      create: {
        width: pad + cols * (tileSz + pad),
        height: pad + rows * (tileSz + pad),
        channels: 4,
        background: { r: 15, g: 23, b: 42, alpha: 1 },
      },
    })
      .composite(composites)
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
