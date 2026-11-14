/* Minimal ZIP writer (deflate, UTF-8 names, forward slashes) — what the Chrome Web Store and AMO expect. */
import { deflateRawSync, crc32 } from 'node:zlib';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

export interface ZipEntry { name: string; data: Buffer }

/** 1980-01-01 00:00 in MS-DOS format: fixed so builds are reproducible. */
const DOS_TIME = 0, DOS_DATE = (0 << 9) | (1 << 5) | 1;

export function createZip(files: ZipEntry[]): Buffer {
  const parts: Buffer[] = [], cen: Buffer[] = []; let off = 0;
  for (const { name, data } of files) {
    if (name.includes('\\')) throw new Error(`zip entry name must use "/": ${name}`);
    const nm = Buffer.from(name, 'utf8'), comp = deflateRawSync(data), crc = crc32(data);
    const h = Buffer.alloc(30);
    h.writeUInt32LE(0x04034b50, 0); h.writeUInt16LE(20, 4); h.writeUInt16LE(0x0800, 6); h.writeUInt16LE(8, 8);
    h.writeUInt16LE(DOS_TIME, 10); h.writeUInt16LE(DOS_DATE, 12);
    h.writeUInt32LE(crc, 14); h.writeUInt32LE(comp.length, 18); h.writeUInt32LE(data.length, 22); h.writeUInt16LE(nm.length, 26);
    const c = Buffer.alloc(46);
    c.writeUInt32LE(0x02014b50, 0); c.writeUInt16LE(20, 4); c.writeUInt16LE(20, 6); c.writeUInt16LE(0x0800, 8); c.writeUInt16LE(8, 10);
    c.writeUInt16LE(DOS_TIME, 12); c.writeUInt16LE(DOS_DATE, 14);
    c.writeUInt32LE(crc, 16); c.writeUInt32LE(comp.length, 20); c.writeUInt32LE(data.length, 24); c.writeUInt16LE(nm.length, 28); c.writeUInt32LE(off, 42);
    parts.push(h, nm, comp); cen.push(c, nm); off += 30 + nm.length + comp.length;
  }
  const cd = Buffer.concat(cen), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(files.length, 8); end.writeUInt16LE(files.length, 10);
  end.writeUInt32LE(cd.length, 12); end.writeUInt32LE(off, 16);
  return Buffer.concat([...parts, cd, end]);
}

const walk = (d: string): string[] =>
  readdirSync(d, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? walk(join(d, e.name)) : [join(d, e.name)]));

/** All files under `dir`, sorted, with zip-style relative names. */
export function collectDir(dir: string): ZipEntry[] {
  return walk(dir)
    .map(f => ({ name: relative(dir, f).split(sep).join('/'), data: readFileSync(f) }))
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0));
}
