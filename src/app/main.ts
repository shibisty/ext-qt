/* UI controller shared by popup.html, sidebar.html and page.html (body[data-view] tells them apart). */
import { encode, type QRCode } from '../lib/qr-encode';
import { decode } from '../lib/qr-decode';
import { render, outerPath, innerPath, esc, PATTERNS, OUTER, INNER, type QRStyle, type OuterShape, type InnerShape, type Pattern } from '../lib/qr-render';
import { translate, detectLang, type Lang } from '../lib/i18n';
import { ext, hasExt, sidePanelClose } from './ext';
import {
  createDefault, PRESETS, STORAGE_KEY, fill, merge, clone, getP, setP, applyPreset, pushHistory,
  type AppState, type Theme, type Tab,
} from './state';
import { kindOf, wifiOf, contrastWarn, fileStamp } from './scan-utils';

type View = 'popup' | 'sidebar' | 'page';
interface Saved { by: string; t: number; state: AppState }

const view = (document.body.dataset.view || 'page') as View;
const ME = Math.random().toString(36).slice(2);
const $ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document): T => r.querySelector<T>(s) as T;
const $$ = <T extends HTMLElement = HTMLElement>(s: string, r: ParentNode = document): T[] => [...r.querySelectorAll<T>(s)];
const errText = (e: unknown) => String((e as Error)?.message || e);

/* ---------- state ---------- */
const DEFAULT = createDefault(detectLang(navigator.language));
let state: AppState = clone(DEFAULT);

/* ---------- storage ---------- */
let saveT: ReturnType<typeof setTimeout> | undefined;
const payload = (): Saved => ({ by: ME, t: Date.now(), state });
async function loadState(): Promise<void> {
  let saved: Saved | null = null;
  try {
    if (hasExt) saved = (await ext!.storage.local.get(STORAGE_KEY))[STORAGE_KEY] as Saved | null;
    else saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null') as Saved | null;
  } catch { /* ignore */ }
  if (saved && saved.state) state = merge(DEFAULT, saved.state);
}
function persistNow(): void {
  clearTimeout(saveT);
  try {
    if (hasExt) void ext!.storage.local.set({ [STORAGE_KEY]: payload() });
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(payload()));
  } catch { /* quota */ }
}
function persist(): void { clearTimeout(saveT); saveT = setTimeout(persistNow, 120); }
if (hasExt && ext!.storage.onChanged) ext!.storage.onChanged.addListener(ch => {
  const c = ch[STORAGE_KEY], nv = c?.newValue as Saved | undefined;
  if (!nv || nv.by === ME) return;
  state = merge(DEFAULT, nv.state); applyAll();
});

/* ---------- i18n / theme ---------- */
const t = (k: string) => translate(state.lang, k);
function applyI18n(): void {
  document.documentElement.lang = state.lang;
  $$('[data-i18n]').forEach(e => { e.textContent = t(e.dataset.i18n!); });
  $$<HTMLInputElement>('[data-i18n-ph]').forEach(e => { e.placeholder = t(e.dataset.i18nPh!); });
  $$('[data-i18n-title]').forEach(e => { e.title = t(e.dataset.i18nTitle!); });
  $('#btnLang').textContent = state.lang.toUpperCase(); $('#btnLang').title = t('lang');
  $('#btnTheme').textContent = ({ auto: '◐', light: '☀', dark: '☾' } as const)[state.theme]; $('#btnTheme').title = t('theme_' + state.theme);
}
function applyTheme(): void {
  if (state.theme === 'auto') document.documentElement.removeAttribute('data-theme');
  else document.documentElement.dataset.theme = state.theme;
}
let toastT: ReturnType<typeof setTimeout> | undefined;
function toast(msg: string): void {
  const e = $('#toast'); e.textContent = msg; e.classList.add('on');
  clearTimeout(toastT); toastT = setTimeout(() => e.classList.remove('on'), 1800);
}

