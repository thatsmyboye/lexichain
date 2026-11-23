#!/usr/bin/env node
/**
 * Generates the Expo app's icon and splash images (mobile/assets/) from the
 * approved logo files in docs/brand/. The output is committed; run this again
 * after changing a logo file:
 *
 *   node scripts/generate-native-app-icons.mjs
 *
 * Files written:
 *   icon.png                     1024², opaque (the App Store rejects alpha)
 *   android-icon-background.png  1024², the brand plate of the adaptive icon
 *   android-icon-foreground.png  1024², the keycap on transparency, inside the
 *                                adaptive icon's 66/108 safe zone
 *   android-icon-monochrome.png  1024², themed-icon silhouette (Android 13+)
 *   splash-icon.png              1024², the keycap alone, for the splash screen
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BRAND_DIR = path.resolve("docs/brand");
const OUT_DIR = path.resolve("mobile/assets");
const SIZE = 1024;

const fullBleed = await fs.readFile(path.join(BRAND_DIR, "brand-icon-fullbleed.svg"), "utf8");
const monochrome = await fs.readFile(path.join(BRAND_DIR, "brand-icon-monochrome.svg"), "utf8");

/** Inner markup of an <svg> element (everything between the root tags). */
function innerSvg(svg) {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

const fullBleedInner = innerSvg(fullBleed).replace(/<title[\s\S]*?<\/title>/, "");
const defs = /<defs>[\s\S]*?<\/defs>/.exec(fullBleedInner)[0];
// The two full-size rects are the plate; everything after them is the keycap.
const plateEnd = fullBleedInner.indexOf("<!-- Raised white keycap");
const plate = fullBleedInner.slice(fullBleedInner.indexOf("</defs>") + "</defs>".length, plateEnd);
const keycap = fullBleedInner.slice(plateEnd);
const monochromeShapes = innerSvg(monochrome)
  .replace(/<title[\s\S]*?<\/title>/, "")
  .replaceAll('fill="#000000"', 'fill="#FFFFFF"');

const svg = (viewBox, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="${SIZE}" height="${SIZE}">${body}</svg>`;

// The keycap fills ~57% of the full-bleed icon. Android shows only the inner
// 72/108 of the adaptive canvas, so it is scaled to 80% to keep the same
// proportions on screen and clear any launcher mask.
const ADAPTIVE_SCALE = "translate(64 64) scale(0.8) translate(-64 -64)";

const outputs = [
  { file: "icon.png", svg: fullBleed, opaque: true },
  { file: "android-icon-background.png", svg: svg("0 0 128 128", defs + plate), opaque: true },
  {
    file: "android-icon-foreground.png",
    svg: svg("0 0 128 128", `${defs}<g transform="${ADAPTIVE_SCALE}">${keycap}</g>`),
  },
  {
    file: "android-icon-monochrome.png",
    svg: svg("0 0 128 128", `<g transform="${ADAPTIVE_SCALE}">${monochromeShapes}</g>`),
  },
  // Cropped to the keycap (x 30-98, y 27-100) with a small margin.
  { file: "splash-icon.png", svg: svg("24 23 80 80", defs + keycap) },
];

await fs.mkdir(OUT_DIR, { recursive: true });
let failed = false;
for (const { file, svg: source, opaque } of outputs) {
  const target = path.join(OUT_DIR, file);
  let image = sharp(Buffer.from(source), { density: 72 * (SIZE / 128) }).resize(SIZE, SIZE);
  image = opaque ? image.flatten({ background: "#7927EC" }).removeAlpha() : image.ensureAlpha();
  await image.png({ compressionLevel: 9 }).toFile(target);

  const meta = await sharp(target).metadata();
  const ok = meta.width === SIZE && meta.height === SIZE && meta.channels === (opaque ? 3 : 4);
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${path.relative(process.cwd(), target)} ${meta.width}x${meta.height} ch=${meta.channels}`);
}
process.exit(failed ? 1 : 0);
