// tools/make-samples.mjs — renders the 5 sample scenes for Key Art Studio.
// Procedural raster art (no photo, no external asset): a tiny software
// renderer on a raw RGBA buffer, encoded to PNG with Node's stdlib zlib.
// Run: node tools/make-samples.mjs  (writes app/samples/*.png, 1200x900)
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'app', 'samples');
mkdirSync(OUT, { recursive: true });

// --- PNG encoding (stdlib only) -------------------------------------------
const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
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
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td), 0);
  return Buffer.concat([len, td, crc]);
}
function encodePng(w, h, rgba) {
  const raw = Buffer.alloc(h * (1 + w * 4));
  for (let y = 0; y < h; y++) {
    raw[y * (1 + w * 4)] = 0; // filter: none
    rgba.copy(raw, y * (1 + w * 4) + 1, y * w * 4, (y + 1) * w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const idat = deflateSync(raw, { level: 6 });
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', idat), chunk('IEND', Buffer.alloc(0)),
  ]);
}

// --- deterministic random --------------------------------------------------
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hex = (s) => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
function mix(c1, c2, t) {
  return [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
}

// --- raster canvas ---------------------------------------------------------
class Raster {
  constructor(w, h) { this.w = w; this.h = h; this.buf = Buffer.alloc(w * h * 4); }
  set(x, y, r, g, b, a = 255) {
    x |= 0; y |= 0;
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4, al = a / 255, ia = 1 - al;
    this.buf[i] = r * al + this.buf[i] * ia;
    this.buf[i + 1] = g * al + this.buf[i + 1] * ia;
    this.buf[i + 2] = b * al + this.buf[i + 2] * ia;
    this.buf[i + 3] = 255;
  }
  rect(x, y, w, h, c, a = 255) {
    const x0 = Math.max(0, Math.floor(x)), y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(this.w, Math.ceil(x + w)), y1 = Math.min(this.h, Math.ceil(y + h));
    for (let yy = y0; yy < y1; yy++) for (let xx = x0; xx < x1; xx++) this.set(xx, yy, c[0], c[1], c[2], a);
  }
  // vertical gradient over [y0,y1] from color stops [[t, '#rrggbb'], ...]
  vgrad(y0, y1, stops) {
    const cols = stops.map(([t, s]) => [t, hex(s)]);
    for (let y = Math.max(0, y0 | 0); y < Math.min(this.h, y1); y++) {
      const t = (y - y0) / (y1 - y0);
      let a = cols[0], b = cols[cols.length - 1];
      for (let i = 0; i < cols.length - 1; i++) {
        if (t >= cols[i][0] && t <= cols[i + 1][0]) { a = cols[i]; b = cols[i + 1]; break; }
      }
      const lt = b[0] === a[0] ? 0 : (t - a[0]) / (b[0] - a[0]);
      const c = mix(a[1], b[1], Math.max(0, Math.min(1, lt)));
      this.rect(0, y, this.w, 1, c);
    }
  }
  circle(cx, cy, r, c, a = 255) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.w, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h, Math.ceil(cy + r));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const d = ((x - cx) ** 2 + (y - cy) ** 2) / (r * r);
      if (d <= 1) this.set(x, y, c[0], c[1], c[2], a);
    }
  }
  ellipse(cx, cy, rx, ry, c, a = 255) {
    const x0 = Math.max(0, Math.floor(cx - rx)), x1 = Math.min(this.w, Math.ceil(cx + rx));
    const y0 = Math.max(0, Math.floor(cy - ry)), y1 = Math.min(this.h, Math.ceil(cy + ry));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
      if (d <= 1) this.set(x, y, c[0], c[1], c[2], a);
    }
  }
  // soft radial glow: alpha falls off with distance squared
  glow(cx, cy, r, c, peak = 200) {
    const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(this.w, Math.ceil(cx + r));
    const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(this.h, Math.ceil(cy + r));
    for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) {
      const d = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / r;
      if (d < 1) this.set(x, y, c[0], c[1], c[2], peak * (1 - d) * (1 - d));
    }
  }
  // filled polygon (scanline)
  poly(pts, c, a = 255) {
    let minY = Infinity, maxY = -Infinity;
    for (const [, y] of pts) { minY = Math.min(minY, y); maxY = Math.max(maxY, y); }
    for (let y = Math.max(0, Math.ceil(minY)); y < Math.min(this.h, maxY); y++) {
      const xs = [];
      for (let i = 0; i < pts.length; i++) {
        const [x1, y1] = pts[i], [x2, y2] = pts[(i + 1) % pts.length];
        if ((y1 <= y && y2 > y) || (y2 <= y && y1 > y)) xs.push(x1 + ((y - y1) / (y2 - y1)) * (x2 - x1));
      }
      xs.sort((p, q) => p - q);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        for (let x = Math.max(0, Math.ceil(xs[i])); x < Math.min(this.w, xs[i + 1]); x++) this.set(x, y, c[0], c[1], c[2], a);
      }
    }
  }
  // thick line drawn as stamped discs
  line(x0, y0, x1, y1, w, c, a = 255) {
    const len = Math.hypot(x1 - x0, y1 - y0) || 1;
    const steps = Math.ceil(len);
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      this.circle(x0 + (x1 - x0) * t, y0 + (y1 - y0) * t, w / 2, c, a);
    }
  }
  // palm silhouette: curved trunk + drooping fronds (tapered blades)
  palm(bx, by, h, lean, c, rand, trunkC = null) {
    const tc = trunkC || c;
    const topX = bx + lean, topY = by - h;
    const segs = 9;
    let px = bx, py = by;
    for (let i = 1; i <= segs; i++) {
      const t = i / segs;
      const nx = bx + lean * t * t;
      const ny = by - h * t;
      this.line(px, py, nx, ny, Math.max(2, 10 * (1 - t * 0.55)), tc);
      px = nx; py = ny;
    }
    // one frond = filled blade along a quadratic curve (arch up, droop at tip)
    const blade = (theta, len) => {
      const ux = Math.cos(theta), uy = Math.sin(theta);
      const tipX = topX + ux * len, tipY = topY + uy * len + len * 0.30;
      const cx = topX + ux * len * 0.55, cy = topY + uy * len * 0.55 - len * 0.14;
      const baseW = Math.max(4.5, h * 0.030);
      const left = [], right = [];
      const N = 8;
      for (let s = 0; s <= N; s++) {
        const t = s / N, mt = 1 - t;
        const qx = mt * mt * topX + 2 * mt * t * cx + t * t * tipX;
        const qy = mt * mt * topY + 2 * mt * t * cy + t * t * tipY;
        const dx = 2 * mt * (cx - topX) + 2 * t * (tipX - cx);
        const dy = 2 * mt * (cy - topY) + 2 * t * (tipY - cy);
        const dl = Math.hypot(dx, dy) || 1;
        const wdt = baseW * Math.pow(1 - t, 0.7) + 0.6;
        left.push([qx - (dy / dl) * wdt, qy + (dx / dl) * wdt]);
        right.push([qx + (dy / dl) * wdt, qy - (dx / dl) * wdt]);
      }
      this.poly([...left, ...right.reverse()], c);
    };
    const fronds = 8;
    for (let i = 0; i < fronds; i++) {
      const side = i < fronds / 2 ? -1 : 1;
      const k = (i % (fronds / 2)) / Math.max(1, fronds / 2 - 1); // 0..1 across the fan
      const theta = side < 0
        ? -Math.PI * (0.55 + k * 0.42) // left fan: -99deg .. -174deg
        : -Math.PI * (0.03 + (1 - k) * 0.42); // right fan: -5deg .. -81deg
      blade(theta, h * (0.36 + rand() * 0.16));
    }
    this.circle(topX - 5, topY + 6, 4.5, tc);
    this.circle(topX + 5, topY + 7, 4.5, tc);
  }
  // city block: rect + lit windows
  block(x, yBase, w, h, c, win, rand, lit = 0.5) {
    this.rect(x, yBase - h, w, h, c);
    const cols = Math.max(2, Math.floor(w / 26)), rows = Math.max(2, Math.floor(h / 34));
    for (let r = 0; r < rows; r++) for (let col = 0; col < cols; col++) {
      if (rand() < lit) {
        const wx = x + 7 + col * ((w - 14) / cols), wy = yBase - h + 9 + r * ((h - 16) / rows);
        this.rect(wx, wy, 9, 12, win, 150 + Math.floor(rand() * 105));
      }
    }
  }
  // flat cloud: merged ellipses
  cloud(cx, cy, s, c, a = 255) {
    this.ellipse(cx, cy, 70 * s, 16 * s, c, a);
    this.ellipse(cx - 45 * s, cy + 6 * s, 44 * s, 12 * s, c, a);
    this.ellipse(cx + 48 * s, cy + 7 * s, 46 * s, 12 * s, c, a);
    this.ellipse(cx + 8 * s, cy - 10 * s, 40 * s, 12 * s, c, a);
  }
  grain(rand, n, maxA = 26) {
    for (let i = 0; i < n; i++) {
      const x = Math.floor(rand() * this.w), y = Math.floor(rand() * this.h);
      const v = rand() > 0.5 ? 255 : 0;
      this.set(x, y, v, v, v, Math.floor(rand() * maxA));
    }
  }
}

