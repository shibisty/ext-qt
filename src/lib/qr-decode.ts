/* QR Code decoder: binarization, finder detection, homography sampling, Reed-Solomon. */
import { EXP, LOG, gmul, FMT, formatBits, functionMap, MASKS, rawCw, BLK, ECC, ALNUM } from './qr-encode';

/** Anything shaped like ImageData (RGBA, row-major). */
export interface ImageLike {
  data: ArrayLike<number>;
  width: number;
  height: number;
}

type Bin = Uint8Array;
type Point = [number, number];
type Mapper = (x: number, y: number) => Point;
interface Finder { x: number; y: number; m: number; n: number }
interface Triple { tl: Finder; tr: Finder; bl: Finder; score: number }

const gdiv = (a: number, b: number): number => (a ? EXP[(LOG[a] + 255 - LOG[b]) % 255] : 0);

/* ---------- binarization ---------- */
function gray(img: ImageLike): Uint8Array {
  const { data, width: w, height: h } = img, g = new Uint8Array(w * h);
  for (let i = 0, j = 0; i < g.length; i++, j += 4) g[i] = (data[j] * 77 + data[j + 1] * 150 + data[j + 2] * 29) >> 8;
  return g;
}
export function otsu(g: Uint8Array): number {
  const hist = new Uint32Array(256); for (let i = 0; i < g.length; i++) hist[g[i]]++;
  let sum = 0; for (let i = 0; i < 256; i++) sum += i * hist[i];
  let wB = 0, sB = 0, max = -1, th = 128;
  for (let t = 0; t < 256; t++) {
    wB += hist[t]; if (!wB) continue; const wF = g.length - wB; if (!wF) break;
    sB += t * hist[t]; const mB = sB / wB, mF = (sum - sB) / wF, v = wB * wF * (mB - mF) * (mB - mF);
    if (v > max) { max = v; th = t; }
  }
  return th;
}
function binGlobal(g: Uint8Array): Bin { const t = otsu(g), b = new Uint8Array(g.length); for (let i = 0; i < g.length; i++) b[i] = g[i] <= t ? 1 : 0; return b; }
function binLocal(g: Uint8Array, w: number, h: number): Bin {
  const ii = new Float64Array((w + 1) * (h + 1));
  for (let y = 0; y < h; y++) { let row = 0; for (let x = 0; x < w; x++) { row += g[y * w + x]; ii[(y + 1) * (w + 1) + x + 1] = ii[y * (w + 1) + x + 1] + row; } }
  const r = Math.max(8, Math.round(Math.min(w, h) / 8)), b = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    const y0 = Math.max(0, y - r), y1 = Math.min(h, y + r + 1);
    for (let x = 0; x < w; x++) {
      const x0 = Math.max(0, x - r), x1 = Math.min(w, x + r + 1);
      const s = ii[y1 * (w + 1) + x1] - ii[y0 * (w + 1) + x1] - ii[y1 * (w + 1) + x0] + ii[y0 * (w + 1) + x0];
      b[y * w + x] = g[y * w + x] * (x1 - x0) * (y1 - y0) < s * 0.88 ? 1 : 0;
    }
  }
  return b;
}

