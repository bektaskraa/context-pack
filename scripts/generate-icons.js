// scripts/generate-icons.js
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function createPng(width, height, r, g, b) {
  // Minimal PNG generator without external dependencies
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  function chunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const body = Buffer.concat([typeBuf, data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(calculateCrc(body), 0);
    return Buffer.concat([len, body, crc]);
  }

  function calculateCrc(buf) {
    let c;
    const table = [];
    for (let n = 0; n < 256; n++) {
      c = n;
      for (let k = 0; k < 8; k++) {
        c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
      }
      table[n] = c;
    }
    let crc = 0 ^ (-1);
    for (let i = 0; i < buf.length; i++) {
      crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
    }
    return (crc ^ (-1)) >>> 0;
  }

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // color type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  // Raw image data with filter byte 0 at start of each scanline
  const scanlineLength = 1 + width * 3;
  const rawData = Buffer.alloc(scanlineLength * height);

  for (let y = 0; y < height; y++) {
    const rowOffset = y * scanlineLength;
    rawData[rowOffset] = 0; // filter type None
    for (let x = 0; x < width; x++) {
      const pixelOffset = rowOffset + 1 + x * 3;
      // Draw a pleasant indigo rounded box
      const isBorder = x === 0 || y === 0 || x === width - 1 || y === height - 1;
      if (isBorder) {
        rawData[pixelOffset] = 79;
        rawData[pixelOffset + 1] = 70;
        rawData[pixelOffset + 2] = 229;
      } else {
        rawData[pixelOffset] = r;
        rawData[pixelOffset + 1] = g;
        rawData[pixelOffset + 2] = b;
      }
    }
  }

  const compressedData = zlib.deflateSync(rawData);
  const idat = chunk('IDAT', compressedData);
  const iend = chunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, chunk('IHDR', ihdr), idat, iend]);
}

const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Generate indigo/purple icons
const png16 = createPng(16, 16, 99, 102, 241);
const png48 = createPng(48, 48, 79, 70, 229);
const png128 = createPng(128, 128, 67, 56, 202);

fs.writeFileSync(path.join(assetsDir, 'icon-16.png'), png16);
fs.writeFileSync(path.join(assetsDir, 'icon-48.png'), png48);
fs.writeFileSync(path.join(assetsDir, 'icon-128.png'), png128);

console.log('Generated PNG icons: icon-16.png, icon-48.png, icon-128.png');
