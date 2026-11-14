/* Styled QR -> SVG renderer. Units are QR modules; the SVG viewBox is scaled on output. */
import type { QRCode } from './qr-encode';

export const PATTERNS = ['square', 'rounded', 'dots', 'dotsm', 'diamond', 'vbars', 'hbars', 'classy'] as const;
export const OUTER = ['square', 'rsm', 'rounded', 'circle', 'leaf', 'leafi'] as const;
export const INNER = ['square', 'rounded', 'dot', 'diamond', 'leaf'] as const;
export const FRAMES = ['none', 'border', 'rounded', 'bottom', 'top', 'bubble'] as const;
export const FILL_TYPES = ['solid', 'gradient', 'image', 'inherit', 'none'] as const;
export const LOGO_SHAPES = ['square', 'rounded', 'circle'] as const;

export type Pattern = (typeof PATTERNS)[number];
export type OuterShape = (typeof OUTER)[number];
export type InnerShape = (typeof INNER)[number];
export type FrameKind = (typeof FRAMES)[number];
export type FillType = (typeof FILL_TYPES)[number];
export type LogoShape = (typeof LOGO_SHAPES)[number];
export type Corner = 'tl' | 'tr' | 'bl';

export interface Fill {
  type: FillType;
  color?: string;
  c1?: string;
  c2?: string;
  angle?: number;
  grad?: 'linear' | 'radial';
  img?: string;
}
export interface LogoStyle {
  img?: string;
  /** logo side as a fraction of the module count */
  size?: number;
  margin?: number;
  shape?: LogoShape;
  back?: boolean;
  backColor?: string;
  clear?: boolean;
}
export interface FrameStyle {
  style?: FrameKind;
  color?: string;
  textColor?: string;
  text?: string;
  width?: number;
  customImg?: string;
  customPad?: number;
}
export interface QRStyle {
  pattern: Pattern;
  gap?: number;
  outer: OuterShape;
  inner: InnerShape;
  quiet?: number;
  data: Fill;
  cOuter?: Fill;
  cInner?: Fill;
  bg?: Fill;
  bgRadius?: number;
  logo?: LogoStyle;
  frame?: FrameStyle;
}
export interface RenderOptions {
  /** output width in px; omitted -> width="100%" */
  px?: number;
}
export interface RenderResult { svg: string; w: number; h: number }

type Radii = [number, number, number, number];
interface Neighbours { u: boolean; d: boolean; l: boolean; r: boolean }

const f = (n: number): number => +(+n).toFixed(3);
export const esc = (s: unknown): string => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c] as string);
const r4 = (v: number): Radii => [v, v, v, v];

/** Rounded rectangle path; r = [top-left, top-right, bottom-right, bottom-left]. */
export function rr(x: number, y: number, w: number, h: number, r: Radii): string {
  const [a, b, c, d] = r.map(v => Math.min(v, w / 2, h / 2));
  const arc = (v: number) => `A${f(v)} ${f(v)} 0 0 1 `;
  return `M${f(x + a)} ${f(y)}H${f(x + w - b)}` + (b ? arc(b) + `${f(x + w)} ${f(y + b)}` : '') +
    `V${f(y + h - c)}` + (c ? arc(c) + `${f(x + w - c)} ${f(y + h)}` : '') +
    `H${f(x + d)}` + (d ? arc(d) + `${f(x)} ${f(y + h - d)}` : '') +
    `V${f(y + a)}` + (a ? arc(a) + `${f(x + a)} ${f(y)}` : '') + 'Z';
}
const circ = (cx: number, cy: number, r: number) => `M${f(cx - r)} ${f(cy)}a${f(r)} ${f(r)} 0 1 0 ${f(2 * r)} 0a${f(r)} ${f(r)} 0 1 0 ${f(-2 * r)} 0Z`;
const poly = (pts: [number, number][]) => 'M' + pts.map(p => f(p[0]) + ' ' + f(p[1])).join('L') + 'Z';

