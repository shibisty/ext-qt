import { describe, expect, it } from 'vitest';
import { encode, rsDivisor, rsRemainder, type EccLevel } from '../src/lib/qr-encode';
import { decode, decodeMatrix, rsCorrect, homography } from '../src/lib/qr-decode';
import { rasterize, lcg } from './helpers';

describe('rsCorrect', () => {
  const rnd = lcg(42);
  const data = Array.from({ length: 20 }, () => Math.floor(rnd() * 256));
  const block = data.concat(rsRemainder(data, rsDivisor(10)));

  it('accepts a clean block', () => {
    const b = block.slice();
    expect(rsCorrect(b, 10)).toBe(true);
    expect(b).toEqual(block);
  });
  it('repairs up to nsym/2 byte errors', () => {
    const b = block.slice();
    for (const i of [0, 4, 11, 19, 27]) b[i] ^= 0x5a;
    expect(rsCorrect(b, 10)).toBe(true);
    expect(b).toEqual(block);
  });
  it('reports failure beyond the correction capacity', () => {
    const b = block.slice();
    for (const i of [0, 3, 6, 9, 12, 15, 18]) b[i] ^= 0xff;
    expect(rsCorrect(b, 10)).toBe(false);
  });
});

describe('homography', () => {
  it('maps the four source points onto the destination points', () => {
    const src: [number, number][] = [[0, 0], [10, 0], [0, 10], [10, 10]];
    const dst: [number, number][] = [[5, 7], [52, 3], [9, 61], [70, 80]];
    const H = homography(src, dst)!;
    src.forEach((p, i) => {
      const [x, y] = H(p[0], p[1]);
      expect(x).toBeCloseTo(dst[i][0], 6); expect(y).toBeCloseTo(dst[i][1], 6);
    });
  });
  it('returns null for degenerate input', () => {
    expect(homography([[0, 0], [0, 0], [0, 0], [0, 0]], [[0, 0], [1, 0], [0, 1], [1, 1]])).toBeNull();
  });
});

describe('decodeMatrix (exact grid)', () => {
  const cases: [string, EccLevel][] = [
    ['12345678901234567890', 'M'],
    ['HELLO WORLD $%*+-./:', 'Q'],
    ['https://example.com/path?q=1&x=y', 'L'],
    ['Привет, мир! 👋 ünïcødé', 'H'],
    ['WIFI:T:WPA;S:Home;P:secret;;', 'M'],
  ];
  it.each(cases)('round-trips %j at ECC %s', (text, ecl) => {
    const q = encode(text, { ecl });
    expect(decodeMatrix((x, y) => q.modules[y][x], q.version)).toBe(text);
  });
  it('round-trips every mask pattern', () => {
    for (let mask = 0; mask < 8; mask++) {
      const q = encode('mask test', { mask });
      expect(decodeMatrix((x, y) => q.modules[y][x], q.version)).toBe('mask test');
    }
  });
  it('round-trips large versions', () => {
    const rnd = lcg(7);
    const text = Array.from({ length: 1600 }, () => String.fromCharCode(32 + Math.floor(rnd() * 95))).join('');
    const q = encode(text, { ecl: 'L' });
    expect(q.version).toBeGreaterThanOrEqual(27);
    expect(decodeMatrix((x, y) => q.modules[y][x], q.version)).toBe(text);
  });
  it('corrects damaged modules', () => {
    const q = encode('damage me please', { ecl: 'H', boost: false });
    const c = Math.floor(q.size / 2);
    const damaged = (x: number, y: number) => (Math.abs(x - c) <= 1 && Math.abs(y - c) <= 1 ? !q.modules[y][x] : q.modules[y][x]);
    expect(decodeMatrix(damaged, q.version)).toBe('damage me please');
  });
  it('rejects a grid of noise', () => {
    const rnd = lcg(1);
    const noise = Array.from({ length: 25 }, () => Array.from({ length: 25 }, () => rnd() < 0.5));
    expect(decodeMatrix((x, y) => noise[y][x], 2)).toBeNull();
  });
});

describe('decode (image)', () => {
  it.each([
    ['https://example.com', 4],
    ['QR Studio', 3],
    ['Сканер работает', 5],
    ['x'.repeat(300), 3],
  ] as const)('finds %j at %i px/module', (text, scale) => {
    const q = encode(text);
    expect(decode(rasterize(q.modules, scale))).toBe(text);
  });
  it('reads inverted (light-on-dark) codes', () => {
    const q = encode('inverted');
    expect(decode(rasterize(q.modules, 4, 4, true))).toBe('inverted');
  });
  it('downscales large images before decoding', () => {
    const q = encode('big picture');
    const img = rasterize(q.modules, 70); // (21 + 8) * 70 = 2030 px
    expect(img.width).toBeGreaterThan(1400);
    expect(decode(img)).toBe('big picture');
  });
  it('returns null for a blank image', () => {
    const data = new Uint8ClampedArray(200 * 200 * 4).fill(255);
    expect(decode({ data, width: 200, height: 200 })).toBeNull();
  });
});
