/* Pure helpers for classifying scan results and checking colour contrast. */
import type { Fill, QRStyle } from '../lib/qr-render';

export const CONTENT_KINDS = ['url', 'wifi', 'mailto', 'tel', 'sms', 'geo', 'vcard', 'email', 'text'] as const;
export type ContentKind = (typeof CONTENT_KINDS)[number];

export function kindOf(s: string): ContentKind {
  if (/^https?:\/\//i.test(s)) return 'url';
  if (/^WIFI:/i.test(s)) return 'wifi';
  const m = s.match(/^(mailto|tel|sms|geo):/i); if (m) return m[1].toLowerCase() as ContentKind;
  if (/^BEGIN:VCARD/i.test(s)) return 'vcard';
  if (/^[\w.+-]+@[\w-]+\.[\w.-]+$/.test(s)) return 'email';
  return 'text';
}

export interface WifiInfo { S: string; P: string; T: string }
/** Parse a `WIFI:T:WPA;S:name;P:pass;;` payload (backslash escapes supported). */
export function wifiOf(s: string): WifiInfo {
  const g = (k: string) => {
    const m = s.match(new RegExp('(?:^WIFI:|;)' + k + ':((?:\\\\.|[^;])*)'));
    return m ? m[1].replace(/\\(.)/g, '$1') : '';
  };
  return { S: g('S'), P: g('P'), T: g('T') };
}

/** WCAG relative luminance of a #rrggbb colour, null when not parseable. */
export function lum(h: string | undefined): number | null {
  const m = /^#?([0-9a-f]{6})$/i.exec(h || ''); if (!m) return null;
  const v = [0, 2, 4].map(i => parseInt(m[1].slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2];
}
function fillLums(f: Fill | undefined): (number | null)[] | 'img' | null {
  if (!f || f.type === 'none') return null;
  if (f.type === 'image') return 'img';
  return (f.type === 'gradient' ? [f.c1, f.c2] : [f.color]).map(lum);
}
export const contrastRatio = (x: number, y: number): number => (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05);

/** i18n key of a scanability warning for the dots/background pair, or '' when fine. */
export function contrastWarn(s: Pick<QRStyle, 'data' | 'bg'>): '' | 'checkScan' | 'lowContrast' {
  const d = fillLums(s.data), b = fillLums(s.bg);
  if (d === 'img' || b === 'img') return 'checkScan';
  if (!d || !b) return '';
  return d.some(x => b.some(y => x != null && y != null && contrastRatio(x, y) < 3)) ? 'lowContrast' : '';
}

export const fileStamp = (d = new Date()): string => 'qr-' + d.toISOString().replace(/[-:T]/g, '').slice(0, 14);