/* ---------- finder patterns ---------- */
function runsOf(line: ArrayLike<number>) {
  const starts: number[] = [], lens: number[] = [], cols: number[] = []; let s = 0;
  for (let i = 1; i <= line.length; i++) if (i === line.length || line[i] !== line[s]) { starts.push(s); lens.push(i - s); cols.push(line[s]); s = i; }
  return { starts, lens, cols };
}
const near = (l: number, m: number, tol: number) => Math.abs(l - m) <= m * tol;
function ratioOK(a: number, b: number, c: number, d: number, e: number): number {
  const t = a + b + c + d + e; if (t < 7) return 0; const m = t / 7;
  return near(a, m, 0.6) && near(b, m, 0.6) && near(c, 3 * m, 0.6) && near(d, m, 0.6) && near(e, m, 0.6) ? m : 0;
}
function findFinders(bin: Bin, w: number, h: number): Finder[] {
  const cands: Omit<Finder, 'n'>[] = [], step = Math.max(1, Math.floor(h / 400));
  const at = (x: number, y: number) => bin[y * w + x];
  for (let y = 0; y < h; y += step) {
    const row = bin.subarray(y * w, y * w + w), { starts, lens, cols } = runsOf(row);
    for (let i = 0; i + 4 < lens.length; i++) {
      if (cols[i] !== 1) continue;
      const ms = ratioOK(lens[i], lens[i + 1], lens[i + 2], lens[i + 3], lens[i + 4]); if (!ms) continue;
      const total = lens[i] + lens[i + 1] + lens[i + 2] + lens[i + 3] + lens[i + 4];
      const cx = starts[i] + total / 2, x = Math.min(w - 1, Math.max(0, Math.round(cx)));
      if (!at(x, y)) continue;
      // vertical verification
      let cu = 0; while (y - cu - 1 >= 0 && at(x, y - cu - 1)) cu++;
      let cd = 0; while (y + cd + 1 < h && at(x, y + cd + 1)) cd++;
      let p = y - cu - 1, w1u = 0; while (p >= 0 && !at(x, p)) { w1u++; p--; }
      let b2u = 0; while (p >= 0 && at(x, p)) { b2u++; p--; }
      p = y + cd + 1; let w1d = 0; while (p < h && !at(x, p)) { w1d++; p++; }
      let b2d = 0; while (p < h && at(x, p)) { b2d++; p++; }
      const vm = ratioOK(b2u, w1u, cu + cd + 1, w1d, b2d); if (!vm) continue;
      const cy = y - cu + (cu + cd + 1) / 2;
      cands.push({ x: cx, y: cy, m: (ms + vm) / 2 });
    }
  }
  const cl: Finder[] = [];
  for (const c of cands) {
    const k = cl.find(o => Math.hypot(o.x - c.x, o.y - c.y) < Math.max(o.m, c.m) * 2.5);
    if (k) { k.x = (k.x * k.n + c.x) / (k.n + 1); k.y = (k.y * k.n + c.y) / (k.n + 1); k.m = (k.m * k.n + c.m) / (k.n + 1); k.n++; }
    else cl.push({ ...c, n: 1 });
  }
  const ringOK = (c: Finder) => {
    let best = 0, bx = c.x, by = c.y;
    for (const k of [1, 0.9, 0.8, 0.72]) for (const oy of [0, -0.5, 0.5]) for (const ox of [0, -0.5, 0.5]) {
      const m = c.m * k, cx = c.x + ox * m, cy = c.y + oy * m; let b = 0, wh = 0;
      for (let i = 0; i < 16; i++) {
        const a = i * Math.PI / 8, ca = Math.cos(a), sa = Math.sin(a);
        const x1 = Math.round(cx + ca * m), y1 = Math.round(cy + sa * m), x2 = Math.round(cx + ca * m * 2.25), y2 = Math.round(cy + sa * m * 2.25);
        if (x1 >= 0 && y1 >= 0 && x1 < w && y1 < h && bin[y1 * w + x1]) b++;
        if (x2 >= 0 && y2 >= 0 && x2 < w && y2 < h && !bin[y2 * w + x2]) wh++;
      }
      if (b >= 13 && wh >= 13 && b + wh > best) { best = b + wh; bx = cx; by = cy; }
    }
    if (best) { c.x = bx; c.y = by; }
    return best > 0;
  };
  return cl.filter(c => c.n >= 2 && ringOK(c)).sort((a, b) => b.n - a.n).slice(0, 10);
}
function triples(f: Finder[]): Triple[] {
  const out: Triple[] = [];
  const d = (a: Finder, b: Finder) => Math.hypot(a.x - b.x, a.y - b.y);
  for (let i = 0; i < f.length; i++) for (let j = i + 1; j < f.length; j++) for (let k = j + 1; k < f.length; k++) {
    const p = [f[i], f[j], f[k]], ms = p.map(a => a.m);
    if (Math.max(...ms) / Math.min(...ms) > 1.7) continue;
    const e = [d(p[1], p[2]), d(p[0], p[2]), d(p[0], p[1])]; // e[i] opposite p[i]
    const hi = e.indexOf(Math.max(...e)), tl = p[hi], o = p.filter((_, n) => n !== hi);
    const l1 = d(tl, o[0]), l2 = d(tl, o[1]);
    if (Math.min(l1, l2) / Math.max(l1, l2) < 0.7) continue;
    const cos = ((o[0].x - tl.x) * (o[1].x - tl.x) + (o[0].y - tl.y) * (o[1].y - tl.y)) / (l1 * l2);
    if (Math.abs(cos) > 0.45) continue;
    const cross = (o[0].x - tl.x) * (o[1].y - tl.y) - (o[0].y - tl.y) * (o[1].x - tl.x);
    const tr = cross > 0 ? o[0] : o[1], bl = cross > 0 ? o[1] : o[0];
    out.push({ tl, tr, bl, score: Math.abs(l1 - l2) / Math.max(l1, l2) + Math.abs(cos) + Math.abs(tl.m - tr.m) / tl.m * 0.3 });
  }
  return out.sort((a, b) => a.score - b.score).slice(0, 6);
}

