import { mkdirSync, readdirSync, unlinkSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { deflateSync } from "node:zlib";

const root = dirname(dirname(fileURLToPath(import.meta.url)));

const colors = {
  ink: [7, 11, 20, 255],
  ink2: [18, 24, 38, 255],
  panel: [15, 23, 42, 255],
  blue: [21, 88, 176, 255],
  blue2: [33, 109, 238, 255],
  cyan: [84, 214, 255, 255],
  sky: [214, 232, 255, 255],
  white: [248, 250, 252, 255],
  line: [121, 180, 255, 255],
  glass: [50, 72, 112, 255],
  transparent: [0, 0, 0, 0]
};

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const name = Buffer.from(type);
  const length = Buffer.alloc(4);
  const crc = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  crc.writeUInt32BE(crc32(Buffer.concat([name, data])));
  return Buffer.concat([length, name, data, crc]);
}

function writePng(path, width, height, rgba) {
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * (width * 4 + 1);
    raw[rawOffset] = 0;
    rgba.copy(raw, rawOffset + 1, y * width * 4, (y + 1) * width * 4);
  }
  writeFileSync(path, Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", header),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND")
  ]));
}

function blend(image, width, x, y, color, alpha = 1) {
  if (x < 0 || y < 0 || x >= width || y >= image.length / width / 4) return;
  const offset = (y * width + x) * 4;
  const a = Math.max(0, Math.min(1, alpha * color[3] / 255));
  const inv = 1 - a;
  image[offset] = Math.round(color[0] * a + image[offset] * inv);
  image[offset + 1] = Math.round(color[1] * a + image[offset + 1] * inv);
  image[offset + 2] = Math.round(color[2] * a + image[offset + 2] * inv);
  image[offset + 3] = Math.round(255 * (a + image[offset + 3] / 255 * inv));
}

function fill(image, color) {
  for (let i = 0; i < image.length; i += 4) {
    image[i] = color[0];
    image[i + 1] = color[1];
    image[i + 2] = color[2];
    image[i + 3] = color[3];
  }
}

function drawRoundedRect(image, width, height, x, y, w, h, r, color) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.ceil(x + w);
  const y1 = Math.ceil(y + h);
  for (let py = y0; py < y1; py += 1) {
    for (let px = x0; px < x1; px += 1) {
      const dx = Math.max(x + r - (px + 0.5), 0, px + 0.5 - (x + w - r));
      const dy = Math.max(y + r - (py + 0.5), 0, py + 0.5 - (y + h - r));
      const dist = Math.sqrt(dx * dx + dy * dy);
      const alpha = Math.max(0, Math.min(1, r + 0.75 - dist));
      if (alpha > 0) blend(image, width, px, py, color, alpha);
    }
  }
}

function drawCircle(image, width, cx, cy, radius, color) {
  const x0 = Math.floor(cx - radius - 1);
  const y0 = Math.floor(cy - radius - 1);
  const x1 = Math.ceil(cx + radius + 1);
  const y1 = Math.ceil(cy + radius + 1);
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const dist = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
      const alpha = Math.max(0, Math.min(1, radius + 0.75 - dist));
      if (alpha > 0) blend(image, width, px, py, color, alpha);
    }
  }
}

function drawRing(image, width, cx, cy, radius, thickness, color) {
  const x0 = Math.floor(cx - radius - 1);
  const y0 = Math.floor(cy - radius - 1);
  const x1 = Math.ceil(cx + radius + 1);
  const y1 = Math.ceil(cy + radius + 1);
  const inner = Math.max(0, radius - thickness);
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const dist = Math.hypot(px + 0.5 - cx, py + 0.5 - cy);
      const outerAlpha = Math.max(0, Math.min(1, radius + 0.75 - dist));
      const innerAlpha = Math.max(0, Math.min(1, dist - inner + 0.75));
      const alpha = Math.min(outerAlpha, innerAlpha);
      if (alpha > 0) blend(image, width, px, py, color, alpha);
    }
  }
}

function drawMark(image, width, height, scale = 1) {
  const s = Math.min(width, height) * scale;
  const cx = width / 2;
  const cy = height / 2;
  drawRoundedRect(image, width, height, cx - s * 0.36, cy - s * 0.25, s * 0.72, s * 0.55, s * 0.14, colors.panel);
  drawRoundedRect(image, width, height, cx - s * 0.22, cy - s * 0.39, s * 0.44, s * 0.17, s * 0.06, colors.blue2);
  drawRoundedRect(image, width, height, cx + s * 0.18, cy - s * 0.2, s * 0.1, s * 0.06, s * 0.03, colors.cyan);
  drawCircle(image, width, cx, cy + s * 0.035, s * 0.23, colors.sky);
  drawCircle(image, width, cx, cy + s * 0.035, s * 0.18, colors.blue);
  drawCircle(image, width, cx, cy + s * 0.035, s * 0.125, colors.ink);
  drawRing(image, width, cx, cy + s * 0.035, s * 0.105, s * 0.022, colors.glass);
  for (let i = 0; i < 6; i += 1) {
    const angle = -Math.PI / 2 + i * Math.PI / 3;
    const px = cx + Math.cos(angle) * s * 0.061;
    const py = cy + s * 0.035 + Math.sin(angle) * s * 0.061;
    drawCircle(image, width, px, py, s * 0.022, i % 2 ? colors.blue2 : colors.cyan);
  }
  drawCircle(image, width, cx + s * 0.065, cy - s * 0.025, s * 0.028, colors.white);
  drawRoundedRect(image, width, height, cx - s * 0.18, cy + s * 0.265, s * 0.36, s * 0.035, s * 0.018, colors.line);
}

