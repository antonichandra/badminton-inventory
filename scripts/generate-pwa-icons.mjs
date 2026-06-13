import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const publicDir = path.join(root, "public");
const iconsDir = path.join(publicDir, "icons");
const splashDir = path.join(publicDir, "splash");
const markSourcePng = path.join(publicDir, "images", "courtly-mark-source.png");
const markPng = path.join(publicDir, "images", "courtly-mark.png");
const iconSvg = path.join(publicDir, "icon.svg");

const ICON_BACKGROUND = { r: 255, g: 255, b: 255, alpha: 1 }; // #FFFFFF
const MASKABLE_PADDING_RATIO = 0.2;

const ICON_SIZES = [
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "favicon-32.png", size: 32 },
  { name: "favicon-16.png", size: 16 },
];

const SPLASH_SIZES = [
  { name: "splash-1170x2532.png", width: 1170, height: 2532 },
  { name: "splash-1284x2778.png", width: 1284, height: 2778 },
  { name: "splash-750x1334.png", width: 750, height: 1334 },
  { name: "splash-2048x2732.png", width: 2048, height: 2732 },
];

async function centerMarkFromSource(sourceBuffer) {
  const trimmed = await sharp(sourceBuffer).trim({ threshold: 15 }).png().toBuffer();
  const meta = await sharp(trimmed).metadata();
  const canvas = 512;
  const padding = 72;
  const max = canvas - padding * 2;
  const scale = Math.min(max / meta.width, max / meta.height);
  const width = Math.round(meta.width * scale);
  const height = Math.round(meta.height * scale);
  const resized = await sharp(trimmed).resize(width, height).png().toBuffer();

  return sharp({
    create: {
      width: canvas,
      height: canvas,
      channels: 4,
      background: ICON_BACKGROUND,
    },
  })
    .composite([{ input: resized, gravity: "center" }])
    .png()
    .toBuffer();
}

async function renderIconFromMark(markBuffer, size, padding = 0) {
  const inner = size - padding * 2;
  const png = await sharp(markBuffer)
    .resize(inner, inner, { fit: "contain", background: ICON_BACKGROUND })
    .png()
    .toBuffer();

  if (padding === 0) {
    return png;
  }

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: ICON_BACKGROUND,
    },
  })
    .composite([{ input: png, gravity: "center" }])
    .png()
    .toBuffer();
}

async function renderSplashFromMark(markBuffer, width, height) {
  const markSize = Math.round(width * 0.42);
  const mark = await sharp(markBuffer)
    .resize(markSize, markSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const titleSize = Math.round(width * 0.096);
  const subtitleSize = Math.round(width * 0.034);
  const titleY = Math.round(height * 0.58);
  const subtitleY = Math.round(height * 0.615);

  const textSvg = Buffer.from(`<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
    <text x="50%" y="${titleY}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${titleSize}" font-weight="700" letter-spacing="12" fill="#0F172A">COURTLY</text>
    <text x="50%" y="${subtitleY}" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="${subtitleSize}" font-weight="500" fill="#64748B">Your Digital Court Assets, Managed.</text>
  </svg>`);

  const textLayer = await sharp(textSvg).png().toBuffer();

  return sharp({
    create: {
      width,
      height,
      channels: 4,
      background: ICON_BACKGROUND,
    },
  })
    .composite([
      {
        input: mark,
        top: Math.round(height * 0.34),
        left: Math.round((width - markSize) / 2),
      },
      { input: textLayer, top: 0, left: 0 },
    ])
    .png()
    .toBuffer();
}

async function writeIconSvg(markBuffer) {
  const base64 = markBuffer.toString("base64");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <image width="512" height="512" href="data:image/png;base64,${base64}"/>
</svg>
`;
  await writeFile(iconSvg, svg);
}

async function main() {
  let markBuffer;
  try {
    const sourceBuffer = await readFile(markSourcePng);
    markBuffer = await centerMarkFromSource(sourceBuffer);
    await writeFile(markPng, markBuffer);
    console.log("Centered public/images/courtly-mark.png from source");
  } catch {
    markBuffer = await readFile(markPng);
  }

  await writeIconSvg(markBuffer);
  console.log("Wrote public/icon.svg");

  const svgBuffer = await readFile(iconSvg);
  await mkdir(iconsDir, { recursive: true });
  await mkdir(splashDir, { recursive: true });

  for (const { name, size } of ICON_SIZES) {
    const outPath = name.startsWith("favicon")
      ? path.join(publicDir, name)
      : path.join(iconsDir, name);
    const png = await renderIconFromMark(markBuffer, size);
    await writeFile(outPath, png);
    console.log(`Wrote ${path.relative(root, outPath)}`);
  }

  const maskablePadding = Math.round(512 * MASKABLE_PADDING_RATIO);
  const maskable = await renderIconFromMark(markBuffer, 512, maskablePadding);
  await writeFile(path.join(iconsDir, "icon-512-maskable.png"), maskable);
  console.log("Wrote public/icons/icon-512-maskable.png");

  await writeFile(path.join(publicDir, "favicon.svg"), svgBuffer.toString("utf8").replace(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"',
    '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 512 512"',
  ));
  console.log("Wrote public/favicon.svg");

  for (const { name, width, height } of SPLASH_SIZES) {
    const outPath = path.join(splashDir, name);
    const png = await renderSplashFromMark(markBuffer, width, height);
    await writeFile(outPath, png);
    console.log(`Wrote ${path.relative(root, outPath)}`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