// --- scenes (1200 x 900) ----------------------------------------------------
const W = 1200, H = 900;

function skylineSunset() {
  const R = new Raster(W, H), rand = mulberry32(11);
  R.vgrad(0, H, [[0, '#1b1040'], [0.35, '#5b2a86'], [0.6, '#c94b7c'], [0.82, '#ff7e5f'], [1, '#feb47b']]);
  R.glow(600, 640, 300, hex('#ffd166'), 150);
  R.circle(600, 640, 72, hex('#ffe9a8'));
  R.cloud(240, 210, 1.1, hex('#e88bb0'), 120);
  R.cloud(930, 150, 0.9, hex('#d77ba8'), 110);
  R.cloud(700, 300, 0.7, hex('#f2a0b8'), 90);
  // far skyline
  const far = hex('#4a2a68');
  let x = -20;
  while (x < W) { const bw = 60 + rand() * 110, bh = 90 + rand() * 130; R.block(x, 730, bw, bh, far, hex('#ffd166'), rand, 0.25); x += bw + 4; }
  // near skyline
  const near = hex('#1c1030');
  x = -10;
  while (x < W) { const bw = 70 + rand() * 120, bh = 130 + rand() * 170; R.block(x, 800, bw, bh, near, hex('#ffc46b'), rand, 0.55); x += bw + 6; }
  // water + sun reflection
  R.vgrad(800, H, [[0, '#57244f'], [1, '#241238']]);
  for (let i = 0; i < 26; i++) {
    const yy = 806 + rand() * 88, ww = 60 + rand() * 160, xx = 600 - ww / 2 + (rand() - 0.5) * 60;
    R.rect(xx, yy, ww, 3, hex('#ffb35c'), 60 + rand() * 90);
  }
  // foreground palms
  R.palm(110, 905, 270, 46, hex('#140a24'), rand);
  R.palm(1090, 905, 310, -52, hex('#140a24'), rand);
  R.palm(985, 905, 190, -30, hex('#140a24'), rand);
  // birds
  for (const [bx, by, s] of [[420, 240, 9], [470, 265, 7], [820, 220, 8]]) {
    R.line(bx - s, by, bx, by - 5, 2, hex('#2a1650'));
    R.line(bx, by - 5, bx + s, by, 2, hex('#2a1650'));
  }
  R.grain(rand, 2600);
  return R;
}

