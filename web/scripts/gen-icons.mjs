// Generates BrightKids PWA icons as PNGs with no external image tooling — a
// tiny hand-rolled PNG encoder (zlib + CRC32). Draws a Bibo-style mark: indigo
// sky, violet droid head, glowing antenna, teal eyes.
import zlib from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const outDir = resolve(here, "../public/icons");
mkdirSync(outDir, { recursive: true });

const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function px(rgba, w, x, y, [r, g, b, a]) {
  const i = (y * w + x) * 4;
  rgba[i] = r;
  rgba[i + 1] = g;
  rgba[i + 2] = b;
  rgba[i + 3] = a;
}

function draw(size) {
  const rgba = Buffer.alloc(size * size * 4);
  const c = size / 2;
  const headR = size * 0.32;
  const eyeR = size * 0.05;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Indigo rounded background.
      px(rgba, size, x, y, [27, 27, 58, 255]);
      // Antenna glow dot.
      if (Math.hypot(x - c, y - size * 0.16) < size * 0.06) px(rgba, size, x, y, [255, 209, 102, 255]);
      // Droid head.
      if (Math.hypot(x - c, y - c * 1.1) < headR) px(rgba, size, x, y, [108, 92, 231, 255]);
      // Visor.
      if (Math.hypot(x - c, y - c * 1.05) < headR * 0.62 && y > c * 0.95)
        px(rgba, size, x, y, [19, 19, 43, 255]);
      // Eyes.
      if (Math.hypot(x - (c - headR * 0.28), y - c * 1.08) < eyeR) px(rgba, size, x, y, [127, 224, 214, 255]);
      if (Math.hypot(x - (c + headR * 0.28), y - c * 1.08) < eyeR) px(rgba, size, x, y, [127, 224, 214, 255]);
    }
  }
  return rgba;
}

function encodePNG(size) {
  const rgba = draw(size);
  const stride = size * 4;
  const raw = Buffer.alloc((stride + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, y * stride + stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([
    sig,
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw)),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

for (const size of [192, 512]) {
  writeFileSync(resolve(outDir, `icon-${size}.png`), encodePNG(size));
  console.log(`wrote icon-${size}.png`);
}
