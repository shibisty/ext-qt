import { describe, expect, it } from 'vitest';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { inflateRawSync, crc32 } from 'node:zlib';
import { loadManifest, mergeManifest, referencedFiles, TARGETS } from '../build/manifest';
import { createZip, type ZipEntry } from '../build/zip';

const ROOT = join(__dirname, '..');

/** Parse a ZIP via its central directory and inflate every entry. */
function readZip(buf: Buffer): ZipEntry[] {
  const eocd = buf.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  const count = buf.readUInt16LE(eocd + 10), cdOff = buf.readUInt32LE(eocd + 16), out: ZipEntry[] = [];
  for (let i = 0, p = cdOff; i < count; i++) {
    expect(buf.readUInt32LE(p)).toBe(0x02014b50);
    const csize = buf.readUInt32LE(p + 20), usize = buf.readUInt32LE(p + 24), nlen = buf.readUInt16LE(p + 28);
    const xlen = buf.readUInt16LE(p + 30), clen = buf.readUInt16LE(p + 32), lho = buf.readUInt32LE(p + 42), crc = buf.readUInt32LE(p + 16);
    const name = buf.toString('utf8', p + 46, p + 46 + nlen);
    expect(buf.readUInt32LE(lho)).toBe(0x04034b50);
    const start = lho + 30 + buf.readUInt16LE(lho + 26) + buf.readUInt16LE(lho + 28);
    const data = inflateRawSync(buf.subarray(start, start + csize));
    expect(data.length).toBe(usize);
    expect(crc32(data)).toBe(crc);
    out.push({ name, data });
    p += 46 + nlen + xlen + clen;
  }
  return out;
}

describe('manifest', () => {
  it('specific fields override base fields', () => {
    expect(mergeManifest({ a: 1, b: 1 }, { b: 2 })).toEqual({ a: 1, b: 2 });
  });
  it('chrome: side_panel, no gecko settings', () => {
    const m = loadManifest(ROOT, 'chrome');
    expect(m.manifest_version).toBe(3);
    expect(m.side_panel).toBeDefined();
    expect(m.permissions).toContain('sidePanel');
    expect(m.browser_specific_settings).toBeUndefined();
    expect(m.sidebar_action).toBeUndefined();
  });
  it('firefox: sidebar_action and gecko id, no side_panel', () => {
    const m = loadManifest(ROOT, 'firefox');
    expect((m.browser_specific_settings as { gecko: { id: string } }).gecko.id).toMatch(/@/);
    expect(m.sidebar_action).toBeDefined();
    expect(m.side_panel).toBeUndefined();
    expect(m.permissions).not.toContain('sidePanel');
  });
  it.each(TARGETS)('%s: every referenced icon/page exists in public/ or src/', target => {
    const files = referencedFiles(loadManifest(ROOT, target));
    expect(files.length).toBeGreaterThan(4);
    for (const f of files) expect(existsSync(join(ROOT, 'public', f)) || existsSync(join(ROOT, 'src', f)), f).toBe(true);
  });
  it('both targets share name and version', () => {
    const [c, f] = TARGETS.map(t => loadManifest(ROOT, t));
    expect(c.version).toBe(f.version);
    expect(c.name).toBe(f.name);
  });
});

describe('zip', () => {
  const files: ZipEntry[] = [
    { name: 'manifest.json', data: Buffer.from('{"a":1}') },
    { name: 'assets/main.js', data: Buffer.from('console.log("x");'.repeat(100)) },
    { name: 'icons/16.png', data: Buffer.from([0x89, 0x50, 0x4e, 0x47, 0, 1, 2, 3]) },
    { name: 'empty.txt', data: Buffer.alloc(0) },
    { name: 'тест/файл.txt', data: Buffer.from('юникод') },
  ];
  it('round-trips names and contents', () => {
    const back = readZip(createZip(files));
    expect(back.map(e => e.name)).toEqual(files.map(e => e.name));
    back.forEach((e, i) => expect(e.data.equals(files[i].data)).toBe(true));
  });
  it('rejects backslash paths (AMO "Invalid file name in archive")', () => {
    expect(() => createZip([{ name: 'a\\b.js', data: Buffer.from('') }])).toThrow(/must use "\/"/);
  });
  it('is byte-for-byte reproducible', () => {
    expect(createZip(files).equals(createZip(files))).toBe(true);
  });
});