function beachDay() {
  const R = new Raster(W, H), rand = mulberry32(23);
  R.vgrad(0, 420, [[0, '#6ec1f5'], [1, '#cfeefb']]);
  R.glow(980, 150, 190, hex('#fff3b0'), 170);
  R.circle(980, 150, 58, hex('#fff8cf'));
  R.cloud(220, 130, 1.2, hex('#ffffff'), 210);
  R.cloud(620, 90, 0.9, hex('#ffffff'), 190);
  R.cloud(880, 260, 0.7, hex('#ffffff'), 170);
  // sea
  R.vgrad(420, 640, [[0, '#19b5a6'], [0.6, '#0f8a96'], [1, '#0b6e8a']]);
  for (let i = 0; i < 34; i++) {
    const yy = 430 + rand() * 200, ww = 80 + rand() * 220, xx = rand() * W;
    R.line(xx, yy, xx + ww, yy + (rand() - 0.5) * 6, 2, hex('#e8fbff'), 70 + rand() * 80);
  }
  // sand
  R.vgrad(640, H, [[0, '#f4d58d'], [1, '#dfa254']]);
  for (let i = 0; i < 8; i++) {
    const fx = 120 + i * 26, fy = 700 + (i % 2) * 14;
    R.ellipse(fx, fy, 7, 4, hex('#b97f3e'), 120);
  }
  // umbrella: striped canopy fan + pole
  const ux = 830, uy = 690;
  R.line(ux, uy, ux, uy + 130, 5, hex('#8a5a30'));
  const cols = ['#ff5d73', '#fff6e8', '#ff5d73', '#fff6e8', '#ff5d73', '#fff6e8'];
  for (let i = 0; i < 6; i++) {
    const a0 = Math.PI + (i / 6) * Math.PI, a1 = Math.PI + ((i + 1) / 6) * Math.PI;
    R.poly([[ux, uy], [ux + Math.cos(a0) * 120, uy + Math.sin(a0) * 62], [ux + Math.cos(a1) * 120, uy + Math.sin(a1) * 62]], hex(cols[i]));
  }
  R.circle(ux, uy, 8, hex('#ff5d73'));
  // towel stripes
  for (let i = 0; i < 5; i++) R.rect(180 + i * 26, 760, 26, 70, hex(i % 2 ? '#2ec4b6' : '#fff6e8'));
  R.rect(180, 760, 130, 70, hex('#000000'), 0);
  // leaning palm: green fronds, brown trunk
  R.palm(150, 880, 300, 90, hex('#1f7a4d'), rand, hex('#7a5230'));
  R.grain(rand, 2200);
  return R;
}