/* ---------- homography ---------- */
/** Projective map src[i] -> dst[i] for 4 point pairs; null when degenerate. */
export function homography(src: readonly Point[], dst: readonly Point[]): Mapper | null {
  const A: number[][] = [], B: number[] = [];
  for (let i = 0; i < 4; i++) {
    const [x, y] = src[i], [u, v] = dst[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y]); B.push(u);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y]); B.push(v);
  }
  for (let i = 0; i < 8; i++) {
    let p = i; for (let r = i + 1; r < 8; r++) if (Math.abs(A[r][i]) > Math.abs(A[p][i])) p = r;
    [A[i], A[p]] = [A[p], A[i]]; [B[i], B[p]] = [B[p], B[i]];
    if (Math.abs(A[i][i]) < 1e-12) return null;
    for (let r = 0; r < 8; r++) if (r !== i) {
      const f = A[r][i] / A[i][i]; if (!f) continue;
      for (let c = i; c < 8; c++) A[r][c] -= f * A[i][c]; B[r] -= f * B[i];
    }
  }
  const h = B.map((b, i) => b / A[i][i]);
  return (x, y) => { const d = h[6] * x + h[7] * y + 1; return [(h[0] * x + h[1] * y + h[2]) / d, (h[3] * x + h[4] * y + h[5]) / d]; };
}

