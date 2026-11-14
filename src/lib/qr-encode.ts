/* QR Code encoder (numeric / alphanumeric / byte), versions 1-40, ECC L/M/Q/H. No dependencies. */

export type EccLevel = 'L' | 'M' | 'Q' | 'H';
export type Matrix = boolean[][];

export interface QRCode {
  version: number;
  size: number;
  ecl: EccLevel;
  mask: number;
  modules: Matrix;
  /** true for function-pattern modules (finders, timing, alignment, format/version areas) */
  fn: Matrix;
}

export interface EncodeOptions {
  ecl?: EccLevel;
  minVersion?: number;
  /** raise the ECC level while the data still fits the chosen version (default true) */
  boost?: boolean;
  /** force a mask pattern 0-7 instead of picking the lowest-penalty one */
  mask?: number;
}

export const ECC: readonly (readonly number[])[] = [
  [-1,7,10,15,20,26,18,20,24,30,18,20,24,26,30,22,24,28,30,28,28,28,28,30,30,26,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,10,16,26,18,24,16,18,22,22,26,30,22,22,24,24,28,28,26,26,26,26,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28,28],
  [-1,13,22,18,26,18,24,18,22,20,24,28,26,24,20,30,24,28,28,26,30,28,30,30,30,30,28,30,30,30,30,30,30,30,30,30,30,30,30,30,30],
  [-1,17,28,22,16,22,28,26,26,24,28,24,28,22,24,24,30,28,28,26,28,30,24,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30,30]];
export const BLK: readonly (readonly number[])[] = [
  [-1,1,1,1,1,1,2,2,2,2,4,4,4,4,4,6,6,6,6,7,8,8,9,9,10,12,12,12,13,14,15,16,17,18,19,19,20,21,22,24,25],
  [-1,1,1,1,2,2,4,4,4,5,5,5,8,9,9,10,10,11,13,14,16,17,17,18,20,21,23,25,26,28,29,31,33,35,37,38,40,43,45,47,49],
  [-1,1,1,2,2,4,4,6,6,8,8,8,10,12,16,12,17,16,18,21,20,23,23,25,27,29,34,34,35,38,40,43,45,48,51,53,56,59,62,65,68],
  [-1,1,1,2,4,4,4,5,6,8,8,11,11,16,16,18,16,19,21,25,25,25,34,30,32,35,37,40,42,45,48,51,54,57,60,63,66,70,74,77,81]];
export const LEVELS: readonly EccLevel[] = ['L', 'M', 'Q', 'H'];
/** format-info ECC indicator bits, indexed by level index (L=0 … H=3) */
export const FMT: readonly number[] = [1, 0, 3, 2];
export const ALNUM = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ $%*+-./:';

/* ---------- GF(256) ---------- */
export const EXP = new Uint8Array(512);
export const LOG = new Uint8Array(256);
for (let i = 0, x = 1; i < 255; i++) { EXP[i] = x; LOG[x] = i; x <<= 1; if (x & 256) x ^= 0x11d; }
for (let i = 255; i < 512; i++) EXP[i] = EXP[i - 255];
export const gmul = (a: number, b: number): number => (a && b ? EXP[LOG[a] + LOG[b]] : 0);

function rawModules(v: number): number {
  let r = (16 * v + 128) * v + 64;
  if (v >= 2) { const n = Math.floor(v / 7) + 2; r -= (25 * n - 10) * n - 55; if (v >= 7) r -= 36; }
  return r;
}
export const rawCw = (v: number): number => rawModules(v) >> 3;
export const dataCw = (v: number, l: number): number => rawCw(v) - ECC[l][v] * BLK[l][v];

export function rsDivisor(deg: number): number[] {
  const r = new Array<number>(deg).fill(0); r[deg - 1] = 1; let root = 1;
  for (let i = 0; i < deg; i++) {
    for (let j = 0; j < deg; j++) { r[j] = gmul(r[j], root); if (j + 1 < deg) r[j] ^= r[j + 1]; }
    root = gmul(root, 2);
  }
  return r;
}
export function rsRemainder(data: readonly number[], div: readonly number[]): number[] {
  const r = div.map(() => 0);
  for (const b of data) { const f = b ^ (r.shift() as number); r.push(0); div.forEach((c, i) => { r[i] ^= gmul(c, f); }); }
  return r;
}

