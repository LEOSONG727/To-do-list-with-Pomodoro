/**
 * Generates placeholder PNG icons for PWA.
 * Uses only Node.js built-ins (zlib, fs, path) — no extra dependencies.
 * Run: node generate-icons.mjs
 *
 * Replace the generated PNGs with a real branded icon using:
 *   https://maskable.app  (maskable icon editor)
 *   https://github.com/elegantapp/pwa-asset-generator  (CLI tool)
 */

import { deflateSync } from 'zlib';
import { writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));

function crc32(buf) {
    const table = new Uint32Array(256);
    for (let i = 0; i < 256; i++) {
        let c = i;
        for (let j = 0; j < 8; j++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
        table[i] = c;
    }
    let crc = 0xFFFFFFFF;
    for (const byte of buf) crc = table[(crc ^ byte) & 0xFF] ^ (crc >>> 8);
    return (crc ^ 0xFFFFFFFF) >>> 0;
}

function writeUint32BE(val) {
    const b = Buffer.alloc(4);
    b.writeUInt32BE(val, 0);
    return b;
}

function pngChunk(type, data) {
    const typeBytes = Buffer.from(type, 'ascii');
    const len = writeUint32BE(data.length);
    const crc = writeUint32BE(crc32(Buffer.concat([typeBytes, data])));
    return Buffer.concat([len, typeBytes, data, crc]);
}

/**
 * Creates a simple PNG with a blue background and a white tomato+timer motif.
 * Uses a two-tone design: blue border area + blue center with white circle.
 */
function createIconPNG(size, maskable = false) {
    const padding = maskable ? Math.floor(size * 0.125) : 0; // safe zone for maskable
    const inner = size - padding * 2;

    // Build IHDR
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(size, 0);
    ihdrData.writeUInt32BE(size, 4);
    ihdrData[8] = 8;  // bit depth
    ihdrData[9] = 2;  // color type: RGB
    ihdrData[10] = 0; ihdrData[11] = 0; ihdrData[12] = 0;

    // Build raw image data
    const raw = [];
    const cx = size / 2;
    const cy = size / 2;
    const bgR = 0x00, bgG = 0x71, bgB = 0xE3; // #0071E3 blue
    const fgR = 0xFF, fgG = 0xFF, fgB = 0xFF; // white
    const redR = 0xFF, redG = 0x3B, redB = 0x30; // #FF3B30 tomato red
    const greenR = 0x34, greenG = 0xC7, greenB = 0x59; // #34C759 green

    const circleR = inner * 0.38;       // white disc radius
    const tomatoR = inner * 0.28;       // red tomato radius
    const clockR = inner * 0.18;        // inner clock white disc

    for (let y = 0; y < size; y++) {
        raw.push(0); // filter byte
        for (let x = 0; x < size; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            // Stem area (thin rectangle above center)
            const stemX = Math.abs(dx) < size * 0.025;
            const stemY = dy > -circleR * 1.6 && dy < -circleR * 1.1;

            // Leaf (ellipse, offset left/right)
            const leafLDx = dx + inner * 0.1, leafLDy = dy + circleR * 1.3;
            const leafRDx = dx - inner * 0.1, leafRDy = dy + circleR * 1.3;
            const isLeaf = (leafLDx * leafLDx) / (inner * 0.09) ** 2 + (leafLDy * leafLDy) / (inner * 0.045) ** 2 < 1
                        || (leafRDx * leafRDx) / (inner * 0.09) ** 2 + (leafRDy * leafRDy) / (inner * 0.045) ** 2 < 1;

            // Clock hand: minute hand pointing up
            const handUpX = Math.abs(dx) < size * 0.015 && dy > -clockR * 0.85 && dy < 0;
            // Clock hand: hour hand pointing right
            const handRightY = Math.abs(dy) < size * 0.015 && dx > 0 && dx < clockR * 0.85;

            let r, g, b;
            if (dist < clockR) {
                // Clock center white
                r = fgR; g = fgG; b = fgB;
                if (handUpX || handRightY) { r = bgR; g = bgG; b = bgB; }
            } else if (dist < tomatoR) {
                // Red tomato area
                r = redR; g = redG; b = redB;
            } else if (stemX && stemY) {
                // Green stem
                r = greenR; g = greenG; b = greenB;
            } else if (isLeaf) {
                // Green leaf
                r = greenR; g = greenG; b = greenB;
            } else {
                // Blue background
                r = bgR; g = bgG; b = bgB;
            }

            raw.push(r, g, b);
        }
    }

    const rawBuf = Buffer.from(raw);
    const compressed = deflateSync(rawBuf);

    const PNG_SIG = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    return Buffer.concat([
        PNG_SIG,
        pngChunk('IHDR', ihdrData),
        pngChunk('IDAT', compressed),
        pngChunk('IEND', Buffer.alloc(0)),
    ]);
}

const outDir = join(__dirname, 'public', 'icons');
mkdirSync(outDir, { recursive: true });

const icons = [
    { name: 'icon-192.png', size: 192, maskable: false },
    { name: 'icon-512.png', size: 512, maskable: false },
    { name: 'icon-maskable.png', size: 512, maskable: true },
];

for (const { name, size, maskable } of icons) {
    const png = createIconPNG(size, maskable);
    writeFileSync(join(outDir, name), png);
    console.log(`✅ Generated ${name} (${size}×${size}${maskable ? ', maskable' : ''})`);
}

console.log('\nDone! Replace these with branded icons using:');
console.log('  https://maskable.app');
console.log('  npx pwa-asset-generator icon.svg public/icons');