function makeIcon(size, { transparent = false, foreground = false, markScale = null } = {}) {
  const image = Buffer.alloc(size * size * 4);
  if (transparent) {
    fill(image, colors.transparent);
  } else {
    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const t = (x + y) / (size * 2);
        const radial = Math.hypot(x - size * 0.62, y - size * 0.32) / size;
        const c = colors.ink.map((v, i) => {
          if (i === 3) return 255;
          const base = Math.round(v * (1 - t) + colors.ink2[i] * t);
          return Math.min(255, Math.round(base + Math.max(0, 1 - radial * 1.8) * 18));
        });
        blend(image, size, x, y, c, 1);
      }
    }
  }
  drawMark(image, size, size, markScale ?? (foreground ? 0.62 : 0.78));
  return image;
}

const iosIconDir = join(root, "ios/App/App/Assets.xcassets/AppIcon.appiconset");
mkdirSync(iosIconDir, { recursive: true });
for (const entry of readdirSync(iosIconDir)) {
  if (entry.endsWith(".png")) unlinkSync(join(iosIconDir, entry));
}

const iosSlots = [
  ["AppIcon-20@2x.png", "iphone", "20x20", "2x", 40],
  ["AppIcon-20@3x.png", "iphone", "20x20", "3x", 60],
  ["AppIcon-29@2x.png", "iphone", "29x29", "2x", 58],
  ["AppIcon-29@3x.png", "iphone", "29x29", "3x", 87],
  ["AppIcon-40@2x.png", "iphone", "40x40", "2x", 80],
  ["AppIcon-40@3x.png", "iphone", "40x40", "3x", 120],
  ["AppIcon-60@2x.png", "iphone", "60x60", "2x", 120],
  ["AppIcon-60@3x.png", "iphone", "60x60", "3x", 180],
  ["AppIcon-20.png", "ipad", "20x20", "1x", 20],
  ["AppIcon-20@2x~ipad.png", "ipad", "20x20", "2x", 40],
  ["AppIcon-29.png", "ipad", "29x29", "1x", 29],
  ["AppIcon-29@2x~ipad.png", "ipad", "29x29", "2x", 58],
  ["AppIcon-40.png", "ipad", "40x40", "1x", 40],
  ["AppIcon-40@2x~ipad.png", "ipad", "40x40", "2x", 80],
  ["AppIcon-76.png", "ipad", "76x76", "1x", 76],
  ["AppIcon-76@2x.png", "ipad", "76x76", "2x", 152],
  ["AppIcon-83.5@2x.png", "ipad", "83.5x83.5", "2x", 167],
  ["AppIcon-1024.png", "ios-marketing", "1024x1024", "1x", 1024]
];

for (const [filename, , , , pixelSize] of iosSlots) {
  writePng(join(iosIconDir, filename), pixelSize, pixelSize, makeIcon(pixelSize, { markScale: 0.74 }));
}

writeFileSync(join(iosIconDir, "Contents.json"), `${JSON.stringify({
  images: iosSlots.map(([filename, idiom, size, scale]) => ({
    size,
    idiom,
    filename,
    scale
  })),
  info: {
    version: 1,
    author: "xcode"
  }
}, null, 2)}\n`);

const densities = [
  ["mipmap-mdpi", 48, 108],
  ["mipmap-hdpi", 72, 162],
  ["mipmap-xhdpi", 96, 216],
  ["mipmap-xxhdpi", 144, 324],
  ["mipmap-xxxhdpi", 192, 432]
];

for (const [dir, iconSize, foregroundSize] of densities) {
  const base = join(root, "android/app/src/main/res", dir);
  writePng(join(base, "ic_launcher.png"), iconSize, iconSize, makeIcon(iconSize, { markScale: 0.74 }));
  writePng(join(base, "ic_launcher_round.png"), iconSize, iconSize, makeIcon(iconSize, { markScale: 0.74 }));
  writePng(join(base, "ic_launcher_foreground.png"), foregroundSize, foregroundSize, makeIcon(foregroundSize, { transparent: true, foreground: true, markScale: 0.56 }));
}

console.log("Generated native app icons.");
