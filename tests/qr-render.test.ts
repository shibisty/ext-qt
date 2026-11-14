import { describe, expect, it } from 'vitest';
import { encode } from '../src/lib/qr-encode';
import { render, rr, outerPath, innerPath, esc, PATTERNS, OUTER, INNER, FRAMES } from '../src/lib/qr-render';
import { createDefault, PRESETS, applyPreset } from '../src/app/state';

const qr = encode('https://example.com', { ecl: 'M' });
const base = () => createDefault().style;

describe('path helpers', () => {
  it('rr draws a plain rect without arcs', () => {
    expect(rr(0, 0, 2, 3, [0, 0, 0, 0])).toBe('M0 0H2V3H0V0Z');
  });
  it('rr clamps radii to half the side', () => {
    expect(rr(0, 0, 2, 2, [5, 5, 5, 5])).toContain('A1 1 0 0 1');
  });
  it('outer/inner finder shapes render for every option', () => {
    for (const o of OUTER) expect(outerPath(o, 0, 0)).toMatch(/^M.*Z$/);
    for (const i of INNER) expect(innerPath(i, 2, 2)).toMatch(/^M.*Z$/);
  });
  it('esc escapes markup characters', () => {
    expect(esc('<a href="x">&</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  });
});

describe('render', () => {
  it('produces an SVG whose viewBox is modules + quiet zone', () => {
    const r = render(qr, { ...base(), quiet: 2 });
    expect(r.w).toBe(qr.size + 4);
    expect(r.h).toBe(qr.size + 4);
    expect(r.svg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
    expect(r.svg).toContain(`viewBox="0 0 ${qr.size + 4} ${qr.size + 4}"`);
    expect(r.svg).toContain('width="100%"');
  });
  it('sets pixel size when requested', () => {
    const r = render(qr, base(), { px: 512 });
    expect(r.svg).toContain('width="512" height="512"');
  });
  it('never emits NaN for any pattern / corner / frame combination', () => {
    for (const pattern of PATTERNS) for (const outer of OUTER) for (const inner of INNER) {
      const s = { ...base(), pattern, outer, inner };
      expect(render(qr, s).svg).not.toContain('NaN');
    }
    for (const style of FRAMES) {
      const s = base(); s.frame = { ...s.frame, style };
      expect(render(qr, s).svg).not.toContain('NaN');
    }
  });
  it('adds a label band for bottom/top frames and escapes the text', () => {
    const s = base(); s.frame = { ...s.frame, style: 'bottom', text: '<Scan & go>' };
    const r = render(qr, s);
    expect(r.h).toBeGreaterThan(r.w);
    expect(r.svg).toContain('&lt;Scan &amp; go&gt;');
    expect(r.svg).not.toContain('<Scan');
  });
  it('emits gradient definitions', () => {
    const s = base(); s.data = { ...s.data, type: 'gradient', grad: 'radial', c1: '#ff0000', c2: '#0000ff' };
    const r = render(qr, s);
    expect(r.svg).toContain('<radialGradient');
    expect(r.svg).toMatch(/fill="url\(#f\d+\)"/);
  });
  it('clears modules under a logo and clips the logo image', () => {
    const plain = render(qr, base()).svg;
    const s = base(); s.logo = { ...s.logo, img: 'data:image/png;base64,AAAA', size: 0.3 };
    const withLogo = render(qr, s).svg;
    expect(withLogo).toContain('<clipPath');
    expect(withLogo).toContain('href="data:image/png;base64,AAAA"');
    const dots = (svg: string) => (svg.match(/Z/g) || []).length;
    expect(dots(withLogo)).toBeLessThan(dots(plain));
  });
  it('uses the custom frame image instead of the built-in frame', () => {
    const s = base(); s.frame = { ...s.frame, style: 'border', customImg: 'data:image/png;base64,BBBB', customPad: 3 };
    const r = render(qr, s);
    expect(r.w).toBe(qr.size + 4 + 6);
    expect(r.svg).toContain('preserveAspectRatio="none"');
  });
  it('renders every preset', () => {
    for (const p of PRESETS) {
      const s = applyPreset(base(), p.s);
      expect(render(qr, s).svg, p.n).not.toContain('NaN');
    }
  });
});
