import { deflateSync } from 'node:zlib';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUTPUT = join(ROOT, 'assets');
mkdirSync(OUTPUT, { recursive: true });

const CRC_TABLE = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1);
  return crc >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const name = Buffer.from(type, 'ascii');
  const body = Buffer.concat([name, data]);
  const out = Buffer.alloc(data.length + 12);
  out.writeUInt32BE(data.length, 0);
  body.copy(out, 4);
  out.writeUInt32BE(crc32(body), data.length + 8);
  return out;
}

function render(size) {
  const pixels = Buffer.alloc(size * size * 4);
  const cx = (size - 1) / 2;
  const cy = cx;
  const radius = size * 0.31;
  const ring = size * 0.018;
  const tickInner = radius * 0.78;
  const tickOuter = radius * 0.91;

  function blend(index, r, g, b, alpha = 1) {
    const inv = 1 - alpha;
    pixels[index] = Math.round(pixels[index] * inv + r * alpha);
    pixels[index + 1] = Math.round(pixels[index + 1] * inv + g * alpha);
    pixels[index + 2] = Math.round(pixels[index + 2] * inv + b * alpha);
    pixels[index + 3] = 255;
  }

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const index = (y * size + x) * 4;
      const dx = x - cx;
      const dy = y - cy;
      const distance = Math.hypot(dx, dy);
      const edge = Math.min(1, distance / (size * 0.7));
      pixels[index] = Math.round(8 + 8 * (1 - edge));
      pixels[index + 1] = Math.round(4 + 5 * (1 - edge));
      pixels[index + 2] = Math.round(22 + 22 * (1 - edge));
      pixels[index + 3] = 255;

      const aura = Math.max(0, 1 - Math.abs(distance - radius) / (ring * 5));
      if (aura) blend(index, 40, 120, 220, aura * 0.18);
      if (Math.abs(distance - radius) <= ring) blend(index, 0, 240, 255, 0.95);

      const angle = (Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2);
      const tickAngle = Math.PI * 2 / 12;
      const nearestTick = Math.round(angle / tickAngle) * tickAngle;
      const angularError = Math.abs(Math.atan2(Math.sin(angle - nearestTick), Math.cos(angle - nearestTick)));
      if (distance >= tickInner && distance <= tickOuter && angularError < 0.018) blend(index, 230, 239, 255, 0.9);

      const handAngle = -Math.PI / 3;
      const along = dx * Math.cos(handAngle) + dy * Math.sin(handAngle);
      const across = Math.abs(-dx * Math.sin(handAngle) + dy * Math.cos(handAngle));
      if (along >= -radius * 0.14 && along <= radius * 0.72 && across <= ring * 1.35) blend(index, 255, 43, 181, 0.98);
      if (distance <= ring * 3.1) blend(index, 255, 224, 102, 1);
    }
  }

  const rowBytes = size * 4 + 1;
  const raw = Buffer.alloc(rowBytes * size);
  for (let y = 0; y < size; y++) pixels.copy(raw, y * rowBytes + 1, y * size * 4, (y + 1) * size * 4);
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', header),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

for (const size of [180, 192, 512]) {
  writeFileSync(join(OUTPUT, `icon-${size}.png`), render(size));
  console.log(`generated assets/icon-${size}.png`);
}
