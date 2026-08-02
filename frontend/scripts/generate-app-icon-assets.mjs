/**
 * ZRH AI Official App Icon pack — desktop / PWA / favicon / splash only.
 * Master: public/branding/zrh-ai-app-icon-master.png
 * Does NOT overwrite horizontal brand logo (zrh-logo-*).
 * Run: node scripts/generate-app-icon-assets.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const brandingDir = path.join(root, 'public', 'branding');
const publicDir = path.join(root, 'public');
const masterPath = path.join(brandingDir, 'zrh-ai-app-icon-master.png');

const PAD = { r: 5, g: 8, b: 14, alpha: 1 };
const SIZES = [1024, 512, 384, 256, 192, 180, 152, 144, 128, 96, 72, 64, 48, 32, 16];

async function writePng(filePath, buf) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buf);
}

/** Square resize — cover (master already square 1024). */
async function square(size) {
  return sharp(masterPath)
    .resize(size, size, { fit: 'cover' })
    .png()
    .toBuffer();
}

/** Maskable / adaptive: keep ~12% safe padding on dark canvas. */
async function maskable(size, padRatio = 0.12) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const icon = await sharp(masterPath)
    .resize(inner, inner, { fit: 'contain', background: PAD })
    .png()
    .toBuffer();
  const meta = await sharp(icon).metadata();
  const left = Math.max(0, Math.round((size - (meta.width || inner)) / 2));
  const top = Math.max(0, Math.round((size - (meta.height || inner)) / 2));
  return sharp({
    create: { width: size, height: size, channels: 4, background: PAD },
  })
    .composite([{ input: icon, left, top }])
    .png()
    .toBuffer();
}

async function main() {
  if (!fs.existsSync(masterPath)) {
    throw new Error(`Missing app icon master: ${masterPath}`);
  }
  const meta = await sharp(masterPath).metadata();
  console.log('App icon master:', meta.width, 'x', meta.height, meta.format);

  const masterPng = await sharp(masterPath).png().toBuffer();
  await writePng(path.join(brandingDir, 'zrh-ai-app-icon-1024.png'), masterPng);
  await writePng(path.join(brandingDir, 'app-icon-1024.png'), await square(1024));

  for (const size of SIZES) {
    if (size === 1024) continue;
    await writePng(path.join(brandingDir, `app-icon-${size}.png`), await square(size));
  }

  // Maskable / adaptive
  await writePng(path.join(brandingDir, 'app-icon-maskable-192.png'), await maskable(192, 0.12));
  await writePng(path.join(brandingDir, 'app-icon-maskable-512.png'), await maskable(512, 0.12));
  await writePng(path.join(brandingDir, 'app-icon-adaptive-432.png'), await maskable(432, 0.18));

  // Manifest / PWA aliases (new filenames — avoid stale CF /brand caches)
  await fs.promises.copyFile(
    path.join(brandingDir, 'app-icon-192.png'),
    path.join(brandingDir, 'manifest-icon-192.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'app-icon-512.png'),
    path.join(brandingDir, 'manifest-icon-512.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'app-icon-180.png'),
    path.join(brandingDir, 'apple-touch-icon.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'app-icon-180.png'),
    path.join(publicDir, 'apple-touch-icon.png'),
  );

  // Favicons from app icon
  await fs.promises.copyFile(
    path.join(brandingDir, 'app-icon-32.png'),
    path.join(publicDir, 'favicon-32x32.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'app-icon-16.png'),
    path.join(publicDir, 'favicon-16x16.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'app-icon-48.png'),
    path.join(publicDir, 'favicon.ico'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'app-icon-32.png'),
    path.join(brandingDir, 'favicon-32.png'),
  );

  // SVG wrapper + safari pinned tab (monochrome mask approximate via dark silhouette not available —
  // use full-color SVG reference for icon; mask-icon href points to SVG)
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="ZRH AI App Icon">
  <title>ZRH AI Official App Icon</title>
  <image width="1024" height="1024" href="./app-icon-1024.png" xlink:href="./app-icon-1024.png"/>
</svg>
`;
  await fs.promises.writeFile(path.join(brandingDir, 'app-icon.svg'), svg, 'utf8');
  await fs.promises.writeFile(path.join(brandingDir, 'safari-pinned-tab.svg'), svg, 'utf8');

  // Splash — app icon centered on dark field (not horizontal logo)
  async function splash(w, h, outName) {
    const iconSize = Math.round(Math.min(w, h) * 0.42);
    const bg = Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <rect width="100%" height="100%" fill="#05070d"/>
        <text x="${w / 2}" y="${h * 0.82}" text-anchor="middle"
          font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${Math.round(w * 0.03)}"
          fill="#60a5fa" letter-spacing="4">ZRH AI</text>
      </svg>`,
    );
    const icon = await square(iconSize);
    await sharp(bg)
      .composite([{ input: icon, top: Math.round((h - iconSize) / 2) - Math.round(h * 0.04), left: Math.round((w - iconSize) / 2) }])
      .png()
      .toFile(path.join(brandingDir, outName));
  }
  await splash(1280, 720, 'splash-1280x720.png');
  await splash(1080, 1920, 'splash-1080x1920.png');
  await splash(2048, 2048, 'splash-2048.png');

  // Share / OG small — 1200x630 with app icon (does not touch horizontal brand banner asset name history:
  // write og-app-share; leave zrh-logo-based og-share file untouched on disk if present)
  const ogW = 1200;
  const ogH = 630;
  const ogIcon = 360;
  const ogBg = Buffer.from(
    `<svg width="${ogW}" height="${ogH}" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#05070d"/>
      <text x="600" y="560" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif"
        font-size="26" fill="#93c5fd" letter-spacing="4">ZRH AI</text>
    </svg>`,
  );
  const ogIconBuf = await square(ogIcon);
  await sharp(ogBg)
    .composite([{ input: ogIconBuf, top: Math.round((ogH - ogIcon) / 2) - 20, left: Math.round((ogW - ogIcon) / 2) }])
    .png()
    .toFile(path.join(brandingDir, 'og-app-share-1200x630.png'));

  console.log('App icon pack written to', brandingDir);
  console.log('Horizontal brand logos (zrh-logo-*) were not modified.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