/* ---------- build dynamic UI ---------- */
function fillHTML(p: string, types: string[]): string {
  return `<div class="fill" data-fillpath="${p}">
  <select data-bind="${p}.type">${types.map(x => `<option value="${x}" data-i18n="fill_${x}"></option>`).join('')}</select>
  <div class="fx solid"><input type="color" data-bind="${p}.color"><input type="text" class="hex" maxlength="7" data-bind="${p}.color"></div>
  <div class="fx gradient"><select data-bind="${p}.grad"><option value="linear" data-i18n="linear"></option><option value="radial" data-i18n="radial"></option></select>
    <input type="color" data-bind="${p}.c1"><input type="color" data-bind="${p}.c2"><label class="rng"><span data-i18n="angle"></span><input type="range" min="0" max="360" step="5" data-bind="${p}.angle"></label></div>
  <div class="fx image"><label class="btn"><span data-i18n="upload"></span><input type="file" accept="image/*" hidden data-file="${p}.img"></label><img class="thumb" data-src="${p}.img"><button class="btn ghost" data-clear="${p}.img">✕</button></div></div>`;
}
$$('[data-fill]').forEach(e => { e.outerHTML = fillHTML(e.dataset.fill!, e.dataset.types!.split(',')); });

const SAMPLE = encode('QR Studio', { ecl: 'L' });
const thumbStyle = (o: Partial<QRStyle>): QRStyle => Object.assign({
  pattern: 'square', gap: 0, outer: 'square', inner: 'square', quiet: 0, data: { type: 'solid', color: 'currentColor' },
  cOuter: { type: 'inherit' }, cInner: { type: 'inherit' }, bg: { type: 'none' }, bgRadius: 0, logo: {}, frame: { style: 'none' },
} satisfies QRStyle, o);
function cornerThumb(kind: 'outer' | 'inner', val: string): string {
  const o = (kind === 'outer' ? val : 'square') as OuterShape, i = (kind === 'inner' ? val : 'square') as InnerShape;
  return `<svg viewBox="-.4 -.4 7.8 7.8"><path fill-rule="evenodd" fill="currentColor" d="${outerPath(o, 0, 0, 'tl')}"/><path fill="currentColor" d="${innerPath(i, 2, 2, 'tl')}"/></svg>`;
}
$$('[data-grid]').forEach(g => {
  const p = g.dataset.grid!, kind = p.split('.')[1] as 'pattern' | 'outer' | 'inner';
  const list: readonly string[] = { pattern: PATTERNS, outer: OUTER, inner: INNER }[kind];
  g.innerHTML = list.map(v => `<button data-val="${v}" type="button">${kind === 'pattern' ? render(SAMPLE, thumbStyle({ pattern: v as Pattern })).svg : cornerThumb(kind, v)}</button>`).join('');
});
const presetBase = thumbStyle({
  data: fill({}), cOuter: fill({ type: 'inherit' }), cInner: fill({ type: 'inherit' }), bg: fill({ color: '#ffffff' }), quiet: 1,
  frame: { style: 'none', color: '#000', text: '', textColor: '#fff', width: 1 },
});
$('#presets').innerHTML = PRESETS.map((p, i) => `<button data-preset="${i}" type="button" title="${esc(p.n)}">${render(SAMPLE, merge(presetBase, p.s)).svg}</button>`).join('');

/* ---------- sync UI from state ---------- */
function showIf(expr: string): boolean {
  const [p, vals] = expr.split('='), v = getP(state, p);
  return vals === '*' ? !!v : vals.split('|').includes(String(v));
}
function syncUI(): void {
  $$<HTMLInputElement>('[data-bind]').forEach(el => {
    const v = getP(state, el.dataset.bind!);
    if (el.type === 'checkbox') el.checked = !!v;
    else if (document.activeElement !== el && String(el.value) !== String(v)) el.value = String(v);
  });
  $$('.fill').forEach(f => { f.dataset.type = String(getP(state, f.dataset.fillpath + '.type')); });
  $$('[data-grid]').forEach(g => $$('button', g).forEach(b => b.classList.toggle('on', b.dataset.val === getP(state, g.dataset.grid!))));
  $$<HTMLImageElement>('img[data-src]').forEach(i => { const v = getP(state, i.dataset.src!) as string; if (v) i.src = v; else i.removeAttribute('src'); });
  $$('[data-showif]').forEach(e => { e.hidden = !showIf(e.dataset.showif!); });
  $$('.tabs button').forEach(b => b.classList.toggle('on', b.dataset.tab === state.tab));
  $$('.pane').forEach(p => p.classList.toggle('on', p.id === 'tab-' + state.tab));
}
function applyAll(): void { applyTheme(); applyI18n(); syncUI(); renderPreview(); renderScan(); }
let rT: ReturnType<typeof setTimeout> | undefined;
function changed(): void { syncUI(); clearTimeout(rT); rT = setTimeout(renderPreview, 30); persist(); }

