/**
 * ZRH Technology Group — generate official logo pack from blue-white master.
 * Source (only): public/branding/zrh-logo-blue-white-master.png
 * Run: node scripts/generate-brand-assets.mjs
 *
 * Rules: no recolor filters; no cover-crop of logo subject;
 * square icons via dark-blue canvas + contain + safe padding.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const brandingDir = path.join(root, 'public', 'branding');
const brandDir = path.join(root, 'public', 'brand');
const publicDir = path.join(root, 'public');
const masterPath = path.join(brandingDir, 'zrh-logo-blue-white-master.png');

/** Deep navy sampled to match master background */
const PAD_COLOR = { r: 6, g: 18, b: 42, alpha: 1 };

const SIZES = [1024, 512, 256, 192, 180, 128, 96, 64, 48, 32, 16];

/**
 * Place 4:3 (or any) master into a square canvas with ~8% safe padding.
 * Uses contain — never cover/crop the subject.
 */
async function squareFromMaster(size, padRatio = 0.08) {
  const inner = Math.round(size * (1 - padRatio * 2));
  const logo = await sharp(masterPath)
    .resize(inner, inner, {
      fit: 'contain',
      background: PAD_COLOR,
      withoutEnlargement: false,
    })
    .png()
    .toBuffer();
  const meta = await sharp(logo).metadata();
  const left = Math.max(0, Math.round((size - (meta.width || inner)) / 2));
  const top = Math.max(0, Math.round((size - (meta.height || inner)) / 2));
  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: PAD_COLOR,
    },
  })
    .composite([{ input: logo, left, top }])
    .png()
    .toBuffer();
}

async function writePng(filePath, buf) {
  await fs.promises.mkdir(path.dirname(filePath), { recursive: true });
  await fs.promises.writeFile(filePath, buf);
}

async function main() {
  if (!fs.existsSync(masterPath)) {
    throw new Error(
      `Missing official master logo: ${masterPath}\n` +
        'Place 赵总确认的蓝白科技 Logo 为 frontend/public/branding/zrh-logo-blue-white-master.png and re-run.',
    );
  }

  fs.mkdirSync(brandingDir, { recursive: true });
  fs.mkdirSync(brandDir, { recursive: true });

  // Read master in-memory (do not rewrite the master file in place)
  const masterMeta = await sharp(masterPath).metadata();
  console.log('Master:', masterMeta.width, 'x', masterMeta.height, masterMeta.format);

  // Full-bleed official PNG (original aspect, no stretch)
  const logoFull = await sharp(masterPath)
    .resize(1448, 1086, { fit: 'inside', withoutEnlargement: false })
    .png()
    .toBuffer();
  await writePng(path.join(brandingDir, 'zrh-logo.png'), logoFull);

  const square1024 = await squareFromMaster(1024, 0.08);
  await writePng(path.join(brandingDir, 'zrh-logo-1024.png'), square1024);

  for (const size of SIZES) {
    const buf = size === 1024 ? square1024 : await squareFromMaster(size, 0.08);
    await writePng(path.join(brandingDir, `zrh-logo-${size}.png`), buf);
    // Compatibility aliases under /brand for existing BrandMark paths
    await writePng(path.join(brandDir, `zrh-ai-icon-${size}.png`), buf);
  }

  // Canonical aliases
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-180.png'),
    path.join(brandingDir, 'apple-touch-icon.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-180.png'),
    path.join(brandDir, 'apple-touch-icon.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-192.png'),
    path.join(brandingDir, 'manifest-icon-192.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-512.png'),
    path.join(brandingDir, 'manifest-icon-512.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-192.png'),
    path.join(brandDir, 'pwa-192.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-512.png'),
    path.join(brandDir, 'pwa-512.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-1024.png'),
    path.join(brandDir, 'zrh-ai-icon-official-v1.png'),
  );

  // Favicons
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-32.png'),
    path.join(brandDir, 'favicon-32.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-32.png'),
    path.join(publicDir, 'favicon-32x32.png'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-16.png'),
    path.join(publicDir, 'favicon-16x16.png'),
  );
  // Static servers often expect .ico; emit PNG-compatible 48px as favicon.ico fallback
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-48.png'),
    path.join(publicDir, 'favicon.ico'),
  );
  await fs.promises.copyFile(
    path.join(brandingDir, 'zrh-logo-32.png'),
    path.join(brandingDir, 'favicon.ico'),
  );

  // SVG wrappers (no redraw — embed official square PNG)
  const svgRef = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="ZRH Technology Group Official Logo">
  <title>ZRH Official Logo (Blue Tech)</title>
  <image width="1024" height="1024" href="./zrh-logo-1024.png" xlink:href="./zrh-logo-1024.png"/>
