import { describe, expect, it } from 'vitest';
import { encode, formatBits, alignPositions, dataCw, rawCw, functionMap } from '../src/lib/qr-encode';

describe('formatBits', () => {
  // reference values from ISO/IEC 18004 Annex C (mask 0)
  it.each([[0, 0x77c4], [1, 0x5412], [2, 0x355f], [3, 0x1689]])('level %i mask 0 -> %s', (ecl, bits) => {
    expect(formatBits(ecl, 0)).toBe(bits);
  });
});

describe('capacity tables', () => {
  it('raw codewords match the spec for known versions', () => {
    expect(rawCw(1)).toBe(26);
    expect(rawCw(7)).toBe(196);
    expect(rawCw(40)).toBe(3706);
  });
  it('data codewords for 1-L/1-H and 40-L', () => {
    expect(dataCw(1, 0)).toBe(19);
    expect(dataCw(1, 3)).toBe(9);
    expect(dataCw(40, 0)).toBe(2956);
  });
  it('alignment pattern centres', () => {
    expect(alignPositions(1)).toEqual([]);
    expect(alignPositions(2)).toEqual([6, 18]);
    expect(alignPositions(7)).toEqual([6, 22, 38]);
    expect(alignPositions(32)).toEqual([6, 34, 60, 86, 112, 138]);
  });
});

describe('encode', () => {
  it('chooses the smallest version that fits (byte mode, ECC L)', () => {
    expect(encode('a'.repeat(17), { ecl: 'L', boost: false }).version).toBe(1);
    expect(encode('a'.repeat(18), { ecl: 'L', boost: false }).version).toBe(2);
  });
  it('uses numeric and alphanumeric modes', () => {
    expect(encode('1'.repeat(41), { ecl: 'L', boost: false }).version).toBe(1);
    expect(encode('1'.repeat(42), { ecl: 'L', boost: false }).version).toBe(2);
    expect(encode('A'.repeat(25), { ecl: 'L', boost: false }).version).toBe(1);
    expect(encode('A'.repeat(26), { ecl: 'L', boost: false }).version).toBe(2);
  });
  it('counts UTF-8 bytes, not characters', () => {
    expect(encode('я'.repeat(8), { ecl: 'L', boost: false }).version).toBe(1); // 16 bytes
    expect(encode('я'.repeat(9), { ecl: 'L', boost: false }).version).toBe(2); // 18 bytes
  });
  it('boosts the ECC level when it is free, unless disabled', () => {
    expect(encode('1', { ecl: 'L' }).ecl).toBe('H');
    expect(encode('1', { ecl: 'L', boost: false }).ecl).toBe('L');
  });
  it('fits 2953 bytes in version 40-L and rejects one more', () => {
    expect(encode('x'.repeat(2953), { ecl: 'L' }).version).toBe(40);
    expect(() => encode('x'.repeat(2954), { ecl: 'L' })).toThrow('too-long');
  });
  it('respects minVersion and a forced mask', () => {
    const q = encode('hi', { minVersion: 5, mask: 3 });
    expect(q.version).toBe(5);
    expect(q.mask).toBe(3);
  });
  it('produces a square matrix with finder and timing patterns', () => {
    const q = encode('https://example.com');
    const { size, modules: m } = q;
    expect(size).toBe(q.version * 4 + 17);
    expect(m).toHaveLength(size);
    m.forEach(r => expect(r).toHaveLength(size));
    for (const [ox, oy] of [[0, 0], [size - 7, 0], [0, size - 7]]) {
      for (let i = 0; i < 7; i++) {
        expect(m[oy][ox + i]).toBe(true); expect(m[oy + 6][ox + i]).toBe(true);
        expect(m[oy + i][ox]).toBe(true); expect(m[oy + i][ox + 6]).toBe(true);
      }
      for (let i = 1; i < 6; i++) expect(m[oy + 1][ox + i]).toBe(false);
      for (let y = 2; y < 5; y++) for (let x = 2; x < 5; x++) expect(m[oy + y][ox + x]).toBe(true);
    }
    for (let i = 8; i < size - 8; i++) { expect(m[6][i]).toBe(i % 2 === 0); expect(m[i][6]).toBe(i % 2 === 0); }
    expect(m[size - 8][8]).toBe(true); // dark module
  });
  it('is deterministic', () => {
    expect(encode('same input')).toEqual(encode('same input'));
  });
  it('writes version information from version 7', () => {
    expect(functionMap(6).fn[0][34 - 11]).toBe(false);
    expect(functionMap(7).fn[0][45 - 11]).toBe(true);
  });
});