function neonStrip() {
  const R = new Raster(W, H), rand = mulberry32(37);
  R.vgrad(0, H, [[0, '#0d0b1e'], [0.6, '#1a1033'], [1, '#241238']]);
  for (let i = 0; i < 90; i++) R.circle(rand() * W, rand() * 300, 1.4, hex('#ffffff'), 90 + rand() * 140);
  // buildings left + right with neon signs
  const sign = (x, y, w, h, color) => {
    R.glow(x + w / 2, y + h / 2, Math.max(w, h), hex(color), 90);
    R.rect(x, y, w, h, hex(color), 235);
    R.rect(x + 4, y + 4, w - 8, h - 8, hex('#12081f'), 255);
    R.rect(x + 8, y + h / 2 - 3, w - 16, 6, hex(color), 255);
    R.rect(x + 8, y + 8, w - 16, 4, hex(color), 160);
  };
  R.block(0, 640, 300, 420, hex('#14102a'), hex('#ffd166'), rand, 0.35);
  sign(40, 250, 220, 64, '#ff2e88');
  sign(60, 350, 150, 46, '#22d3ee');
  R.block(900, 660, 300, 440, hex('#17112e'), hex('#ffd166'), rand, 0.35);
  sign(940, 230, 200, 60, '#ffd166');
  sign(960, 330, 150, 46, '#39ff88');
  R.block(320, 560, 180, 300, hex('#100c22'), hex('#ffd166'), rand, 0.2);
  sign(350, 300, 120, 40, '#b26bff');
  R.block(700, 570, 180, 310, hex('#100c22'), hex('#ffd166'), rand, 0.2);
  sign(720, 290, 130, 44, '#ff5d73');
  // string lights across the street
  for (let i = 0; i <= 24; i++) {
    const t = i / 24, lx = 300 + t * 600, ly = 470 + Math.sin(t * Math.PI) * 60;
    R.circle(lx, ly, 4, hex(['#ff2e88', '#22d3ee', '#ffd166', '#39ff88'][i % 4]), 230);
    R.glow(lx, ly, 14, hex(['#ff2e88', '#22d3ee', '#ffd166', '#39ff88'][i % 4]), 70);
  }
  // wet street: perspective road + neon reflections
  R.poly([[0, 900], [1200, 900], [700, 560], [500, 560]], hex('#171226'));
  for (let i = 0; i < 5; i++) {
    const t = i / 5, y = 600 + t * 260, wdt = 6 + t * 26;
    R.rect(600 - wdt / 2, y, wdt, 10 + t * 14, hex('#ffd166'), 200);
  }
  const streak = (x, color, wdt) => {
    // smooth vertical fade (wet-pavement reflection), not stacked bars
    for (let y = 640; y < 900; y++) {
      const t = (y - 640) / 260;
      R.rect(x - wdt / 2, y, wdt, 1, hex(color), 95 * (1 - t));
    }
    for (let i = 0; i < 4; i++) {
      const y = 660 + rand() * 220;
      R.rect(x - wdt / 2, y, wdt, 2, hex(color), 150);
    }
  };
  streak(150, '#ff2e88', 26); streak(135, '#22d3ee', 18); streak(1040, '#ffd166', 24); streak(1035, '#39ff88', 16);
  R.palm(1150, 905, 220, -40, hex('#0a0616'), rand);
  R.grain(rand, 1800);
  return R;
}

