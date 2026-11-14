import { describe, expect, it } from 'vitest';
import { createDefault, merge, getP, setP, clone, applyPreset, pushHistory, PRESETS, HISTORY_LIMIT, fill } from '../src/app/state';

describe('merge', () => {
  it('deep-merges objects and keeps defaults for missing keys', () => {
    const d = createDefault();
    const m = merge(d, { text: 'hi', style: { logo: { size: 0.3 } } });
    expect(m.text).toBe('hi');
    expect(m.style.logo.size).toBe(0.3);
    expect(m.style.logo.shape).toBe('rounded');
    expect(m.style.pattern).toBe(d.style.pattern);
  });
  it('replaces arrays and ignores non-object sources', () => {
    const d = { a: [1, 2], b: 1 };
    expect(merge(d, { a: [3] })).toEqual({ a: [3], b: 1 });
    expect(merge(d, null)).toEqual(d);
    expect(merge(d, 'x')).toEqual(d);
  });
  it('does not mutate its inputs', () => {
    const d = createDefault(), snap = clone(d);
    merge(d, { style: { gap: 0.2 } });
    expect(d).toEqual(snap);
  });
  it('restores state saved by an older version (missing new fields)', () => {
    const old = { text: 'x', style: { pattern: 'dots', frame: { style: 'border' } } };
    const s = merge(createDefault(), old);
    expect(s.style.frame.customPad).toBe(2);
    expect(s.scan.history).toEqual([]);
  });
});

describe('getP / setP', () => {
  it('reads and writes dotted paths', () => {
    const s = createDefault();
    expect(getP(s, 'style.logo.size')).toBe(0.22);
    expect(getP(s, 'style.nope.deep')).toBeUndefined();
    setP(s, 'style.frame.text', 'HELLO');
    expect(s.style.frame.text).toBe('HELLO');
  });
});

describe('createDefault', () => {
  it('uses the given language', () => {
    expect(createDefault('ru').lang).toBe('ru');
    expect(createDefault().lang).toBe('en');
  });
  it('returns independent objects', () => {
    const a = createDefault(), b = createDefault();
    a.style.logo.size = 1;
    expect(b.style.logo.size).toBe(0.22);
  });
  it('fill() fills every fill field', () => {
    expect(fill({ type: 'gradient' })).toMatchObject({ type: 'gradient', color: '#000000', angle: 45, grad: 'linear', img: '' });
  });
});

describe('applyPreset', () => {
  it('keeps the logo and margin but resets other style fields', () => {
    const cur = createDefault().style;
    cur.logo.img = 'data:x'; cur.quiet = 5; cur.gap = 0.3; cur.frame.style = 'top';
    const s = applyPreset(cur, PRESETS.find(p => p.n === 'Classic')!.s);
    expect(s.logo.img).toBe('data:x');
    expect(s.quiet).toBe(5);
    expect(s.gap).toBe(0);
    expect(s.frame.style).toBe('none');
    expect(s.pattern).toBe('square');
  });
});

describe('pushHistory', () => {
  it('puts newest first, de-duplicates and caps the list', () => {
    let h = pushHistory([], ['a'], 1);
    h = pushHistory(h, ['b'], 2);
    h = pushHistory(h, ['a'], 3);
    expect(h.map(x => x.text)).toEqual(['a', 'b']);
    expect(h[0].t).toBe(3);
    const many = Array.from({ length: 40 }, (_, i) => String(i));
    expect(pushHistory(h, many)).toHaveLength(HISTORY_LIMIT);
  });
  it('keeps the order of a multi-code scan', () => {
    expect(pushHistory([], ['first', 'second']).map(x => x.text)).toEqual(['first', 'second']);
  });
});
