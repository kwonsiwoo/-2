// PNG 아이콘 생성 스크립트 (외부 패키지 없이 순수 Node.js)
import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
  const table = Array.from({ length: 256 }, (_, i) => {
    let c = i;
    for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    return c >>> 0;
  });
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = (crc >>> 8) ^ table[(crc ^ b) & 0xFF];
  return ((crc ^ 0xFFFFFFFF) >>> 0);
}

function chunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const crcVal = Buffer.alloc(4); crcVal.writeUInt32BE(crc32(Buffer.concat([t, data])));
  return Buffer.concat([len, t, data, crcVal]);
}

function makePNG(size, r, g, b) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 2; // 8-bit RGB

  // 둥근 모서리 + 브랜드 컬러 배경
  const rows = [];
  const radius = Math.floor(size * 0.2);
  for (let y = 0; y < size; y++) {
    const row = Buffer.alloc(1 + size * 3);
    for (let x = 0; x < size; x++) {
      // 모서리 반경 처리
      const inCorner = (
        (x < radius && y < radius && Math.hypot(x - radius, y - radius) > radius) ||
        (x > size - radius - 1 && y < radius && Math.hypot(x - (size - radius - 1), y - radius) > radius) ||
        (x < radius && y > size - radius - 1 && Math.hypot(x - radius, y - (size - radius - 1)) > radius) ||
        (x > size - radius - 1 && y > size - radius - 1 && Math.hypot(x - (size - radius - 1), y - (size - radius - 1)) > radius)
      );
      const i = 1 + x * 3;
      if (inCorner) { row[i] = 240; row[i+1] = 249; row[i+2] = 255; } // 배경색
      else { row[i] = r; row[i+1] = g; row[i+2] = b; }
    }
    rows.push(row);
  }
  const idat = deflateSync(Buffer.concat(rows));
  const sig = Buffer.from([137,80,78,71,13,10,26,10]);
  return Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0))]);
}

const outDir = join(__dirname, '..', 'public', 'icons');
mkdirSync(outDir, { recursive: true });

// #4CC9F0 = R:76 G:201 B:240
writeFileSync(join(outDir, 'icon-192.png'), makePNG(192, 76, 201, 240));
writeFileSync(join(outDir, 'icon-512.png'), makePNG(512, 76, 201, 240));
console.log('✅ icon-192.png, icon-512.png 생성 완료');