export function alignPositions(v: number): number[] {
  if (v === 1) return [];
  const n = Math.floor(v / 7) + 2, size = v * 4 + 17;
  const step = v === 32 ? 26 : Math.ceil((v * 4 + 4) / (n * 2 - 2)) * 2;
  const res = [6];
  for (let pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos);
  return res;
}

const grid = (size: number): Matrix => Array.from({ length: size }, () => new Array<boolean>(size).fill(false));

/** Function-pattern map (true = function module) plus a base matrix with the fixed modules drawn. */
export function functionMap(v: number): { size: number; fn: Matrix; m: Matrix } {
  const size = v * 4 + 17, fn = grid(size), m = grid(size);
  const set = (x: number, y: number, d: boolean) => { m[y][x] = d; fn[y][x] = true; };
  for (let i = 0; i < size; i++) { set(6, i, i % 2 === 0); set(i, 6, i % 2 === 0); }
  for (const [cx, cy] of [[3, 3], [size - 4, 3], [3, size - 4]])
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)), x = cx + dx, y = cy + dy;
      if (x >= 0 && x < size && y >= 0 && y < size) set(x, y, d !== 2 && d !== 4);
    }
  const ap = alignPositions(v), n = ap.length;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === n - 1) || (i === n - 1 && j === 0)) continue;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++)
      set(ap[i] + dx, ap[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1);
  }
  // reserve format area
  for (let i = 0; i < 9; i++) { fn[8][i] = true; fn[i][8] = true; }
  for (let i = 0; i < 8; i++) { fn[8][size - 1 - i] = true; fn[size - 1 - i][8] = true; }
  set(8, size - 8, true);
  if (v >= 7) {
    let rem = v; for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25);
    const bits = (v << 12) | rem;
    for (let i = 0; i < 18; i++) {
      const c = ((bits >>> i) & 1) !== 0, a = size - 11 + (i % 3), b = Math.floor(i / 3);
      set(a, b, c); set(b, a, c);
    }
  }
  return { size, fn, m };
}

export const MASKS: readonly ((x: number, y: number) => boolean)[] = [
  (x, y) => (x + y) % 2 === 0, (_x, y) => y % 2 === 0, (x) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0];

/** 15-bit format information for a level index (L=0 … H=3) and mask. */
export function formatBits(ecl: number, mask: number): number {
  const data = (FMT[ecl] << 3) | mask; let rem = data;
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537);
  return ((data << 10) | rem) ^ 0x5412;
}
function drawFormat(m: Matrix, size: number, ecl: number, mask: number): void {
  const bits = formatBits(ecl, mask), b = (i: number) => ((bits >>> i) & 1) !== 0;
  for (let i = 0; i <= 5; i++) m[i][8] = b(i);
  m[7][8] = b(6); m[8][8] = b(7); m[8][7] = b(8);
  for (let i = 9; i < 15; i++) m[8][14 - i] = b(i);
  for (let i = 0; i < 8; i++) m[8][size - 1 - i] = b(i);
  for (let i = 8; i < 15; i++) m[size - 15 + i][8] = b(i);
  m[size - 8][8] = true;
}

const FINDER_LIKE = /(?=(10111010000|00001011101))/g;
function penalty(m: Matrix, size: number): number {
  let res = 0;
  const runs = (line: (i: number) => boolean) => {
    let p = 0, run = 1;
    for (let i = 1; i < size; i++) { if (line(i) === line(i - 1)) run++; else { if (run >= 5) p += run - 2; run = 1; } }
    if (run >= 5) p += run - 2;
    return p;
  };
  for (let i = 0; i < size; i++) {
    res += runs(k => m[i][k]) + runs(k => m[k][i]);
    let rs = '', cs = '';
    for (let k = 0; k < size; k++) { rs += m[i][k] ? 1 : 0; cs += m[k][i] ? 1 : 0; }
    res += 40 * ((rs.match(FINDER_LIKE) || []).length + (cs.match(FINDER_LIKE) || []).length);
  }
  let dark = 0;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (m[y][x]) dark++;
    if (x && y) { const c = m[y][x]; if (c === m[y][x - 1] && c === m[y - 1][x] && c === m[y - 1][x - 1]) res += 3; }
  }
  const tot = size * size;
  res += 10 * (Math.ceil(Math.abs(dark * 20 - tot * 10) / tot) - 1);
  return res;
}

type Mode = 'n' | 'a' | 'b';
interface Segment { mode: Mode; cnt: number; body: number[] }

