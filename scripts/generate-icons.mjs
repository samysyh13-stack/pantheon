#!/usr/bin/env node
// Generates solid-gold PWA icons (192 / 512 / maskable 512) and a 1200x630
// Open Graph image. Hand-rolled PNG encoder — no npm deps needed (sharp /
// canvas would bloat the repo). Phase 4 polish may replace these with
// actually-designed glyphs (Anansi silhouette on gold), but a solid-color
// icon unblocks PWA install + OG preview for v1.0.

import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import { deflateSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';

// PANTHÉON gold — matches DESIGN §6.1 Anansi signature color.
const GOLD = [0xd4, 0xa2, 0x4a, 0xff];
const DEEP_BG = [0x0f, 0x12, 0x18, 0xff];

// CRC32 table for PNG chunk checksums.
const CRC_TABLE = new Uint32Array(256);
for (let n = 0; n < 256; n++) {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  CRC_TABLE[n] = c >>> 0;
}
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function makeChunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

/**
 * Create a PNG with a radial-gradient-ish "circle on dark bg" — dark
 * background, a filled circle (r = width * 0.42) in gold, centered. This
 * reads as a "sigil on the void" which matches the mythological-coin
 * feel we want for the icon.
 *
 * For the maskable variant, the circle is smaller (r * 0.65) so the
 * center-safe-zone (40% of min dimension) is fully inside the gold
 * area — masking crops don't cut the glyph.
 */
function renderCirclePng(width, height, bg, fg, fgRadiusRatio = 0.42) {
  const SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6; // RGBA
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;
  const ihdrChunk = makeChunk('IHDR', ihdr);

  const cx = width / 2;
  const cy = height / 2;
  const r = Math.min(width, height) * fgRadiusRatio;
  const r2 = r * r;

  const rowBytes = width * 4;
  const raw = Buffer.alloc(height * (1 + rowBytes));
  let off = 0;
  for (let y = 0; y < height; y++) {
    raw[off++] = 0; // filter byte (none)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const inside = dx * dx + dy * dy <= r2;
      const color = inside ? fg : bg;
      raw[off++] = color[0];
      raw[off++] = color[1];
      raw[off++] = color[2];
      raw[off++] = color[3];
    }
  }

  const idatChunk = makeChunk('IDAT', deflateSync(raw, { level: 9 }));
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([SIG, ihdrChunk, idatChunk, iendChunk]);
}

function write(path, bytes) {
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, bytes);
  const kb = (bytes.length / 1024).toFixed(1);
  console.log(`wrote ${path} (${kb} KB, ${bytes.length} bytes)`);
}

const __filename = fileURLToPath(import.meta.url);
const repoRoot = dirname(dirname(__filename));

write(`${repoRoot}/public/icons/icon-192.png`, renderCirclePng(192, 192, DEEP_BG, GOLD, 0.42));
write(`${repoRoot}/public/icons/icon-512.png`, renderCirclePng(512, 512, DEEP_BG, GOLD, 0.42));
write(
  `${repoRoot}/public/icons/icon-maskable.png`,
  renderCirclePng(512, 512, GOLD, GOLD, 0.5), // maskable: full-bleed gold
);
// Open Graph image (1.91:1 for Twitter + Facebook)
write(`${repoRoot}/public/icons/og-image.png`, renderCirclePng(1200, 630, DEEP_BG, GOLD, 0.22));

console.log('done.');