</svg>
`;
  await fs.promises.writeFile(path.join(brandingDir, 'zrh-logo.svg'), svgRef, 'utf8');
  // Same asset for light/dark contexts (master already has navy field; no filter recolor)
  await fs.promises.writeFile(path.join(brandingDir, 'zrh-logo-dark.svg'), svgRef, 'utf8');
  await fs.promises.writeFile(path.join(brandingDir, 'zrh-logo-white.svg'), svgRef, 'utf8');

  const brandSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"
  width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="ZRH AI Official Logo">
  <title>ZRH AI Official Logo (Blue Tech)</title>
  <image width="1024" height="1024" href="./zrh-ai-icon-1024.png" xlink:href="./zrh-ai-icon-1024.png"/>
</svg>
`;
  await fs.promises.writeFile(path.join(brandDir, 'zrh-ai-icon.svg'), brandSvg, 'utf8');

  const b64 = square1024.toString('base64');
  const svgInline = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024" role="img" aria-label="ZRH AI">
  <image width="1024" height="1024" href="data:image/png;base64,${b64}"/>
</svg>
`;
  await fs.promises.writeFile(path.join(brandDir, 'zrh-ai-icon-inline.svg'), svgInline, 'utf8');

  // Open Graph — navy tech field (no gold)
  const ogW = 1200;
  const ogH = 630;
  const ogIcon = 360;
  const ogBg = Buffer.from(
    `<svg width="${ogW}" height="${ogH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <radialGradient id="g" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stop-color="#0f2744"/>
          <stop offset="55%" stop-color="#071525"/>
          <stop offset="100%" stop-color="#040b14"/>
        </radialGradient>
        <linearGradient id="line" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#3b82f6" stop-opacity="0"/>
          <stop offset="50%" stop-color="#60a5fa" stop-opacity="0.55"/>
          <stop offset="100%" stop-color="#3b82f6" stop-opacity="0"/>
        </linearGradient>
      </defs>
      <rect width="100%" height="100%" fill="url(#g)"/>
      <rect y="312" width="100%" height="1" fill="url(#line)"/>
      <text x="600" y="560" text-anchor="middle" font-family="Segoe UI, Helvetica, Arial, sans-serif"
        font-size="26" fill="#93c5fd" letter-spacing="6">ZRH TECHNOLOGY GROUP</text>
    </svg>`,
  );
  const ogIconBuf = await squareFromMaster(ogIcon, 0.06);
  await sharp(ogBg)
    .composite([{ input: ogIconBuf, top: Math.round((ogH - ogIcon) / 2) - 28, left: Math.round((ogW - ogIcon) / 2) }])
    .png()
    .toFile(path.join(brandDir, 'og-share-1200x630.png'));
  await fs.promises.copyFile(
    path.join(brandDir, 'og-share-1200x630.png'),
    path.join(brandingDir, 'og-share-1200x630.png'),
  );

  async function splash(w, h, outName) {
    const iconSize = Math.round(Math.min(w, h) * 0.38);
    const bg = Buffer.from(
      `<svg width="${w}" height="${h}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="g" cx="50%" cy="40%" r="70%">
            <stop offset="0%" stop-color="#0f2744"/>
            <stop offset="100%" stop-color="#040b14"/>
          </radialGradient>
        </defs>
        <rect width="100%" height="100%" fill="url(#g)"/>
        <text x="${w / 2}" y="${h * 0.78}" text-anchor="middle"
          font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${Math.round(w * 0.028)}"
          fill="#93c5fd" letter-spacing="6">ZRH AI</text>
        <text x="${w / 2}" y="${h * 0.78 + Math.round(w * 0.032)}" text-anchor="middle"
          font-family="Segoe UI, Helvetica, Arial, sans-serif" font-size="${Math.round(w * 0.016)}"
          fill="#64748b" letter-spacing="4">ENTERPRISE</text>
      </svg>`,
    );
    const icon = await squareFromMaster(iconSize, 0.06);
    await sharp(bg)
      .composite([{ input: icon, top: Math.round(h * 0.22), left: Math.round((w - iconSize) / 2) }])
      .png()
      .toFile(path.join(brandDir, outName));
    await fs.promises.copyFile(path.join(brandDir, outName), path.join(brandingDir, outName));
  }
  await splash(1280, 720, 'splash-1280x720.png');
  await splash(1080, 1920, 'splash-1080x1920.png');
  await splash(2048, 2048, 'splash-2048.png');

  // Remove superseded old official source filename from active brand (archived separately)
  const retired = [
    path.join(brandDir, 'zrh-ai-icon-official-v1-source.png'),
  ];
  for (const f of retired) {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  }

  console.log('Official logo pack generated from', masterPath);
  console.log('brandingDir:', brandingDir);
  console.log('brandDir:', brandDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