function oceanPier() {
  const R = new Raster(W, H), rand = mulberry32(51);
  R.vgrad(0, 430, [[0, '#8fd4ee'], [0.7, '#ffe3b3'], [1, '#ffc98a']]);
  R.glow(300, 190, 170, hex('#fff3b0'), 150);
  R.circle(300, 190, 52, hex('#fff8cf'));
  R.cloud(700, 120, 1.1, hex('#ffffff'), 200);
  R.cloud(1050, 220, 0.8, hex('#ffffff'), 180);
  R.cloud(180, 300, 0.7, hex('#fff3d6'), 160);
  // sea
  R.vgrad(430, H, [[0, '#2ec4d8'], [0.55, '#12809b'], [1, '#0b5e7d']]);
  for (let i = 0; i < 40; i++) {
    const yy = 450 + rand() * 430, ww = 70 + rand() * 200, xx = rand() * W;
    R.line(xx, yy, xx + ww, yy + (rand() - 0.5) * 5, 2, hex('#dff8ff'), 60 + rand() * 70);
  }
  // sun glitter column
  for (let i = 0; i < 22; i++) {
    const yy = 440 + rand() * 420, ww = 40 + rand() * 120, xx = 300 - ww / 2 + (rand() - 0.5) * 50;
    R.rect(xx, yy, ww, 3, hex('#ffe9a8'), 70 + rand() * 80);
  }
  // wooden pier: deck from bottom-left to mid horizon
  const wood = hex('#6b4a2f'), woodTop = hex('#8a6a45');
  R.poly([[40, 900], [760, 900], [470, 470], [330, 470]], wood);
  R.poly([[40, 900], [760, 900], [470, 470], [330, 470]], woodTop, 60);
  for (let i = 0; i <= 12; i++) {
    const t = i / 12, y = 900 - t * 430, xL = 40 + (330 - 40) * t, xR = 760 - (760 - 470) * t;
    R.line(xL, y, xR, y, 3, hex('#54371f'), 200);
  }
  // posts + railings
  for (const t of [0.15, 0.4, 0.65, 0.9]) {
    const y = 900 - t * 430, xL = 40 + (330 - 40) * t, xR = 760 - (760 - 470) * t;
    R.line(xL, y, xL, y + 60, 7, wood);
    R.line(xR, y, xR, y + 60, 7, wood);
  }
  R.line(40, 880, 330, 470, 4, woodTop);
  R.line(760, 880, 470, 470, 4, woodTop);
  // fishing rod from pier end
  R.line(400, 470, 560, 330, 3, hex('#3a2a18'));
  R.line(560, 330, 540, 560, 1, hex('#f5ead0'), 180);
  // bucket on deck
  R.rect(620, 830, 44, 40, hex('#c94b4b'));
  R.rect(620, 830, 44, 10, hex('#a83a3a'));
  R.grain(rand, 2200);
  return R;
}