function dotPath(p: Pattern, x: number, y: number, s: number, nb: Neighbours, gap: number): string {
  const g = (1 - s) / 2, X = x + g, Y = y + g, S = s, R = S / 2;
  switch (p) {
    case 'rounded': {
      if (gap > 0.01) return rr(X, Y, S, S, r4(R * 0.7));
      return rr(X, Y, S, S, [!nb.u && !nb.l ? R : 0, !nb.u && !nb.r ? R : 0, !nb.d && !nb.r ? R : 0, !nb.d && !nb.l ? R : 0]);
    }
    case 'dots': return circ(x + .5, y + .5, R);
    case 'dotsm': return circ(x + .5, y + .5, S * 0.32);
    case 'diamond': return poly([[x + .5, Y], [X + S, y + .5], [x + .5, Y + S], [X, y + .5]]);
    case 'vbars': return rr(X, y, S, 1, [!nb.u ? R : 0, !nb.u ? R : 0, !nb.d ? R : 0, !nb.d ? R : 0]);
    case 'hbars': return rr(x, Y, 1, S, [!nb.l ? R : 0, !nb.r ? R : 0, !nb.r ? R : 0, !nb.l ? R : 0]);
    case 'classy': return rr(X, Y, S, S, [R, 0, R, 0]);
    default: return rr(X, Y, S, S, r4(0));
  }
}
const CORNER_SHIFT: Record<Corner, number> = { tl: 0, tr: 1, bl: 3 };

/** 7x7 finder ring (outer square minus 5x5 hole, use fill-rule="evenodd"). */
export function outerPath(kind: OuterShape, x: number, y: number, corner: Corner = 'tl'): string {
  const R = 2.4, sh = CORNER_SHIFT[corner];
  const leaf = (v: number, inv: boolean): Radii => { const a = r4(v); a[inv ? (sh + 2) % 4 : sh] = 0; return a; };
  let o: Radii, i: Radii;
  switch (kind) {
    case 'rsm': o = r4(1.2); i = r4(0.4); break;
    case 'rounded': o = r4(2.2); i = r4(1.3); break;
    case 'circle': o = r4(3.5); i = r4(2.5); break;
    case 'leaf': o = leaf(R, false); i = leaf(1.4, false); break;
    case 'leafi': o = leaf(R, true); i = leaf(1.4, true); break;
    default: o = r4(0); i = r4(0);
  }
  return rr(x, y, 7, 7, o) + rr(x + 1, y + 1, 5, 5, i);
}
/** 3x3 finder centre. */
export function innerPath(kind: InnerShape, x: number, y: number, corner: Corner = 'tl'): string {
  const sh = CORNER_SHIFT[corner];
  switch (kind) {
    case 'rounded': return rr(x, y, 3, 3, r4(0.9));
    case 'dot': return circ(x + 1.5, y + 1.5, 1.5);
    case 'diamond': return poly([[x + 1.5, y - 0.2], [x + 3.2, y + 1.5], [x + 1.5, y + 3.2], [x - 0.2, y + 1.5]]);
    case 'leaf': { const a = r4(1.3); a[sh] = 0; return rr(x, y, 3, 3, a); }
    default: return rr(x, y, 3, 3, r4(0));
  }
}

