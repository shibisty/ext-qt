/* Vite plugin: emits manifest.json for the target, checks referenced files, then zips dist/<target>/. */
import type { Plugin, ResolvedConfig } from 'vite';
import { existsSync, writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';
import { loadManifest, manifestPaths, referencedFiles, type Target } from './manifest.ts';
import { collectDir, createZip } from './zip.ts';

export interface ExtensionPluginOptions { root: string; target: Target; zipName?: string }

export function extensionPlugin({ root, target, zipName = `qr-studio-${target}.zip` }: ExtensionPluginOptions): Plugin {
  let config: ResolvedConfig;
  let watching = false;
  return {
    name: 'qr-studio:extension',
    apply: 'build',
    configResolved(c) { config = c; watching = !!c.build.watch; },
    buildStart() { for (const p of manifestPaths(root, target)) this.addWatchFile(p); },
    generateBundle() {
      this.emitFile({ type: 'asset', fileName: 'manifest.json', source: JSON.stringify(loadManifest(root, target), null, 2) + '\n' });
    },
    closeBundle: {
      sequential: true,
      handler() {
        const out = config.build.outDir;
        if (!existsSync(join(out, 'manifest.json'))) return; // build failed earlier
        const missing = referencedFiles(loadManifest(root, target)).filter(f => !existsSync(join(out, f)));
        if (missing.length) throw new Error(`[${target}] manifest references missing files: ${missing.join(', ')}`);
        if (watching) return;
        const files = collectDir(out), zp = join(root, 'dist', zipName);
        writeFileSync(zp, createZip(files));
        config.logger.info(`[${target}] ${files.length} files -> ${relative(root, out)}/ and ${relative(root, zp)}`);
      },
    },
  };
}