function makeSegment(text: string): Segment {
  const bits: number[] = [];
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  const isNum = /^[0-9]*$/.test(text), isAl = [...text].every(c => ALNUM.includes(c));
  if (text.length && isNum) {
    for (let i = 0; i < text.length; i += 3) { const s = text.slice(i, i + 3); push(parseInt(s, 10), s.length * 3 + 1); }
    return { mode: 'n', cnt: text.length, body: bits };
  }
  if (text.length && isAl) {
    for (let i = 0; i + 1 < text.length; i += 2) push(ALNUM.indexOf(text[i]) * 45 + ALNUM.indexOf(text[i + 1]), 11);
    if (text.length % 2) push(ALNUM.indexOf(text[text.length - 1]), 6);
    return { mode: 'a', cnt: text.length, body: bits };
  }
  const bytes = new TextEncoder().encode(text);
  for (const b of bytes) push(b, 8);
  return { mode: 'b', cnt: bytes.length, body: bits };
}

const MODE_BITS: Record<Mode, number> = { n: 1, a: 2, b: 4 };
const CC_LEN: Record<Mode, readonly number[]> = { n: [10, 12, 14], a: [9, 11, 13], b: [8, 16, 16] };
const ccLen = (v: number, mode: Mode) => CC_LEN[mode][v <= 9 ? 0 : v <= 26 ? 1 : 2];

/** Encode text into a QR matrix. Throws Error('too-long') when it does not fit version 40. */
export function encode(text: string, opts: EncodeOptions = {}): QRCode {
  let ecl = Math.max(0, LEVELS.indexOf(opts.ecl || 'M'));
  const seg = makeSegment(String(text));
  let v = opts.minVersion || 1, used: number;
  for (;; v++) {
    if (v > 40) throw new Error('too-long');
    used = 4 + ccLen(v, seg.mode) + seg.body.length;
    if (used <= dataCw(v, ecl) * 8) break;
  }
  if (opts.boost !== false) for (let l = 1; l < 4; l++) if (l > ecl && used <= dataCw(v, l) * 8) ecl = l;
  const bits: number[] = [];
  const push = (val: number, len: number) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1); };
  push(MODE_BITS[seg.mode], 4); push(seg.cnt, ccLen(v, seg.mode)); for (const b of seg.body) bits.push(b);
  const cap = dataCw(v, ecl) * 8;
  push(0, Math.min(4, cap - bits.length)); while (bits.length % 8) bits.push(0);
  for (let p = 0xec; bits.length < cap; p ^= 0xec ^ 0x11) push(p, 8);
  const data: number[] = [];
  for (let i = 0; i < bits.length; i += 8) { let b = 0; for (let j = 0; j < 8; j++) b = (b << 1) | bits[i + j]; data.push(b); }
  // blocks
  const nb = BLK[ecl][v], el = ECC[ecl][v], raw = rawCw(v), ns = nb - (raw % nb), sl = Math.floor(raw / nb);
  const div = rsDivisor(el), blocks: number[][] = [];
  for (let i = 0, k = 0; i < nb; i++) {
    const dl = sl - el + (i < ns ? 0 : 1), d = data.slice(k, k + dl); k += dl;
    const e = rsRemainder(d, div); if (i < ns) d.push(0);
    blocks.push(d.concat(e));
  }
  const all: number[] = [];
  for (let i = 0; i < blocks[0].length; i++) blocks.forEach((b, j) => { if (i !== sl - el || j >= ns) all.push(b[i]); });
  // place
  const { size, fn, m } = functionMap(v);
  let i = 0;
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5;
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j, up = ((right + 1) & 2) === 0, y = up ? size - 1 - vert : vert;
      if (!fn[y][x] && i < all.length * 8) { m[y][x] = ((all[i >>> 3] >>> (7 - (i & 7))) & 1) !== 0; i++; }
    }
  }
  const apply = (k: number) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && MASKS[k](x, y)) m[y][x] = !m[y][x]; };
  let best = opts.mask != null && opts.mask >= 0 ? opts.mask : -1;
  if (best < 0) {
    let min = Infinity;
    for (let k = 0; k < 8; k++) { apply(k); drawFormat(m, size, ecl, k); const p = penalty(m, size); if (p < min) { min = p; best = k; } apply(k); }
  }
  apply(best); drawFormat(m, size, ecl, best);
  return { version: v, size, ecl: LEVELS[ecl], mask: best, modules: m, fn };
}