export function render(qr: QRCode, st: QRStyle, opt: RenderOptions = {}): RenderResult {
  const N = qr.size, m = qr.modules, quiet = Math.max(0, st.quiet == null ? 2 : st.quiet);
  const Qs = N + 2 * quiet, defs: string[] = [];
  let uid = 0;
  // ---- layout / frame
  const fr = st.frame || {}, custom = !!fr.customImg;
  const kind: FrameKind | 'custom' = custom ? 'custom' : (fr.style || 'none');
  let pad = 0, top = 0, bot = 0;
  const fw = Math.max(0.3, fr.width == null ? 1.2 : fr.width), labelH = 4;
  if (custom) pad = fr.customPad == null ? 2 : fr.customPad;
  else if (kind === 'border' || kind === 'rounded') pad = fw;
  else if (kind === 'bottom' || kind === 'bubble') { pad = Math.max(fw, 1); bot = labelH + 0.6; }
  else if (kind === 'top') { pad = Math.max(fw, 1); top = labelH + 0.6; }
  const ox = pad, oy = pad + top;
  const W = Qs + 2 * pad, H = Qs + 2 * pad + top + bot;
  const A = { x: ox, y: oy, w: Qs, h: Qs };

  // ---- fills
  const fillRef = (fl: Fill | undefined, fallback = 'none'): string => {
    if (!fl || fl.type === 'none') return 'none';
    if (fl.type === 'inherit') return fallback;
    const id = 'f' + (++uid);
    if (fl.type === 'gradient') {
      const ang = (fl.angle || 0) * Math.PI / 180, cx = A.x + A.w / 2, cy = A.y + A.h / 2;
      const stops = `<stop offset="0" stop-color="${esc(fl.c1)}"/><stop offset="1" stop-color="${esc(fl.c2)}"/>`;
      if (fl.grad === 'radial') defs.push(`<radialGradient id="${id}" gradientUnits="userSpaceOnUse" cx="${f(cx)}" cy="${f(cy)}" r="${f(A.w * 0.72)}">${stops}</radialGradient>`);
      else {
        const L = A.w / 2 * (Math.abs(Math.cos(ang)) + Math.abs(Math.sin(ang)));
        defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(cx - Math.cos(ang) * L)}" y1="${f(cy - Math.sin(ang) * L)}" x2="${f(cx + Math.cos(ang) * L)}" y2="${f(cy + Math.sin(ang) * L)}">${stops}</linearGradient>`);
      }
      return `url(#${id})`;
    }
    if (fl.type === 'image' && fl.img) {
      defs.push(`<pattern id="${id}" patternUnits="userSpaceOnUse" x="${A.x}" y="${A.y}" width="${A.w}" height="${A.h}"><image href="${esc(fl.img)}" x="0" y="0" width="${A.w}" height="${A.h}" preserveAspectRatio="xMidYMid slice"/></pattern>`);
      return `url(#${id})`;
    }
    return esc(fl.color || '#000');
  };
  const dataFill = fillRef(st.data.type === 'inherit' ? { type: 'solid', color: '#000' } : st.data);
  const outerFill = fillRef(st.cOuter, dataFill);
  const innerFill = fillRef(st.cInner, outerFill);

  // ---- logo hole
  const lg = st.logo || {}, hasLogo = !!lg.img, logoSize = lg.size ?? 0.22, logoMargin = lg.margin ?? 0.5;
  const half = hasLogo ? (logoSize * N) / 2 + logoMargin : 0, c = N / 2;
  const inLogo = (x: number, y: number) => hasLogo && lg.clear !== false && x + 1 > c - half && x < c + half && y + 1 > c - half && y < c + half;
  const inFinder = (x: number, y: number) => (x < 7 && y < 7) || (x >= N - 7 && y < 7) || (x < 7 && y >= N - 7);
  const draw = (x: number, y: number) => x >= 0 && y >= 0 && x < N && y < N && m[y][x] && !inFinder(x, y) && !inLogo(x, y);
  const s = Math.max(0.35, 1 - (st.gap || 0));
  let d = '';
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    if (!draw(x, y)) continue;
    d += dotPath(st.pattern, x + ox + quiet, y + oy + quiet, s, { u: draw(x, y - 1), d: draw(x, y + 1), l: draw(x - 1, y), r: draw(x + 1, y) }, st.gap || 0);
  }
  // ---- assemble
  const out: string[] = [];
  const bgFill = fillRef(st.bg);
  const r0 = st.bgRadius || 0;
  if (kind === 'custom') out.push(`<image href="${esc(fr.customImg)}" x="0" y="0" width="${W}" height="${H}" preserveAspectRatio="none"/>`);
  else if (kind === 'border' || kind === 'rounded') {
    const R = kind === 'rounded' ? 2.4 : 0;
    out.push(`<path fill-rule="evenodd" fill="${esc(fr.color || '#000')}" d="${rr(0, 0, W, H, r4(R))}${rr(ox, oy, Qs, Qs, r4(r0))}"/>`);
  } else if (kind === 'bottom' || kind === 'top' || kind === 'bubble') {
    out.push(`<path fill="${esc(fr.color || '#000')}" d="${rr(0, 0, W, H, r4(2.2))}"/>`);
    const txt = String(fr.text || ''), band = kind === 'top' ? top : bot;
    const fs = Math.min(band * 0.5, (W - 2 * pad) / Math.max(1, txt.length * 0.62));
    const cy = kind === 'top' ? (pad + top / 2 + 0.2) : (oy + Qs + (bot + pad) / 2 - 0.2);
    if (txt) out.push(`<text x="${f(W / 2)}" y="${f(cy + fs * 0.35)}" text-anchor="middle" font-family="Arial, Helvetica, sans-serif" font-weight="700" font-size="${f(fs)}" fill="${esc(fr.textColor || '#fff')}">${esc(txt)}</text>`);
  }
  if (bgFill !== 'none') out.push(`<path fill="${bgFill}" d="${rr(ox, oy, Qs, Qs, r4(r0))}"/>`);
  if (kind === 'bubble') {
    const bc = st.bg && st.bg.type === 'solid' ? st.bg.color : '#fff';
    out.push(`<path fill="${esc(bc)}" d="${poly([[ox + Qs - 4.5, oy + Qs - 0.01], [ox + Qs - 0.5, oy + Qs - 0.01], [ox + Qs - 0.5, oy + Qs + 2.4]])}"/>`);
  }
  if (d) out.push(`<path fill="${dataFill}" d="${d}"/>`);
  const base: [number, number, Corner][] = [[0, 0, 'tl'], [N - 7, 0, 'tr'], [0, N - 7, 'bl']];
  let po = '', pi = '';
  for (const [fx, fy, k] of base) { po += outerPath(st.outer, ox + quiet + fx, oy + quiet + fy, k); pi += innerPath(st.inner, ox + quiet + fx + 2, oy + quiet + fy + 2, k); }
  out.push(`<path fill-rule="evenodd" fill="${outerFill}" d="${po}"/>`, `<path fill="${innerFill}" d="${pi}"/>`);
  if (hasLogo) {
    const L = logoSize * N, cx = ox + quiet + N / 2, cy = oy + quiet + N / 2, pl = L + 2 * logoMargin;
    const shp = lg.shape || 'rounded', rad = shp === 'circle' ? pl / 2 : shp === 'rounded' ? pl * 0.22 : 0;
    if (lg.back !== false && lg.clear !== false) out.push(`<path fill="${esc(lg.backColor || '#fff')}" d="${rr(cx - pl / 2, cy - pl / 2, pl, pl, r4(rad))}"/>`);
    const cid = 'c' + (++uid), ir = shp === 'circle' ? L / 2 : shp === 'rounded' ? L * 0.2 : 0;
    defs.push(`<clipPath id="${cid}"><path d="${rr(cx - L / 2, cy - L / 2, L, L, r4(ir))}"/></clipPath>`);
    out.push(`<image href="${esc(lg.img)}" x="${f(cx - L / 2)}" y="${f(cy - L / 2)}" width="${f(L)}" height="${f(L)}" preserveAspectRatio="xMidYMid meet" clip-path="url(#${cid})"/>`);
  }
  const wh = opt.px ? `width="${opt.px}" height="${Math.round(opt.px * H / W)}"` : 'width="100%"';
  return {
    svg: `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 ${f(W)} ${f(H)}" ${wh} shape-rendering="geometricPrecision">${defs.length ? '<defs>' + defs.join('') + '</defs>' : ''}${out.join('')}</svg>`,
    w: W,
    h: H,
  };
}
