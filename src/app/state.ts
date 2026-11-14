/* App state shape, defaults, presets and small object-path helpers (no DOM access). */
import type { Fill, QRStyle } from '../lib/qr-render';
import type { EccLevel } from '../lib/qr-encode';
import type { Lang } from '../lib/i18n';

export type Theme = 'auto' | 'light' | 'dark';
export type Tab = 'gen' | 'scan';

export interface FullFill extends Fill {
  color: string; c1: string; c2: string; angle: number; grad: 'linear' | 'radial'; img: string;
}
export interface AppStyle extends QRStyle {
  gap: number; quiet: number; bgRadius: number;
  data: FullFill; cOuter: FullFill; cInner: FullFill; bg: FullFill;
  logo: Required<NonNullable<QRStyle['logo']>>;
  frame: Required<NonNullable<QRStyle['frame']>>;
}
export interface HistoryItem { text: string; t: number }
export interface ScanState {
  last: { text: string; n: number } | null;
  thumb: string;
  history: HistoryItem[];
  cam: string;
}
export interface AppState {
  tab: Tab;
  theme: Theme;
  lang: Lang;
  text: string;
  ecl: EccLevel;
  outSize: number;
  style: AppStyle;
  scan: ScanState;
}
/** Partial style used by presets (nested objects may be partial too). */
export type StylePatch = { [K in keyof AppStyle]?: AppStyle[K] extends object ? Partial<AppStyle[K]> : AppStyle[K] };

export const STORAGE_KEY = 'qrstudio.v1';
export const HISTORY_LIMIT = 25;

export const fill = (o: Partial<FullFill>): FullFill =>
  Object.assign({ type: 'solid', color: '#000000', c1: '#7c5cd6', c2: '#22d3ee', angle: 45, grad: 'linear', img: '' } satisfies FullFill, o);

export function createDefault(lang: Lang = 'en'): AppState {
  return {
    tab: 'gen', theme: 'auto', lang,
    text: 'https://example.com', ecl: 'M', outSize: 1024,
    style: {
      pattern: 'rounded', gap: 0, outer: 'rounded', inner: 'square', quiet: 2,
      data: fill({}), cOuter: fill({ type: 'inherit' }), cInner: fill({ type: 'inherit' }), bg: fill({ color: '#ffffff' }), bgRadius: 0,
      logo: { img: '', size: 0.22, margin: 0.5, shape: 'rounded', back: true, backColor: '#ffffff', clear: true },
      frame: { style: 'none', color: '#1f1f2e', textColor: '#ffffff', text: 'SCAN ME', width: 1.2, customImg: '', customPad: 2 },
    },
    scan: { last: null, thumb: '', history: [], cam: '' },
  };
}

export const PRESETS: readonly { n: string; s: StylePatch }[] = [
  { n: 'Classic', s: { pattern: 'square', outer: 'square', inner: 'square' } },
  { n: 'Soft', s: { pattern: 'rounded', outer: 'rounded', inner: 'rounded' } },
  { n: 'Lilac', s: { pattern: 'dots', gap: 0.08, outer: 'rounded', inner: 'square', data: fill({ color: '#a48ad8' }), bg: fill({ color: '#eeeeee' }) } },
  { n: 'Sunset', s: { pattern: 'rounded', outer: 'leaf', inner: 'leaf', data: fill({ type: 'gradient', c1: '#f97316', c2: '#db2777', angle: 45 }) } },
  { n: 'Scan me', s: { pattern: 'dots', gap: 0.12, outer: 'circle', inner: 'dot', data: fill({ color: '#444444' }), cOuter: fill({ color: '#c0392b' }), cInner: fill({ color: '#c0392b' }), frame: { style: 'bubble', color: '#c0392b', text: 'SCAN ME', textColor: '#ffffff', width: 1.4 } } },
  { n: 'Ocean', s: { pattern: 'classy', outer: 'leaf', inner: 'diamond', data: fill({ type: 'gradient', c1: '#0ea5e9', c2: '#1e3a8a', angle: 90 }), frame: { style: 'bottom', color: '#1e3a8a', text: 'Download App', textColor: '#ffffff', width: 1.2 } } },
  { n: 'Bars', s: { pattern: 'vbars', outer: 'rsm', inner: 'square', data: fill({ color: '#111111' }) } },
  { n: 'Neon', s: { pattern: 'rounded', outer: 'rounded', inner: 'rounded', data: fill({ type: 'gradient', c1: '#22d3ee', c2: '#a855f7', angle: 45 }), bg: fill({ color: '#0f172a' }) } },
];

/** Apply a preset on top of the default style, keeping the user's logo and margin. */
export function applyPreset(current: AppStyle, preset: StylePatch, defaults: AppStyle = createDefault().style): AppStyle {
  const s = merge(defaults, preset);
  s.logo = current.logo; s.quiet = current.quiet;
  return s;
}

/* ---------- object helpers ---------- */
type Obj = Record<string, unknown>;
export const clone = <T>(o: T): T => JSON.parse(JSON.stringify(o)) as T;
export const isObj = (x: unknown): x is Obj => !!x && typeof x === 'object' && !Array.isArray(x);

/** Deep-merge `s` over a copy of `d`. Plain objects merge recursively; everything else (arrays included) replaces. */
export function merge<T>(d: T, s: unknown): T {
  const r = clone(d) as Obj;
  if (!isObj(s)) return r as T;
  const base = d as Obj;
  for (const k of Object.keys(s)) r[k] = isObj(base[k]) && isObj(s[k]) ? merge(base[k], s[k]) : s[k];
  return r as T;
}
/** Read a dotted path ("style.logo.img"); undefined when any step is missing. */
export const getP = (o: unknown, p: string): unknown =>
  p.split('.').reduce<unknown>((a, k) => (a == null ? a : (a as Obj)[k]), o);
/** Write a dotted path; intermediate objects must exist. */
export function setP(o: object, p: string, v: unknown): void {
  const ks = p.split('.'), l = ks.pop() as string;
  (ks.reduce<Obj>((a, k) => a[k] as Obj, o as Obj))[l] = v;
}

/** Add scan results to the history (newest first, de-duplicated, capped). */
export function pushHistory(history: HistoryItem[], texts: string[], now = Date.now()): HistoryItem[] {
  let h = history.slice();
  for (const text of texts.slice().reverse()) { h = h.filter(x => x.text !== text); h.unshift({ text, t: now }); }
  return h.slice(0, HISTORY_LIMIT);
}