/* ---------- Reed-Solomon ---------- */
/** Correct a codeword block in place (data followed by nsym ECC bytes). Returns false when uncorrectable. */
export function rsCorrect(cw: number[], nsym: number): boolean {
  const n = cw.length, S = new Array<number>(nsym).fill(0); let clean = true;
  for (let j = 0; j < nsym; j++) { let s = 0; for (let i = 0; i < n; i++) s = gmul(s, EXP[j]) ^ cw[i]; S[j] = s; if (s) clean = false; }
  if (clean) return true;
  let C = [1], B = [1], L = 0, m = 1, b = 1;
  for (let i = 0; i < nsym; i++) {
    let d = S[i]; for (let j = 1; j <= L; j++) d ^= gmul(C[j] || 0, S[i - j]);
    if (!d) { m++; continue; }
    const T = C.slice(), coef = gdiv(d, b);
    while (C.length < B.length + m) C.push(0);
    for (let j = 0; j < B.length; j++) C[j + m] ^= gmul(coef, B[j]);
    if (2 * L <= i) { L = i + 1 - L; B = T; b = d; m = 1; } else m++;
  }
  if (L * 2 > nsym) return false;
  const pos: number[] = [];
  for (let p = 0; p < n; p++) { // root at X^-1 where X = a^p
    let v = 0; for (let j = 0; j < C.length; j++) v ^= gmul(C[j], EXP[(255 - (p * j) % 255) % 255]);
    if (!v) pos.push(p);
  }
  if (pos.length !== L) return false;
  const omega = new Array<number>(nsym).fill(0);
  for (let i = 0; i < nsym; i++) for (let j = 0; j <= i && j < C.length; j++) omega[i] ^= gmul(C[j], S[i - j]);
  for (const p of pos) {
    const xi = EXP[(255 - p) % 255]; let num = 0, den = 0;
    for (let j = 0; j < nsym; j++) num ^= gmul(omega[j], EXP[(LOG[xi] * j) % 255] || (j === 0 ? 1 : 0));
    for (let j = 1; j < C.length; j += 2) den ^= gmul(C[j], j - 1 === 0 ? 1 : EXP[(LOG[xi] * (j - 1)) % 255]);
    if (!den) return false;
    cw[n - 1 - p] ^= gmul(EXP[p % 255], gdiv(num, den));
  }
  for (let j = 0; j < nsym; j++) { let s = 0; for (let i = 0; i < n; i++) s = gmul(s, EXP[j]) ^ cw[i]; if (s) return false; }
  return true;
}

/* ---------- bitstream ---------- */
const FMT_TABLE: { ecl: number; mask: number; bits: number }[] = [];
for (let e = 0; e < 4; e++) for (let k = 0; k < 8; k++) FMT_TABLE.push({ ecl: FMT.indexOf(e), mask: k, bits: formatBits(FMT.indexOf(e), k) });
const pop = (x: number) => { let c = 0; while (x) { c += x & 1; x >>>= 1; } return c; };

function parseStream(data: number[], v: number): string | null {
  let pos = 0; const total = data.length * 8;
  const read = (n: number) => { let r = 0; for (let i = 0; i < n; i++, pos++) r = (r << 1) | ((data[pos >> 3] >> (7 - (pos & 7))) & 1); return r; };
  const k = v <= 9 ? 0 : v <= 26 ? 1 : 2, bytes: number[] = [];
  const enc = new TextEncoder();
  while (pos + 4 <= total) {
    const mode = read(4); if (mode === 0) break;
    if (mode === 1) { let n = read([10, 12, 14][k]), s = ''; while (n > 0) { const c = Math.min(3, n), x = read(c * 3 + 1); s += String(x).padStart(c, '0'); n -= c; } bytes.push(...enc.encode(s)); }
    else if (mode === 2) { let n = read([9, 11, 13][k]), s = ''; while (n > 1) { const x = read(11); s += ALNUM[Math.floor(x / 45)] + ALNUM[x % 45]; n -= 2; } if (n) s += ALNUM[read(6)]; bytes.push(...enc.encode(s)); }
    else if (mode === 4) { const n = read([8, 16, 16][k]); for (let i = 0; i < n; i++) bytes.push(read(8)); }
    else if (mode === 7) { const b = read(8); if (b & 0x80) read(b & 0x40 ? 16 : 8); } // ECI designator (skipped)
    else if (mode === 3) read(16); // structured append header
    else if (mode === 5) { /* FNC1 first position */ } else if (mode === 9) read(8); // FNC1 second position
    else return null;
  }
  const u8 = Uint8Array.from(bytes);
  try { return new TextDecoder('utf-8', { fatal: true }).decode(u8); }
  catch { return new TextDecoder('iso-8859-1').decode(u8); }
}