document.addEventListener('input', e => {
  const el = e.target as HTMLInputElement, p = el.dataset && el.dataset.bind; if (!p) return;
  let v: string | number | boolean;
  if (el.type === 'checkbox') v = el.checked;
  else if (el.type === 'range' || el.type === 'number' || 'num' in el.dataset) v = parseFloat(el.value);
  else v = el.value;
  if (el.classList.contains('hex') && !/^#[0-9a-f]{6}$/i.test(String(v))) return;
  setP(state, p, v); changed();
});
document.addEventListener('click', e => {
  const b = (e.target as Element).closest('button'); if (!b) return;
  if (b.dataset.val && b.parentElement?.dataset.grid) { setP(state, b.parentElement.dataset.grid, b.dataset.val); changed(); }
  else if (b.dataset.preset) { state.style = applyPreset(state.style, PRESETS[+b.dataset.preset].s, clone(DEFAULT.style)); changed(); }
  else if (b.dataset.clear) { setP(state, b.dataset.clear, ''); changed(); }
  else if (b.dataset.tab) setTab(b.dataset.tab as Tab);
  else if (b.dataset.goto) void gotoView(b.dataset.goto as View);
});
document.addEventListener('change', async e => {
  const el = e.target as HTMLInputElement, path = el.dataset && el.dataset.file; if (!path) return;
  const file = el.files && el.files[0]; if (!file) return;
  try {
    setP(state, path, await readImage(file, path.includes('logo') ? 600 : 1400));
    if (path.endsWith('.img') && !path.includes('logo')) setP(state, path.replace('.img', '.type'), 'image');
    changed();
  } catch (err) { toast(errText(err)); }
  el.value = '';
});
function readImage(file: File, max: number): Promise<string> {
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onerror = () => rej(new Error('read'));
    rd.onload = () => {
      const src = rd.result as string;
      if (file.type === 'image/svg+xml') return res(src);
      const img = new Image();
      img.onerror = () => rej(new Error('image'));
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement('canvas');
        c.width = Math.max(1, Math.round(img.width * k)); c.height = Math.max(1, Math.round(img.height * k));
        c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height);
        res(c.toDataURL(file.type === 'image/jpeg' ? 'image/jpeg' : 'image/png', 0.9));
      };
      img.src = src;
    };
    rd.readAsDataURL(file);
  });
}
const NEXT_THEME: Record<Theme, Theme> = { auto: 'light', light: 'dark', dark: 'auto' };
$('#btnTheme').onclick = () => { state.theme = NEXT_THEME[state.theme]; applyTheme(); applyI18n(); persist(); };
$('#btnLang').onclick = () => { state.lang = (state.lang === 'ru' ? 'en' : 'ru') as Lang; applyI18n(); renderPreview(); renderScan(); persist(); };
function setTab(tab: Tab): void { state.tab = tab; if (tab !== 'scan') stopCam(); syncUI(); persist(); }

