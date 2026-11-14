// @vitest-environment jsdom
/* Smoke test: boot the real UI on page.html (no extension APIs -> localStorage path). */
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const html = readFileSync(join(__dirname, '../src/page.html'), 'utf8');
const flush = () => new Promise(r => setTimeout(r, 0));
const $ = <T extends HTMLElement>(s: string) => document.querySelector<T>(s)!;

describe('app (page view)', () => {
  beforeAll(async () => {
    localStorage.clear();
    document.documentElement.innerHTML = html.replace(/^<!doctype html>\s*<html[^>]*>/i, '').replace(/<\/html>\s*$/, '').replace(/<script[^>]*><\/script>/g, '');
    document.body.dataset.view = 'page';
    await import('../src/app/main');
    await flush();
  });

  it('renders the default QR preview and metadata', () => {
    expect($('#preview').querySelector('svg')).not.toBeNull();
    expect($('#meta').textContent).toMatch(/^v\d+ · \d+×\d+ · ECC [LMQH]/);
  });
  it('fills in translated labels', () => {
    expect($('[data-tab="gen"]').textContent).toBe('Generate');
    expect($('#btnLang').textContent).toBe('EN');
  });
  it('builds pattern, corner and preset pickers', () => {
    expect(document.querySelectorAll('[data-grid="style.pattern"] button').length).toBe(8);
    expect(document.querySelectorAll('#presets button').length).toBe(8);
    expect(document.querySelectorAll('.fill').length).toBe(4);
  });
  it('re-renders when the content changes and persists state', async () => {
    vi.useFakeTimers();
    const ta = $<HTMLTextAreaElement>('#text');
    ta.value = 'hi there';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(200);
    vi.useRealTimers();
    const saved = JSON.parse(localStorage.getItem('qrstudio.v1')!);
    expect(saved.state.text).toBe('hi there');
    expect($('#meta').textContent).toContain('v1');
  });
  it('shows a message for empty content', () => {
    vi.useFakeTimers();
    const ta = $<HTMLTextAreaElement>('#text');
    ta.value = '';
    ta.dispatchEvent(new Event('input', { bubbles: true }));
    vi.advanceTimersByTime(50);
    vi.useRealTimers();
    expect($('#preview').textContent).toBe('Enter some content to build a QR code');
  });
  it('switches language and tabs', () => {
    $('#btnLang').click();
    expect($('[data-tab="gen"]').textContent).toBe('Генерация');
    $<HTMLButtonElement>('[data-tab="scan"]').click();
    expect($('#tab-scan').classList.contains('on')).toBe(true);
    expect($('#scanHist').textContent).toContain('Пока ничего не сканировали');
  });
  it('applies a preset', () => {
    $<HTMLButtonElement>('[data-tab="gen"]').click();
    $<HTMLButtonElement>('#presets [data-preset="0"]').click();
    expect($('[data-grid="style.pattern"] button.on').dataset.val).toBe('square');
  });
  it('hides extension-only controls outside the extension', () => {
    expect($('#useTab').hidden).toBe(true);
    expect($('#tabBtn').hidden).toBe(true);
    document.querySelectorAll<HTMLElement>('[data-goto]').forEach(b => expect(b.hidden).toBe(true));
  });
});