/* ---------- sampling & decoding of a grid ---------- */
/** Decode a sampled module grid. `get(x, y)` returns true for a dark module. */
export function decodeMatrix(get: (x: number, y: number) => boolean, v: number): string | null {
  const size = v * 4 + 17, { fn } = functionMap(v);
  const rd: boolean[][] = [[], []];
  for (let i = 0; i <= 5; i++) rd[0][i] = get(8, i);
  rd[0][6] = get(8, 7); rd[0][7] = get(8, 8); rd[0][8] = get(7, 8);
  for (let i = 9; i < 15; i++) rd[0][i] = get(14 - i, 8);
  for (let i = 0; i < 8; i++) rd[1][i] = get(size - 1 - i, 8);
  for (let i = 8; i < 15; i++) rd[1][i] = get(8, size - 15 + i);
  let best: (typeof FMT_TABLE)[number] | null = null, bd = 99;
  for (const r of rd) {
    let val = 0; for (let i = 0; i < 15; i++) if (r[i]) val |= 1 << i;
    for (const f of FMT_TABLE) { const d = pop(val ^ f.bits); if (d < bd) { bd = d; best = f; } }
  }
  if (!best || bd > 3) return null;
  const mask = MASKS[best.mask], bits: boolean[] = [];
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x]) bits.push(get(x, y) !== mask(x, y));
    }
  }
  const raw = rawCw(v), cw: number[] = [];
  for (let i = 0; i < raw; i++) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | (bits[i * 8 + j] ? 1 : 0); cw.push(b); }
  const l = best.ecl, nb = BLK[l][v], el = ECC[l][v], ns = nb - (raw % nb), sl = Math.floor(raw / nb);
  const blocks: number[][] = Array.from({ length: nb }, () => new Array<number>(sl + 1));
  let p = 0;
  for (let i = 0; i <= sl; i++) for (let j = 0; j < nb; j++) {
    if (i === sl - el && j < ns) continue;
    blocks[j][i] = cw[p++];
  }
  const data: number[] = [];
  for (let j = 0; j < nb; j++) {
    const short = j < ns, dl = sl - el + (short ? 0 : 1);
    const blk = short ? blocks[j].slice(0, sl - el).concat(blocks[j].slice(sl - el + 1)) : blocks[j];
    if (blk.length !== dl + el || !rsCorrect(blk, el)) return null;
    for (let i = 0; i < dl; i++) data.push(blk[i]);
  }
  return parseStream(data, v);
}

function tryTriple(bin: Bin, w: number, h: number, t: Triple): string | null {
  const { tl, tr, bl } = t;
  let phi = Math.atan2(tr.y - tl.y, tr.x - tl.x) % (Math.PI / 2); if (phi > Math.PI / 4) phi -= Math.PI / 2; if (phi < -Math.PI / 4) phi += Math.PI / 2;
  const ms = ((tl.m + tr.m + bl.m) / 3) * Math.cos(phi);
  const dist = Math.hypot(tr.x - tl.x, tr.y - tl.y), dist2 = Math.hypot(bl.x - tl.x, bl.y - tl.y);
  const est = (dist + dist2) / 2 / ms + 7, v0 = Math.round((est - 17) / 4);
  for (const dv of [0, 1, -1, 2, -2]) {
    const v = v0 + dv; if (v < 1 || v > 40) continue;
    const size = v * 4 + 17;
    const rel = (est - size) / size; if (Math.abs(rel) > 0.12) continue;
    const a = 3.5, b = size - 3.5;
    const src: Point[] = [[a, a], [b, a], [a, b], [b, b]];
    const br0: Point = [tr.x + bl.x - tl.x, tr.y + bl.y - tl.y];
    let H = homography(src, [[tl.x, tl.y], [tr.x, tr.y], [bl.x, bl.y], br0]);
    if (!H) continue;
    if (v >= 2) { // refine with the bottom-right alignment pattern
      let bestS = 0, bp: Point | null = null, bestD = 99;
      for (let dy = -2.5; dy <= 2.5; dy += 0.15) for (let dx = -2.5; dx <= 2.5; dx += 0.15) {
        const c: Point = [size - 6.5 + dx, size - 6.5 + dy]; let sc = 0;
        for (let yy = -2; yy <= 2; yy++) for (let xx = -2; xx <= 2; xx++) {
          const [px, py] = H(c[0] + xx, c[1] + yy);
          const ix = Math.round(px), iy = Math.round(py); if (ix < 0 || iy < 0 || ix >= w || iy >= h) { sc -= 1; continue; }
          const d = Math.max(Math.abs(xx), Math.abs(yy)), want = d !== 1 ? 1 : 0;
          if (bin[iy * w + ix] === want) sc++;
        }
        const dd = Math.hypot(dx, dy);
        if (sc > bestS || (sc === bestS && dd < bestD)) { bestS = sc; bp = c; bestD = dd; }
      }
      if (bestS >= 22 && bp) {
        const pf = H(bp[0], bp[1]);
        const H2 = homography([[a, a], [b, a], [a, b], [size - 6.5, size - 6.5]], [[tl.x, tl.y], [tr.x, tr.y], [bl.x, bl.y], pf]);
        if (H2) H = H2;
      }
    }
    const map = H, cache = new Map<number, boolean>();
    const get = (x: number, y: number): boolean => {
      const k = y * size + x, hit = cache.get(k); if (hit !== undefined) return hit;
      let c = 0;
      for (const [ox, oy] of [[0.5, 0.5], [0.3, 0.3], [0.7, 0.3], [0.3, 0.7], [0.7, 0.7]]) {
        const [px, py] = map(x + ox, y + oy), ix = Math.round(px), iy = Math.round(py);
        if (ix >= 0 && iy >= 0 && ix < w && iy < h && bin[iy * w + ix]) c++;
      }
      const r = c >= 3; cache.set(k, r); return r;
    };
    try { const res = decodeMatrix(get, v); if (res != null) return res; } catch { /* try next version */ }
  }
  return null;
}