/* ---------- generator ---------- */
let last: { qr: QRCode; w: number; h: number } | null = null;
function renderPreview(): void {
  const box = $('#preview'), meta = $('#meta'), s = state.style, text = state.text;
  if (!text) { box.innerHTML = `<div class="msg">${t('empty')}</div>`; meta.textContent = ''; last = null; return; }
  let qr: QRCode;
  try { qr = encode(text, { ecl: s.logo.img ? 'H' : state.ecl, boost: !s.logo.img }); }
  catch { box.innerHTML = `<div class="msg">${t('tooLong')}</div>`; meta.textContent = ''; last = null; return; }
  const r = render(qr, s);
  box.innerHTML = r.svg; (box.firstChild as SVGElement).style.setProperty('--ar', String(r.w / r.h));
  last = { qr, w: r.w, h: r.h };
  const warn = contrastWarn(s);
  meta.textContent = `v${qr.version} · ${qr.size}×${qr.size} · ECC ${qr.ecl}` + (s.logo.img && s.logo.size > 0.26 ? ' · ' + t('logoWarn') : '') + (warn ? ' · ' + t(warn) : '');
}
function svgFor(px: number): string { return render(last!.qr, state.style, { px }).svg; }
async function pngBlob(px: number): Promise<Blob> {
  const svg = svgFor(px), url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' })), img = new Image();
  img.src = url; await img.decode();
  const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * last!.h / last!.w);
  c.getContext('2d')!.drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
  return new Promise((res, rej) => c.toBlob(b => (b ? res(b) : rej(new Error('png'))), 'image/png'));
}
function download(blob: Blob, name: string): void {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
$('#dlPng').onclick = async () => { if (!last) return; download(await pngBlob(state.outSize), fileStamp() + '.png'); toast(t('saved')); };
$('#dlSvg').onclick = () => { if (!last) return; download(new Blob([svgFor(state.outSize)], { type: 'image/svg+xml' }), fileStamp() + '.svg'); toast(t('saved')); };
$('#cpImg').onclick = async () => {
  if (!last) return;
  try { await navigator.clipboard.write([new ClipboardItem({ 'image/png': await pngBlob(Math.min(state.outSize, 1024)) })]); toast(t('copied')); }
  catch (e) { toast(errText(e)); }
};
$('#useTab').onclick = async () => {
  try {
    let tabs = await ext!.tabs.query({ currentWindow: true });
    tabs = tabs.filter(x => /^https?:/i.test(x.url || ''));
    const pick = view === 'page' ? tabs.sort((a, b) => (b.lastAccessed || 0) - (a.lastAccessed || 0))[0] : (tabs.find(x => x.active) || tabs[0]);
    if (!pick?.url) throw new Error('no tab');
    state.text = pick.url; changed();
  } catch { toast(t('noTabUrl')); }
};
if (!hasExt || !ext!.tabs) $('#useTab').hidden = true;

/* ---------- scanner ---------- */
let BD: BarcodeDetector | null = null;
if ('BarcodeDetector' in globalThis) {
  try {
    BarcodeDetector.getSupportedFormats().then(f => { if (f.includes('qr_code')) BD = new BarcodeDetector({ formats: ['qr_code'] }); }).catch(() => {});
  } catch { /* none */ }
}
async function decodeCanvas(c: HTMLCanvasElement): Promise<string[]> {
  if (BD) { try { const r = await BD.detect(c); if (r.length) return r.map(x => x.rawValue); } catch { /* fallback */ } }
  const id = c.getContext('2d', { willReadFrequently: true })!.getImageData(0, 0, c.width, c.height);
  await new Promise(r => setTimeout(r, 0));
  const r = decode(id); return r != null ? [r] : [];
}
function thumbOf(c: HTMLCanvasElement): string {
  const k = Math.min(1, 240 / c.width), o = document.createElement('canvas');
  o.width = Math.max(1, (c.width * k) | 0); o.height = Math.max(1, (c.height * k) | 0);
  o.getContext('2d')!.drawImage(c, 0, 0, o.width, o.height); return o.toDataURL('image/jpeg', 0.7);
}
function setResults(list: string[], thumb: string): void {
  const sc = state.scan;
  sc.history = pushHistory(sc.history, list); sc.last = { text: list[0], n: list.length }; sc.thumb = thumb || '';
  persist(); renderScan();
}
function renderScan(): void {
  const sc = state.scan, res = $('#scanRes'), hist = $('#scanHist');
  const lastScan = sc.last;
  if (lastScan) {
    const k = kindOf(lastScan.text), w = k === 'wifi' ? wifiOf(lastScan.text) : null;
    res.innerHTML = `<div class="card2"><h4><span>${t('result')} <span class="tag">${t('type_' + k)}</span>${lastScan.n > 1 ? ' · ' + lastScan.n + ' ' + t('multi') : ''}</span></h4>
      ${w ? `<div class="kv"><b>${t('ssid')}</b><span>${esc(w.S)}</span><b>${t('password')}</b><span>${esc(w.P)}</span><b>${t('security')}</b><span>${esc(w.T)}</span></div>` : ''}
      <div class="res" id="resText">${esc(lastScan.text)}</div>
      <div class="row" style="margin-top:8px"><button class="btn pri" id="rCopy">${t('copyText')}</button>${k === 'url' ? `<button class="btn" id="rOpen">${t('openLink')}</button>` : ''}<button class="btn" id="rGen">${t('toGen')}</button></div>
      ${sc.thumb ? `<img class="sthumb" src="${esc(sc.thumb)}" alt="">` : ''}</div>`;
    $('#rCopy').onclick = async () => { try { await navigator.clipboard.writeText(lastScan.text); toast(t('copied')); } catch (e) { toast(String(e)); } };
    const open = document.querySelector<HTMLElement>('#rOpen');
    if (open) open.onclick = () => { if (hasExt && ext!.tabs) void ext!.tabs.create({ url: lastScan.text }); else window.open(lastScan.text, '_blank', 'noopener'); };
    $('#rGen').onclick = () => { state.text = lastScan.text; setTab('gen'); changed(); };
  } else res.innerHTML = '';
  hist.innerHTML = `<div class="card2"><h4><span>${t('history')}</span>${sc.history.length ? `<button class="btn ghost" id="hClear">${t('clear')}</button>` : ''}</h4>
    ${sc.history.length ? `<div class="hist">${sc.history.map((h, i) => `<div data-h="${i}"><span>${esc(h.text)}</span><button class="btn ghost" data-hd="${i}" title="${t('remove')}">✕</button></div>`).join('')}</div>` : `<div class="hint">${t('noHistory')}</div>`}</div>`;
  const hc = document.querySelector<HTMLElement>('#hClear');
  if (hc) hc.onclick = () => { sc.history = []; sc.last = null; sc.thumb = ''; persist(); renderScan(); };
  $$('[data-h]', hist).forEach(d => d.onclick = e => {
    const i = +d.dataset.h!;
    if ((e.target as HTMLElement).dataset.hd != null) sc.history.splice(i, 1);
    else { sc.last = { text: sc.history[i].text, n: 1 }; sc.thumb = ''; }
    persist(); renderScan();
  });
}
function scanMsg(html: string): void { $('#scanMsg').innerHTML = html ? `<div class="msgbox">${html}</div>` : ''; }
async function scanImageEl(img: HTMLImageElement): Promise<void> {
  scanMsg(t('scanning'));
  const iw = img.naturalWidth || img.width, ih = img.naturalHeight || img.height;
  const k = Math.min(1, 2200 / Math.max(iw, ih)), c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(iw * k)); c.height = Math.max(1, Math.round(ih * k));
  const x = c.getContext('2d', { willReadFrequently: true })!;
  x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  const list = await decodeCanvas(c);
  if (list.length) { scanMsg(''); setResults(list, thumbOf(c)); } else scanMsg(t('notFound'));
}
async function scanBlob(blob: Blob): Promise<void> {
  const url = URL.createObjectURL(blob), img = new Image(); img.src = url;
  try { await img.decode(); await scanImageEl(img); } catch { scanMsg(t('notFound')); } finally { URL.revokeObjectURL(url); }
}
$<HTMLInputElement>('#imgFile').onchange = e => {
  const input = e.target as HTMLInputElement, f = input.files?.[0];
  if (f) void scanBlob(f); input.value = '';
};
document.addEventListener('paste', e => {
  if (state.tab !== 'scan' || !e.clipboardData) return;
  for (const it of e.clipboardData.items) if (it.type.startsWith('image/')) { const f = it.getAsFile(); if (f) void scanBlob(f); e.preventDefault(); break; }
});
const drop = $('#drop');
(['dragenter', 'dragover'] as const).forEach(ev => document.addEventListener(ev, e => { if (state.tab === 'scan') { e.preventDefault(); drop.classList.add('over'); } }));
(['dragleave', 'drop'] as const).forEach(ev => document.addEventListener(ev, e => {
  drop.classList.remove('over');
  if (ev === 'drop' && state.tab === 'scan') { e.preventDefault(); const f = e.dataTransfer?.files[0]; if (f && f.type.startsWith('image/')) void scanBlob(f); }
}));
if (view === 'page' || !hasExt || !ext!.tabs || !ext!.tabs.captureVisibleTab) $('#tabBtn').hidden = true;
$('#tabBtn').onclick = async () => {
  try {
    const url = await ext!.tabs.captureVisibleTab(ext!.windows.WINDOW_ID_CURRENT, { format: 'png' });
    const img = new Image(); img.src = url; await img.decode(); await scanImageEl(img);
  } catch { scanMsg(t('tabShotFail')); }
};

