import { describe, expect, it } from 'vitest';
import { kindOf, wifiOf, lum, contrastWarn, contrastRatio, fileStamp, CONTENT_KINDS } from '../src/app/scan-utils';
import { fill } from '../src/app/state';
import { I18N } from '../src/lib/i18n';

describe('kindOf', () => {
  it.each([
    ['https://a.b/c', 'url'], ['HTTP://X.Y', 'url'], ['WIFI:S:x;;', 'wifi'], ['mailto:a@b.c', 'mailto'],
    ['TEL:+123', 'tel'], ['sms:+1', 'sms'], ['geo:1,2', 'geo'], ['BEGIN:VCARD\nEND:VCARD', 'vcard'],
    ['john.doe+x@mail.example.org', 'email'], ['just text', 'text'], ['ftp://x', 'text'],
  ])('%j -> %s', (s, k) => expect(kindOf(s)).toBe(k));
  it('every kind has a label in every language', () => {
    for (const k of CONTENT_KINDS) for (const lang of Object.values(I18N)) expect((lang as Record<string, string>)['type_' + k]).toBeTruthy();
  });
});

describe('wifiOf', () => {
  it('parses fields in any order', () => {
    expect(wifiOf('WIFI:P:pw;T:WPA;S:Net;;')).toEqual({ S: 'Net', P: 'pw', T: 'WPA' });
  });
  it('unescapes backslash sequences', () => {
    expect(wifiOf('WIFI:T:WPA;S:My\\;Net;P:a\\:b\\\\c;;')).toEqual({ S: 'My;Net', P: 'a:b\\c', T: 'WPA' });
  });
  it('returns empty strings for missing fields', () => {
    expect(wifiOf('WIFI:S:open;;')).toEqual({ S: 'open', P: '', T: '' });
  });
});

describe('contrast', () => {
  it('computes WCAG luminance', () => {
    expect(lum('#ffffff')).toBeCloseTo(1, 5);
    expect(lum('#000000')).toBe(0);
    expect(lum('nope')).toBeNull();
    expect(contrastRatio(1, 0)).toBeCloseTo(21, 5);
  });
  it('flags low contrast, image fills, and passes good pairs', () => {
    expect(contrastWarn({ data: fill({ color: '#000000' }), bg: fill({ color: '#ffffff' }) })).toBe('');
    expect(contrastWarn({ data: fill({ color: '#777777' }), bg: fill({ color: '#888888' }) })).toBe('lowContrast');
    expect(contrastWarn({ data: fill({ type: 'gradient', c1: '#000000', c2: '#eeeeee' }), bg: fill({ color: '#ffffff' }) })).toBe('lowContrast');
    expect(contrastWarn({ data: fill({ type: 'image' }), bg: fill({}) })).toBe('checkScan');
    expect(contrastWarn({ data: fill({}), bg: fill({ type: 'none' }) })).toBe('');
  });
});

describe('fileStamp', () => {
  it('formats a UTC timestamp', () => {
    expect(fileStamp(new Date('2026-03-04T05:06:07Z'))).toBe('qr-20260304050607');
  });
});
