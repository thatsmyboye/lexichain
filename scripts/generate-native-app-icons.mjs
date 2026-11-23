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
 *   android-icon-background.png  1024², the indigo plate of the adaptive icon
 *   android-icon-foreground.png  1024², the tile and chain on transparency,
 *                                inside the adaptive icon's 66/108 safe zone
 *   android-icon-monochrome.png  1024², themed-icon silhouette (Android 13+)
 *   splash-icon.png              1024², the tile and chain alone, for the
 *                                splash screen
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const BRAND_DIR = path.resolve("docs/brand");
const OUT_DIR = path.resolve("mobile/assets");
const SIZE = 1024;
// Flattening colour for the opaque files (the plate already covers them).
const ICON_INDIGO = "#2A1272";

const fullBleed = await fs.readFile(path.join(BRAND_DIR, "brand-icon-fullbleed.svg"), "utf8");
const monochrome = await fs.readFile(path.join(BRAND_DIR, "brand-icon-monochrome.svg"), "utf8");

/** Inner markup of an <svg> element (everything between the root tags). */
function innerSvg(svg) {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, "").replace(/<\/svg>\s*$/, "");
}

// brand-icon-fullbleed.svg is <defs>, then the plate, then the mark; the two
// comments below are the split points.
const fullBleedInner = innerSvg(fullBleed).replace(/<title[\s\S]*?<\/title>/, "");
const defs = /<defs>[\s\S]*?<\/defs>/.exec(fullBleedInner)[0];
const plateStart = fullBleedInner.indexOf("<!-- Plate:");
const markStart = fullBleedInner.indexOf("<!-- Mark:");
if (plateStart === -1 || markStart === -1) {
  throw new Error('brand-icon-fullbleed.svg: missing the "<!-- Plate:" or "<!-- Mark:" comment');
}
const plate = fullBleedInner.slice(plateStart, markStart);
const mark = fullBleedInner.slice(markStart);
const monochromeShapes = innerSvg(monochrome)
  .replace(/<title[\s\S]*?<\/title>/, "")
  .replaceAll("#000000", "#FFFFFF");

const svg = (body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">${body}</svg>`;

// The mark's bounding circle in the 1024 source: centre (588, 582), radius 515.
// centredMark(scale) puts that centre in the middle of the canvas.
const centredMark = (scale) => `translate(512 512) scale(${scale}) translate(-588 -582)`;
// Android only guarantees the inner 66/108 of the adaptive canvas (a circle of
// radius 313 here), so the mark is scaled to 0.6 (radius 309) to clear any
// launcher mask. The monochrome source is already at 0.78, hence 0.6 / 0.78.
const ADAPTIVE_SCALE = 0.6;
const MONO_ADAPTIVE = `translate(512 512) scale(${(ADAPTIVE_SCALE / 0.78).toFixed(4)}) translate(-512 -512)`;

const outputs = [
  { file: "icon.png", svg: fullBleed, opaque: true },
  { file: "android-icon-background.png", svg: svg(defs + plate), opaque: true },
  {
    file: "android-icon-foreground.png",
    svg: svg(`${defs}<g transform="${centredMark(ADAPTIVE_SCALE)}">${mark}</g>`),
  },
  {
    file: "android-icon-monochrome.png",
    svg: svg(`<g transform="${MONO_ADAPTIVE}">${monochromeShapes}</g>`),
  },
  // The mark alone, filling the canvas with a small margin.
  { file: "splash-icon.png", svg: svg(`${defs}<g transform="${centredMark(0.94)}">${mark}</g>`) },
];

await fs.mkdir(OUT_DIR, { recursive: true });
let failed = false;
for (const { file, svg: source, opaque } of outputs) {
  const target = path.join(OUT_DIR, file);
  let image = sharp(Buffer.from(source)).resize(SIZE, SIZE);
  image = opaque ? image.flatten({ background: ICON_INDIGO }).removeAlpha() : image.ensureAlpha();
  await image.png({ compressionLevel: 9 }).toFile(target);

  const meta = await sharp(target).metadata();
  const ok = meta.width === SIZE && meta.height === SIZE && meta.channels === (opaque ? 3 : 4);
  if (!ok) failed = true;
  console.log(`${ok ? "ok  " : "FAIL"} ${path.relative(process.cwd(), target)} ${meta.width}x${meta.height} ch=${meta.channels}`);
}
process.exit(failed ? 1 : 0);
