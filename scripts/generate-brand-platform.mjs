#!/usr/bin/env node
/**
 * Generates the app icons, favicons, and iOS splash screens from the approved
 * logo files in docs/brand/ into public/icons/, public/splash/, and public/.
 * The output is committed; this script is not part of the build. Re-run it
 * after changing a logo file or the device table below:
 *
 *   node scripts/generate-brand-platform.mjs               write the 31 files
 *   node scripts/generate-brand-platform.mjs --qa          also write a contact sheet to .tmp/
 *   node scripts/generate-brand-platform.mjs --print-html  also print the splash <link> tags for index.html
 *   node scripts/generate-brand-platform.mjs --landscape   also write landscape splashes (not wired in index.html)
 *
 * Every file is re-read after it is written and checked for size and channel
 * count. The script exits non-zero if any check fails. A run takes about a
 * minute: the splash backgrounds are computed and dithered pixel by pixel.
 *
 * Adding a device: add a row to SPLASH_DEVICES, re-run with --print-html, and
 * paste the printed tags over the splash block in index.html.
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const args = process.argv.slice(2);
const QA_MODE = args.includes("--qa");
const LIGHT_SURFACE = args.includes("--light-surface");
const INCLUDE_LANDSCAPE = args.includes("--landscape");
const PRINT_HTML = args.includes("--print-html");
const srcFlagIdx = args.indexOf("--src");
const SRC_DIR = path.resolve(srcFlagIdx !== -1 && args[srcFlagIdx + 1] ? args[srcFlagIdx + 1] : "docs/brand");

const PUBLIC_DIR = path.resolve("public");
const ICONS_DIR = path.join(PUBLIC_DIR, "icons");
const SPLASH_DIR = path.join(PUBLIC_DIR, "splash");
const QA_DIR = path.resolve(".tmp");

// 11 current & legacy iPhone/iPad sizes × 2 themes = 22 portrait splash files
const SPLASH_DEVICES = [
  { name: "iphone-16e",   cssW: 390,  cssH: 844,  dpr: 3, label: "iPhone 16e / 14 / 13 / 13 Pro / 12 / 12 Pro" },
  { name: "iphone-6.1",   cssW: 393,  cssH: 852,  dpr: 3, label: "iPhone 16 / 15 / 15 Pro / 14 Pro" },
  { name: "iphone-6.3",   cssW: 402,  cssH: 874,  dpr: 3, label: "iPhone 17 / 17 Pro / 16 Pro / 18 Pro" },
  { name: "iphone-air",   cssW: 420,  cssH: 912,  dpr: 3, label: "iPhone Air" },
  { name: "iphone-6.7",   cssW: 430,  cssH: 932,  dpr: 3, label: "iPhone 16 Plus / 15 Plus / 15 Pro Max / 14 Pro Max" },
  { name: "iphone-6.9",   cssW: 440,  cssH: 956,  dpr: 3, label: "iPhone 17 Pro Max / 16 Pro Max / 18 Pro Max" },
  { name: "ipad-mini",    cssW: 744,  cssH: 1133, dpr: 2, label: "iPad mini" },
  { name: "ipad-11",      cssW: 820,  cssH: 1180, dpr: 2, label: "iPad 11-inch / iPad Air 11-inch" },
  { name: "ipad-pro-11",  cssW: 834,  cssH: 1210, dpr: 2, label: "iPad Pro 11-inch (M4/M5)" },
  { name: "ipad-air-13",  cssW: 1024, cssH: 1366, dpr: 2, label: "iPad Air 13-inch / iPad Pro 12.9-inch" },
  { name: "ipad-pro-13",  cssW: 1032, cssH: 1376, dpr: 2, label: "iPad Pro 13-inch (M4/M5)" },
];

// Normalized 4×4 Bayer threshold matrix in [-0.5, +0.5) for zero-band OLED gradients
const BAYER_4X4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16 - 0.5));

// ---------------------------------------------------------------------------
// Helpers: crisp vector rasterization, rounded mask, dithered RGB backdrops, ICO
// ---------------------------------------------------------------------------
function getSvgViewBoxSize(svgText) {
  const vb = svgText.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+([\d.]+)\s*["']/i);
  if (vb) return { width: Number(vb[1]), height: Number(vb[2]) };
  const w = svgText.match(/\bwidth=["']([\d.]+)/i);
  const h = svgText.match(/\bheight=["']([\d.]+)/i);
  return { width: w ? Number(w[1]) : 128, height: h ? Number(h[1]) : 128 };
}

function rasterizeSvg(svgBuf, targetW, targetH) {
  const { width: srcW } = getSvgViewBoxSize(svgBuf.toString("utf8"));
  const density = Math.max(72, Math.min(2400, Math.ceil(72 * (targetW / srcW) * 1.2)));
  return sharp(svgBuf, { density }).resize(targetW, targetH, {
    fit: "contain",
    background: { r: 0, g: 0, b: 0, alpha: 0 },
  });
}

// The mark (tile plus chain) runs to the corner of the full-bleed icon, which a
// circular launcher mask would cut off. This re-centres it and scales it to
// fit the 80% maskable safe circle; the plate stays full-bleed.
// Mark bounding circle in the 1024 source: centre (588, 582), radius 515.
function makeMaskableIconSvg(svgBuf) {
  const svgText = svgBuf.toString("utf8");
  const markStart = svgText.indexOf("<!-- Mark:");
  if (markStart === -1) throw new Error('brand-icon-fullbleed.svg: missing the "<!-- Mark:" comment');
  const mark = svgText.slice(markStart).replace(/<\/svg>\s*$/, "");
  return Buffer.from(
    `${svgText.slice(0, markStart)}<g transform="translate(512 512) scale(0.78) translate(-588 -582)">${mark}</g></svg>`,
  );
}

function makeRoundedMaskSvg(size, radiusRatio = 0.22) {
  const r = Math.round(size * radiusRatio);
  return Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">` +
      `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#FFFFFF"/>` +
      `</svg>`,
  );
}

function clampByte(v) {
  const n = Math.round(v);
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function makeDitheredSplashBackdrop(width, height, theme) {
  const buf = Buffer.allocUnsafe(width * height * 3);
  const invW = 1 / Math.max(1, width - 1);
  const invH = 1 / Math.max(1, height - 1);

  if (theme === "dark") {
    // Base #020817 (2, 8, 23) + smooth radial amethyst glow with 4×4 Bayer dither
    const cx = width * 0.5;
    const cy = height * 0.46;
    const invRx = 1 / (width * 0.58);
    const invRy = 1 / (height * 0.58);

    for (let y = 0; y < height; y++) {
      const dy = (y - cy) * invRy;
      const dy2 = dy * dy;
      const bayerRow = BAYER_4X4[y & 3];
      const rowOff = y * width * 3;

      for (let x = 0; x < width; x++) {
        const dx = (x - cx) * invRx;
        const d = Math.sqrt(dx * dx + dy2);

        let r = 2;
        let g = 8;
        let b = 23;

        if (d < 1) {
          let gr, gg, gb, ga;
          if (d < 0.55) {
            const t = d / 0.55;
            // #7927EC (121, 39, 236) @ 0.22 -> #4C1D95 (76, 29, 149) @ 0.08
            gr = 121 + (76 - 121) * t;
            gg = 39 + (29 - 39) * t;
            gb = 236 + (149 - 236) * t;
            ga = 0.22 + (0.08 - 0.22) * t;
          } else {
            const t = (d - 0.55) / 0.45;
            // #4C1D95 @ 0.08 -> #020817 @ 0
            gr = 76 + (2 - 76) * t;
            gg = 29 + (8 - 29) * t;
            gb = 149 + (23 - 149) * t;
            ga = 0.08 * (1 - t);
          }
          r = r * (1 - ga) + gr * ga;
          g = g * (1 - ga) + gg * ga;
          b = b * (1 - ga) + gb * ga;
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

  if (LIGHT_SURFACE) {
    // White + soft lavender center wash
    const cx = width * 0.5;
    const cy = height * 0.46;
    const invRx = 1 / (width * 0.6);
    const invRy = 1 / (height * 0.6);

    for (let y = 0; y < height; y++) {
      const dy = (y - cy) * invRy;
      const dy2 = dy * dy;
      const bayerRow = BAYER_4X4[y & 3];
      const rowOff = y * width * 3;

      for (let x = 0; x < width; x++) {
        const dx = (x - cx) * invRx;
        const d = Math.sqrt(dx * dx + dy2);
        const a = d < 1 ? 0.55 * (1 - d) : 0;
        const dith = bayerRow[x & 3];
        const i = rowOff + x * 3;
        // #EDE9FE (237, 233, 254) over #FFFFFF
        buf[i] = clampByte(255 * (1 - a) + 237 * a + dith);
        buf[i + 1] = clampByte(255 * (1 - a) + 233 * a + dith);
        buf[i + 2] = clampByte(255 * (1 - a) + 254 * a + dith);
      }
    }
    return buf;
  }

  // Default light splash: 135° brand-purple gradient + soft top-left sheen
  const sx = width * 0.24;
  const sy = height * 0.18;
  const invSrx = 1 / (width * 0.68);
  const invSry = 1 / (height * 0.68);

  for (let y = 0; y < height; y++) {
    const ny = y * invH;
    const dy = (y - sy) * invSry;
    const dy2 = dy * dy;
    const bayerRow = BAYER_4X4[y & 3];
    const rowOff = y * width * 3;

    for (let x = 0; x < width; x++) {
      const t = (x * invW + ny) * 0.5;
      let r, g, b;
      if (t < 0.52) {
        const u = t / 0.52;
        // #914DEF (145, 77, 239) -> #7927EC (121, 39, 236)
        r = 145 + (121 - 145) * u;
        g = 77 + (39 - 77) * u;
        b = 239 + (236 - 239) * u;
      } else {
        const u = (t - 0.52) / 0.48;
        // #7927EC (121, 39, 236) -> #5B12C6 (91, 18, 198)
        r = 121 + (91 - 121) * u;
        g = 39 + (18 - 39) * u;
        b = 236 + (198 - 236) * u;
      }

      const dx = (x - sx) * invSrx;
      const sd = Math.sqrt(dx * dx + dy2);
      if (sd < 1) {
        const sa = 0.18 * (1 - sd);
        r = r * (1 - sa) + 255 * sa;
        g = g * (1 - sa) + 255 * sa;
        b = b * (1 - sa) + 255 * sa;
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

function packPngIco(entries) {
  const headerSize = 6 + entries.length * 16;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(entries.length, 4);

  let offset = headerSize;
  const chunks = [header];

  entries.forEach(({ size, png }, idx) => {
    const pos = 6 + idx * 16;
    header.writeUInt8(size >= 256 ? 0 : size, pos);
    header.writeUInt8(size >= 256 ? 0 : size, pos + 1);
    header.writeUInt8(0, pos + 2);
    header.writeUInt8(0, pos + 3);
    header.writeUInt16LE(1, pos + 4);
    header.writeUInt16LE(32, pos + 6);
    header.writeUInt32LE(png.length, pos + 8);
    header.writeUInt32LE(offset, pos + 12);
    offset += png.length;
    chunks.push(png);
  });

  return Buffer.concat(chunks);
}

// ---------------------------------------------------------------------------
// Post-write disk verification
// ---------------------------------------------------------------------------
async function inspectPngOnDisk(filePath, { pixelScan = false } = {}) {
  const meta = await sharp(filePath).metadata();
  const { size } = await fs.stat(filePath);
  const result = {
    width: meta.width,
    height: meta.height,
    channels: meta.channels,
    bytes: size,
    kb: +(size / 1024).toFixed(2),
  };

  if (pixelScan) {
    const { data, info } = await sharp(filePath).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const w = info.width;
    const h = info.height;
    let minAlpha = 255;
    let maxAlpha = 0;
    let maxRgbOnInk = 0;
    let maxRadius = 0;
    const cx = w / 2;
    const cy = h / 2;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        const a = data[i + 3];
        if (a < minAlpha) minAlpha = a;
        if (a > maxAlpha) maxAlpha = a;
        if (a > 0) {
          maxRgbOnInk = Math.max(maxRgbOnInk, data[i], data[i + 1], data[i + 2]);
          const r = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
          if (r > maxRadius) maxRadius = r;
        }
      }
    }

    result.minAlpha = minAlpha;
    result.maxAlpha = maxAlpha;
    result.cornerAlpha = data[3];
    result.centerAlpha = data[(Math.floor(h / 2) * w + Math.floor(w / 2)) * 4 + 3];
    result.maxRgbOnInk = maxRgbOnInk;
    result.maxRadius = +maxRadius.toFixed(2);
  }

  return result;
}

function verifyIcoBuffer(buf, expectedSizes) {
  if (buf.length < 6) return "ICO file truncated";
  if (buf.readUInt16LE(0) !== 0 || buf.readUInt16LE(2) !== 1) return "Invalid ICO magic header";
  const count = buf.readUInt16LE(4);
  if (count !== expectedSizes.length) return `Expected ${expectedSizes.length} ICO entries, got ${count}`;

  const pngSig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  for (let i = 0; i < count; i++) {
    const pos = 6 + i * 16;
    const w = buf.readUInt8(pos) || 256;
    const h = buf.readUInt8(pos + 1) || 256;
    const len = buf.readUInt32LE(pos + 8);
    const off = buf.readUInt32LE(pos + 12);
    if (w !== expectedSizes[i] || h !== expectedSizes[i]) {
      return `ICO entry ${i}: expected ${expectedSizes[i]}x${expectedSizes[i]}, got ${w}x${h}`;
    }
    if (off + len > buf.length || !buf.subarray(off, off + 8).equals(pngSig)) {
      return `ICO entry ${i}: invalid PNG payload at offset ${off}`;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Main pipeline
// ---------------------------------------------------------------------------
async function main() {
  const requiredSources = [
    "brand-icon-fullbleed.svg",
    "brand-icon-monochrome.svg",
    "brand-favicon.svg",
    "brand-logo-stacked-v3.svg",
    ...(LIGHT_SURFACE ? [] : ["brand-logo-stacked-on-brand-v3.svg"]),
  ];

  const missing = [];
  for (const name of requiredSources) {
    try {
      await fs.access(path.join(SRC_DIR, name));
    } catch {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    console.error(`Missing approved source SVGs in ${SRC_DIR}:\n  - ${missing.join("\n  - ")}`);
    console.error(`Pass --src <dir> if your Step 1 SVGs are stored elsewhere.`);
    process.exit(1);
  }

  await fs.mkdir(ICONS_DIR, { recursive: true });
  await fs.mkdir(SPLASH_DIR, { recursive: true });

  const [iconFullSvg, iconMonoSvg, faviconSvg, stackedPrimarySvg, stackedOnBrandSvg] = await Promise.all([
    fs.readFile(path.join(SRC_DIR, "brand-icon-fullbleed.svg")),
    fs.readFile(path.join(SRC_DIR, "brand-icon-monochrome.svg")),
    fs.readFile(path.join(SRC_DIR, "brand-favicon.svg")),
    fs.readFile(path.join(SRC_DIR, "brand-logo-stacked-v3.svg")),
    LIGHT_SURFACE ? Promise.resolve(null) : fs.readFile(path.join(SRC_DIR, "brand-logo-stacked-on-brand-v3.svg")),
  ]);

  const failures = [];
  const report = [];

  // -------------------------------------------------------------------------
  // E2: Rounded "any" icons (desktop/unmasked placements)
  // -------------------------------------------------------------------------
  for (const { file, size } of [
    { file: "icon-192.png", size: 192 },
    { file: "icon-512.png", size: 512 },
  ]) {
    const outPath = path.join(ICONS_DIR, file);
    const flatBuf = await rasterizeSvg(iconFullSvg, size, size)
      .flatten({ background: "#2A1272" })
      .ensureAlpha()
      .png()
      .toBuffer();

    await sharp(flatBuf)
      .composite([{ input: makeRoundedMaskSvg(size, 0.22), blend: "dest-in" }])
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outPath);

    const m = await inspectPngOnDisk(outPath, { pixelScan: true });
    report.push({ section: "E2", file: `icons/${file}`, dim: `${m.width}x${m.height}`, ch: m.channels, kb: m.kb, check: `cornerA=${m.cornerAlpha}` });
    if (m.width !== size || m.height !== size) failures.push(`${file}: wrong dimensions`);
    if (m.channels !== 4 || m.cornerAlpha !== 0 || m.centerAlpha !== 255) {
      failures.push(`${file}: expected rounded RGBA icon (cornerA=0, centerA=255)`);
    }
  }

  // -------------------------------------------------------------------------
  // E2: Full-bleed opaque 3-channel RGB icons (maskable, App Store 1024, iOS touch)
  // -------------------------------------------------------------------------
  for (const { file, size, source } of [
    { file: "icon-1024.png", size: 1024 },
    { file: "icon-maskable-512.png", size: 512, source: makeMaskableIconSvg(iconFullSvg) },
    { file: "apple-touch-icon.png", size: 180 },
  ]) {
    const outPath = path.join(ICONS_DIR, file);
    await rasterizeSvg(source ?? iconFullSvg, size, size)
      .flatten({ background: "#2A1272" })
      .removeAlpha()
      .png({ compressionLevel: 9, adaptiveFiltering: true })
      .toFile(outPath);

    const m = await inspectPngOnDisk(outPath);
    report.push({ section: "E2", file: `icons/${file}`, dim: `${m.width}x${m.height}`, ch: m.channels, kb: m.kb, check: "RGB" });
    if (m.width !== size || m.height !== size) failures.push(`${file}: wrong dimensions`);
    if (m.channels !== 3) failures.push(`${file}: expected 3-channel RGB (no alpha), got ${m.channels}`);
  }

  // Monochrome 512 PNG (Android themed icon: transparent canvas, black ink inside 80% safe circle)
  const monoPath = path.join(ICONS_DIR, "icon-monochrome-512.png");
  await rasterizeSvg(iconMonoSvg, 512, 512)
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toFile(monoPath);

  const mMono = await inspectPngOnDisk(monoPath, { pixelScan: true });
  const safeCircleR = 512 * 0.4;
  report.push({ section: "E2", file: "icons/icon-monochrome-512.png", dim: `${mMono.width}x${mMono.height}`, ch: mMono.channels, kb: mMono.kb, check: `r=${mMono.maxRadius}` });
  if (mMono.width !== 512 || mMono.height !== 512) failures.push("icon-monochrome-512.png: wrong dimensions");
  if (mMono.channels !== 4 || mMono.minAlpha !== 0 || mMono.maxAlpha !== 255) failures.push("icon-monochrome-512.png: must have transparent bg and solid ink");
  if (mMono.maxRgbOnInk > 4) failures.push(`icon-monochrome-512.png: non-black ink detected (max RGB ${mMono.maxRgbOnInk})`);
  if (mMono.maxRadius > safeCircleR) failures.push(`icon-monochrome-512.png: ink radius ${mMono.maxRadius} exceeds safe circle ${safeCircleR}`);

  const masterSvgPath = path.join(ICONS_DIR, "icon-master.svg");
  await fs.writeFile(masterSvgPath, iconFullSvg);
  const masterStat = await fs.stat(masterSvgPath);
  report.push({ section: "E2", file: "icons/icon-master.svg", dim: "vector", ch: "-", kb: +(masterStat.size / 1024).toFixed(2), check: "SVG" });

  // -------------------------------------------------------------------------
  // E3: Favicons (SVG + 16/32 multi-size ICO)
  // -------------------------------------------------------------------------
  const pubFavSvgPath = path.join(PUBLIC_DIR, "favicon.svg");
  await fs.writeFile(pubFavSvgPath, faviconSvg);
  const favSvgStat = await fs.stat(pubFavSvgPath);
  report.push({ section: "E3", file: "favicon.svg", dim: "vector", ch: "-", kb: +(favSvgStat.size / 1024).toFixed(2), check: "SVG" });

  const icoSizes = [16, 32];
  const icoEntries = await Promise.all(
    icoSizes.map(async (size) => ({
      size,
      png: await rasterizeSvg(faviconSvg, size, size).png({ compressionLevel: 9 }).toBuffer(),
    })),
  );
  const icoBuf = packPngIco(icoEntries);
  await fs.writeFile(path.join(PUBLIC_DIR, "favicon.ico"), icoBuf);
  const icoErr = verifyIcoBuffer(icoBuf, icoSizes);
  if (icoErr) failures.push(`favicon.ico: ${icoErr}`);
  report.push({ section: "E3", file: "favicon.ico", dim: "16+32", ch: "-", kb: +(icoBuf.length / 1024).toFixed(2), check: icoErr ? "FAIL" : "OK" });

  // -------------------------------------------------------------------------
  // E4: iOS Splash Screens (11 devices × light & dark = 22 RGB PNGs)
  // -------------------------------------------------------------------------
  const logoAspect = 168 / 532;
  const lightLogoSvg = LIGHT_SURFACE ? stackedPrimarySvg : stackedOnBrandSvg;
  const orientations = INCLUDE_LANDSCAPE ? ["portrait", "landscape"] : ["portrait"];
  const htmlTags = [];

  for (const dev of SPLASH_DEVICES) {
    htmlTags.push(`<!-- ${dev.label} (${dev.cssW}x${dev.cssH} @${dev.dpr}x) -->`);
    for (const orientation of orientations) {
      const w = (orientation === "portrait" ? dev.cssW : dev.cssH) * dev.dpr;
      const h = (orientation === "portrait" ? dev.cssH : dev.cssW) * dev.dpr;
      const logoW = Math.min(Math.round(Math.min(w, h) * 0.68), 960);
      const logoH = Math.round(logoW * logoAspect);
      const left = Math.round((w - logoW) / 2);
      const top = Math.round((h - logoH) / 2);

      for (const theme of ["light", "dark"]) {
        const filename = `splash-${w}x${h}-${theme}.png`;
        const outPath = path.join(SPLASH_DIR, filename);
        const bgRaw = makeDitheredSplashBackdrop(w, h, theme);
        const logoBuf = await rasterizeSvg(theme === "light" ? lightLogoSvg : stackedPrimarySvg, logoW, logoH)
          .png()
          .toBuffer();

        await sharp(bgRaw, { raw: { width: w, height: h, channels: 3 } })
          .composite([{ input: logoBuf, left, top }])
          .removeAlpha()
          .png({ compressionLevel: 9, adaptiveFiltering: true })
          .toFile(outPath);

        const m = await inspectPngOnDisk(outPath);
        report.push({ section: "E4", file: `splash/${filename}`, dim: `${m.width}x${m.height}`, ch: m.channels, kb: m.kb, check: "RGB+dither" });
        if (m.width !== w || m.height !== h) failures.push(`${filename}: expected ${w}x${h}, got ${m.width}x${m.height}`);
        if (m.channels !== 3) failures.push(`${filename}: expected 3-channel RGB (no unused alpha), got ${m.channels}`);

        htmlTags.push(
          `<link rel="apple-touch-startup-image" href="/splash/${filename}" ` +
            `media="(device-width: ${dev.cssW}px) and (device-height: ${dev.cssH}px) and (-webkit-device-pixel-ratio: ${dev.dpr}) and (orientation: ${orientation}) and (prefers-color-scheme: ${theme})" />`,
        );
      }
    }
  }

  const totalSplashKb = report
    .filter((r) => r.section === "E4")
    .reduce((acc, r) => acc + r.kb, 0);

  console.log(`\nBrand & platform assets generated from ${SRC_DIR}`);
  console.table(report);
  console.log(`Total E4 splash size: ${(totalSplashKb / 1024).toFixed(2)} MB across ${report.filter((r) => r.section === "E4").length} files`);

  if (PRINT_HTML) {
    console.log("\n--- E4 index.html tags ---\n" + htmlTags.join("\n"));
  }

  // -------------------------------------------------------------------------
  // Optional QA contact sheet -> .tmp/qa-brand-platform.png
  // -------------------------------------------------------------------------
  if (QA_MODE) {
    await fs.mkdir(QA_DIR, { recursive: true });
    const iconAny = await sharp(path.join(ICONS_DIR, "icon-192.png")).toBuffer();
    const iconMask = await sharp(path.join(ICONS_DIR, "icon-maskable-512.png")).resize(192, 192).toBuffer();
    const mono192 = await sharp(monoPath).resize(192, 192).toBuffer();
    const fav32x4 = await sharp(icoEntries[1].png).resize(128, 128, { kernel: "nearest" }).toBuffer();
    const fav16x4 = await sharp(icoEntries[0].png).resize(64, 64, { kernel: "nearest" }).toBuffer();
    const spLight = await sharp(path.join(SPLASH_DIR, "splash-1206x2622-light.png")).resize(180, 391).toBuffer();
    const spDark = await sharp(path.join(SPLASH_DIR, "splash-1206x2622-dark.png")).resize(180, 391).toBuffer();
    const spIpad = await sharp(path.join(SPLASH_DIR, "splash-1640x2360-dark.png")).resize(272, 391).toBuffer();

    const qaPath = path.join(QA_DIR, "qa-brand-platform.png");
    await sharp({ create: { width: 1344, height: 460, channels: 4, background: { r: 226, g: 232, b: 240, alpha: 1 } } })
      .composite([
        { input: iconAny, left: 32, top: 32 },
        { input: iconMask, left: 256, top: 32 },
        { input: mono192, left: 480, top: 32 },
        { input: fav32x4, left: 32, top: 256 },
        { input: fav16x4, left: 192, top: 288 },
        { input: spLight, left: 712, top: 34 },
        { input: spDark, left: 912, top: 34 },
        { input: spIpad, left: 1112, top: 34 },
      ])
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