function decodeBin(bin: Bin, w: number, h: number): string | null {
  const f = findFinders(bin, w, h); if (f.length < 3) return null;
  for (const t of triples(f)) { const r = tryTriple(bin, w, h, t); if (r != null) return r; }
  return null;
}

function blur(g: Uint8Array, w: number, h: number): Uint8Array {
  const o = new Uint8Array(g.length);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let s = 0, n = 0;
    for (let yy = Math.max(0, y - 1); yy <= Math.min(h - 1, y + 1); yy++) for (let xx = Math.max(0, x - 1); xx <= Math.min(w - 1, x + 1); xx++) { s += g[yy * w + xx]; n++; }
    o[y * w + x] = s / n;
  }
  return o;
}
function shrink(img: ImageLike, k: number): ImageLike {
  if (k >= 1) return img;
  const w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k)), d = new Uint8ClampedArray(w * h * 4);
  const bx = img.width / w, by = img.height / h;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    let r = 0, g = 0, b = 0, n = 0;
    for (let yy = Math.floor(y * by); yy < Math.min(img.height, Math.ceil((y + 1) * by)); yy++) for (let xx = Math.floor(x * bx); xx < Math.min(img.width, Math.ceil((x + 1) * bx)); xx++) {
      const i = (yy * img.width + xx) * 4; r += img.data[i]; g += img.data[i + 1]; b += img.data[i + 2]; n++;
    }
    const o = (y * w + x) * 4; d[o] = r / n; d[o + 1] = g / n; d[o + 2] = b / n; d[o + 3] = 255;
  }
  return { data: d, width: w, height: h };
}

/** Decode an ImageData-like {data,width,height}. Returns the decoded text or null. */
export function decode(img: ImageLike): string | null {
  const k0 = Math.min(1, 1400 / Math.max(img.width, img.height));
  for (const k of [k0, k0 * 0.5]) {
    const im = shrink(img, k);
    const g = gray(im);
    for (const bin of [binGlobal(g), binLocal(g, im.width, im.height), binGlobal(blur(g, im.width, im.height)), binLocal(blur(g, im.width, im.height), im.width, im.height)]) {
      let r = decodeBin(bin, im.width, im.height); if (r != null) return r;
      const inv = bin.map(x => 1 - x); r = decodeBin(inv, im.width, im.height); if (r != null) return r;
    }
  }
  return null;
}