/* ---------- camera ---------- */
let stream: MediaStream | null = null, camLoop: ReturnType<typeof setTimeout> | undefined, camCanvas: HTMLCanvasElement | null = null;
function stopCam(): void {
  clearTimeout(camLoop); camLoop = undefined;
  if (stream) { stream.getTracks().forEach(x => x.stop()); stream = null; }
  $('#camBox').hidden = true; $('#camRow').hidden = true; $('#camBtn').classList.add('pri');
}
async function startCam(): Promise<void> {
  stopCam(); scanMsg('');
  try {
    const v: MediaTrackConstraints = { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } };
    if (state.scan.cam) v.deviceId = { ideal: state.scan.cam };
    stream = await navigator.mediaDevices.getUserMedia({ video: v, audio: false });
    const video = $<HTMLVideoElement>('#video'); video.srcObject = stream; await video.play();
    $('#camBox').hidden = false; $('#camRow').hidden = false; $('#camBtn').classList.remove('pri');
    const devs = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
    const cur = stream.getVideoTracks()[0].getSettings().deviceId;
    $('#camSel').innerHTML = devs.map((d, i) => `<option value="${esc(d.deviceId)}" ${d.deviceId === cur ? 'selected' : ''}>${esc(d.label || t('camSelect') + ' ' + (i + 1))}</option>`).join('');
    const canvas = camCanvas = camCanvas || document.createElement('canvas');
    const tick = async (): Promise<void> => {
      if (!stream) return;
      const k = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
      canvas.width = Math.round(video.videoWidth * k); canvas.height = Math.round(video.videoHeight * k);
      if (canvas.width) {
        canvas.getContext('2d', { willReadFrequently: true })!.drawImage(video, 0, 0, canvas.width, canvas.height);
        const list = await decodeCanvas(canvas);
        if (list.length && stream) { const th = thumbOf(canvas); stopCam(); setResults(list, th); if (navigator.vibrate) navigator.vibrate(60); return; }
      }
      camLoop = setTimeout(tick, 120);
    };
    void tick();
  } catch (e) {
    stopCam();
    const err = e as DOMException | undefined;
    const denied = err && (err.name === 'NotAllowedError' || err.name === 'SecurityError');
    scanMsg((denied ? t('camDenied') : t('camErr') + ': ' + esc(err?.message || e)) + (view !== 'page' && hasExt ? ` <button class="btn" id="camPage">${t('openInPage')}</button>` : ''));
    const b = document.querySelector<HTMLElement>('#camPage'); if (b) b.onclick = () => void openPage('#cam');
  }
}
$('#camBtn').onclick = () => void startCam(); $('#camStop').onclick = stopCam;
$<HTMLSelectElement>('#camSel').onchange = e => { state.scan.cam = (e.target as HTMLSelectElement).value; persist(); void startCam(); };

