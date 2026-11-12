// Genera los iconos PNG (sin dependencias) a partir de una forma sencilla. Uso: node scripts/make-icons.mjs
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const t = Buffer.from(type);
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const c = Buffer.alloc(4);
  c.writeUInt32BE(crc(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, c]);
};

function png(size, { maskable }) {
  const navy = [15, 39, 66],
    gold = [232, 176, 74],
    cream = [246, 244, 239];
  const raw = Buffer.alloc((size * 4 + 1) * size);
  const r = size * (maskable ? 0.22 : 0.235),
    line = size * 0.04,
    corner = size * 0.22;
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const cx = x + 0.5 - size / 2,
        cy = y + 0.5 - size / 2;
      let px = [...navy, 255];
      if (!maskable) {
        // esquinas redondeadas transparentes
        const ax = Math.abs(cx) - (size / 2 - corner),
          ay = Math.abs(cy) - (size / 2 - corner);
        if (ax > 0 && ay > 0 && Math.hypot(ax, ay) > corner) px = [0, 0, 0, 0];
      }
      if (px[3]) {
        if (Math.hypot(cx, cy) < r * 1.0 * (size / size)) px = [...gold, 255];
        if (Math.abs(cy - size * 0.16) < line / 2 && Math.abs(cx) < size * 0.28) px = [...cream, 255];
      }
      raw.set(px, y * (size * 4 + 1) + 1 + x * 4);
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}
const out = 'src/icons/';
writeFileSync(out + 'icon-192.png', png(192, { maskable: false }));
writeFileSync(out + 'icon-512.png', png(512, { maskable: false }));
writeFileSync(out + 'icon-maskable-512.png', png(512, { maskable: true }));
writeFileSync(out + 'apple-touch-icon.png', png(180, { maskable: true }));
