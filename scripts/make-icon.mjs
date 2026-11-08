import { deflateSync } from "node:zlib";
import { writeFileSync } from "node:fs";

function crc32(buf) {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i];
    for (let k = 0; k < 8; k++) c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
  }
  return ~c >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const t = Buffer.from(type);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crc]);
}

const size = 256;

function pixel(x, y) {
  const cx = (size - 1) / 2;
  const cy = (size - 1) / 2;
  const dx = x - cx;
  const dy = y - cy;
  const dist = Math.sqrt(dx * dx + dy * dy);

  if (dist > 124) return [12, 10, 8, 255];

  const coin = Math.sqrt(dx * dx + (dy + 6) * (dy + 6));
  if (coin <= 86) {
    const stem = Math.abs(dx) < 10 && dy > -18 && dy < 36;
    const bar = Math.abs(dy + 8) < 8 && Math.abs(dx) < 34;
    if (stem || bar) return [62, 36, 8, 255];
    const light = Math.max(0, 1 - coin / 110);
    return [
      Math.min(255, Math.floor(210 + 40 * light)),
      Math.min(255, Math.floor(140 + 50 * light)),
      Math.floor(28 + 20 * light),
      255,
    ];
  }

  const ring = dist > 108;
  if (ring) return [48, 32, 14, 255];
  return [22, 17, 13, 255];
}

const raw = Buffer.alloc((size * 4 + 1) * size);
for (let y = 0; y < size; y++) {
  const row = y * (size * 4 + 1);
  raw[row] = 0;
  for (let x = 0; x < size; x++) {
    const [r, g, b, a] = pixel(x, y);
    const i = row + 1 + x * 4;
    raw[i] = r;
    raw[i + 1] = g;
    raw[i + 2] = b;
    raw[i + 3] = a;
  }
}

const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(size, 0);
ihdr.writeUInt32BE(size, 4);
ihdr[8] = 8;
ihdr[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  chunk("IHDR", ihdr),
  chunk("IDAT", deflateSync(raw)),
  chunk("IEND", Buffer.alloc(0)),
]);

writeFileSync(new URL("../public/icon.png", import.meta.url), png);
console.log("wrote public/icon.png", png.length, "bytes");