function palmBoulevard() {
  const R = new Raster(W, H), rand = mulberry32(67);
  R.vgrad(0, H, [[0, '#2a1a4e'], [0.4, '#7a2d6e'], [0.65, '#e0566e'], [0.85, '#ff8c42'], [1, '#ffb25e']]);
  R.glow(600, 560, 280, hex('#ffd166'), 140);
  R.circle(600, 560, 64, hex('#ffe9a8'));
  R.cloud(250, 180, 1.0, hex('#f2a0b8'), 110);
  R.cloud(950, 240, 0.8, hex('#e88bb0'), 100);
  // low buildings along horizon
  let x = 0;
  while (x < 380) { const bw = 60 + rand() * 90, bh = 60 + rand() * 90; R.block(x, 640, bw, bh, hex('#241338'), hex('#ffd166'), rand, 0.3); x += bw + 4; }
  x = 820;
  while (x < W) { const bw = 60 + rand() * 90, bh = 60 + rand() * 100; R.block(x, 640, bw, bh, hex('#241338'), hex('#ffd166'), rand, 0.3); x += bw + 4; }
  R.rect(860, 520, 130, 40, hex('#22d3ee'), 220);
  R.rect(866, 526, 118, 28, hex('#12081f'));
  R.rect(874, 536, 102, 6, hex('#22d3ee'));
  // road perspective
  R.poly([[240, 900], [960, 900], [660, 600], [540, 600]], hex('#241a33'));
  R.poly([[240, 900], [960, 900], [660, 600], [540, 600]], hex('#000000'), 40);
  for (let i = 0; i < 6; i++) {
    const t = i / 6, y = 640 + t * 240, wdt = 5 + t * 22;
    R.rect(600 - wdt / 2, y, wdt, 12 + t * 16, hex('#ffd166'), 210);
  }
  // sidewalks
  R.poly([[240, 900], [330, 900], [540, 600], [520, 600]], hex('#3a2a52'));
  R.poly([[960, 900], [870, 900], [660, 600], [680, 600]], hex('#3a2a52'));
  // palm rows receding
  const palmRow = (side) => {
    const spots = [[200, 880, 250], [300, 780, 180], [375, 700, 130], [425, 650, 95]];
    for (const [px, py, ph] of spots) {
      const sx = side < 0 ? px : W - px;
      R.palm(sx, py, ph, side * -26, hex('#160b28'), rand);
    }
  };
  palmRow(-1); palmRow(1);
  // convertible silhouette on the road
  const car = hex('#120a20');
  R.poly([[505, 806], [705, 806], [668, 760], [545, 760]], car); // body
  R.poly([[552, 762], [660, 762], [632, 724], [580, 724]], car); // cabin
  R.circle(552, 806, 19, car); R.circle(660, 806, 19, car);
  R.circle(552, 806, 9, hex('#4a3a66')); R.circle(660, 806, 9, hex('#4a3a66'));
  R.line(584, 728, 628, 728, 2, hex('#ffb25e'), 130); // windshield glint
  R.grain(rand, 2400);
  return R;
}

// --- main -------------------------------------------------------------------
const SCENES = [
  ['skyline-sunset', skylineSunset],
  ['beach-day', beachDay],
  ['neon-strip', neonStrip],
  ['ocean-pier', oceanPier],
  ['palm-boulevard', palmBoulevard],
];
for (const [name, fn] of SCENES) {
  const R = fn();
  const png = encodePng(W, H, R.buf);
  writeFileSync(join(OUT, `${name}.png`), png);
  console.log(name, png.length, 'bytes');
}
console.log('done:', SCENES.length, 'samples in', OUT);
