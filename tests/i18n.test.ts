import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { I18N, LANGS, translate, detectLang, isLang } from '../src/lib/i18n';
import { FILL_TYPES, FRAMES, LOGO_SHAPES } from '../src/lib/qr-render';

const SRC = join(__dirname, '../src');
const en = I18N.en as Record<string, string>;

describe('translations', () => {
  it('every language has exactly the English keys, all non-empty', () => {
    const keys = Object.keys(en).sort();
    for (const lang of LANGS) {
      const table = I18N[lang] as Record<string, string>;
      expect(Object.keys(table).sort(), lang).toEqual(keys);
      for (const k of keys) expect(table[k].trim(), `${lang}.${k}`).not.toBe('');
    }
  });
  it('every data-i18n key used in the HTML pages exists', () => {
    for (const f of readdirSync(SRC).filter(f => f.endsWith('.html'))) {
      const html = readFileSync(join(SRC, f), 'utf8');
      for (const [, key] of html.matchAll(/data-i18n(?:-ph|-title)?="([\w]+)"/g)) expect(en, `${f}: ${key}`).toHaveProperty(key);
    }
  });
  it('every literal t("…") key in the app exists', () => {
    const code = readFileSync(join(SRC, 'app/main.ts'), 'utf8');
    const keys = [...code.matchAll(/\bt\('(\w+)'\)/g)].map(m => m[1]);
    expect(keys.length).toBeGreaterThan(20);
    for (const k of keys) expect(en, k).toHaveProperty(k);
  });
  it('dynamic key families are complete', () => {
    for (const x of ['auto', 'light', 'dark']) expect(en).toHaveProperty('theme_' + x);
    for (const x of FILL_TYPES) expect(en).toHaveProperty('fill_' + x);
    for (const x of FRAMES) expect(en).toHaveProperty('frame_' + x);
    for (const x of LOGO_SHAPES) expect(en).toHaveProperty('shape_' + x);
  });
});

describe('translate / detectLang', () => {
  it('falls back to English, then to the key', () => {
    expect(translate('ru', 'tabGen')).toBe('Генерация');
    expect(translate('de', 'tabGen')).toBe('Generate');
    expect(translate('en', 'no_such_key')).toBe('no_such_key');
  });
  it('detects Russian from BCP-47 tags', () => {
    expect(detectLang('ru-RU')).toBe('ru');
    expect(detectLang('RU')).toBe('ru');
    expect(detectLang('uk-UA')).toBe('en');
    expect(detectLang(undefined)).toBe('en');
    expect(isLang('ru')).toBe(true);
    expect(isLang('xx')).toBe(false);
  });
});