/* ---------- view switching ---------- */
async function openPage(hash = ''): Promise<void> { await ext!.tabs.create({ url: ext!.runtime.getURL('page.html') + hash }); }
async function closeSelf(): Promise<void> {
  try {
    if (view === 'page') { const tab = await ext!.tabs.getCurrent(); if (tab?.id != null) void ext!.tabs.remove(tab.id); }
    else {
      const close = view === 'sidebar' ? sidePanelClose() : undefined;
      if (close) { const w = await ext!.windows.getCurrent(); void close({ windowId: w.id! }); }
      window.close();
    }
  } catch { /* ignore */ }
}
async function gotoView(target: View): Promise<void> {
  if (target === view || !hasExt) return;
  const e = ext!;
  persistNow(); stopCam();
  try {
    if (target === 'page') await openPage();
    else if (target === 'sidebar') {
      if (e.sidePanel) { const w = await e.windows.getCurrent(); await e.sidePanel.open({ windowId: w.id! }); }
      else if (e.sidebarAction) await e.sidebarAction.open();
      else throw new Error('no sidebar');
    } else {
      if (!e.action || !e.action.openPopup) throw new Error('no popup');
      await e.action.openPopup();
    }
  } catch { toast(t('switchFail')); return; }
  setTimeout(() => void closeSelf(), 150);
}
$$<HTMLButtonElement>('[data-goto]').forEach(b => {
  const g = b.dataset.goto as View;
  if (g === view) { b.classList.add('on'); b.disabled = true; }
  if (!hasExt || (g === 'sidebar' && !(ext!.sidePanel || ext!.sidebarAction)) || (g === 'popup' && !(ext!.action && ext!.action.openPopup))) b.hidden = true;
});
window.addEventListener('pagehide', () => { persistNow(); stopCam(); });
document.addEventListener('visibilitychange', () => { if (document.hidden) persistNow(); });

/* ---------- init ---------- */
void (async () => {
  await loadState();
  if (location.hash === '#cam') state.tab = 'scan';
  applyAll();
  if (location.hash === '#cam') void startCam();
})();
