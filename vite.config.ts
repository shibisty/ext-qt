import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { extensionPlugin } from './build/extension-plugin.ts';
import { isTarget, TARGETS } from './build/manifest.ts';

const root = fileURLToPath(new URL('.', import.meta.url));
const src = resolve(root, 'src');

// `vite build --mode chrome` / `--mode firefox` (see package.json scripts)
export default defineConfig(({ mode }) => {
  if (!isTarget(mode)) throw new Error(`Unknown target "${mode}". Use --mode ${TARGETS.join(' | ')}.`);
  const target = mode;
  return {
    root: src,
    base: './',
    publicDir: resolve(root, 'public'),
    build: {
      outDir: resolve(root, 'dist', target),
      emptyOutDir: true,
      target: target === 'chrome' ? 'chrome116' : 'firefox128',
      // Store reviewers (AMO in particular) read the shipped code; keep it unminified and readable.
      minify: false,
      modulePreload: { polyfill: false },
      reportCompressedSize: false,
      rolldownOptions: {
        input: {
          popup: resolve(src, 'popup.html'),
          sidebar: resolve(src, 'sidebar.html'),
          page: resolve(src, 'page.html'),
        },
        // no content hashes: extension files are versioned by the manifest, stable names keep store diffs readable
        output: { entryFileNames: 'assets/[name].js', chunkFileNames: 'assets/[name].js', assetFileNames: 'assets/[name][extname]' },
      },
    },
    plugins: [extensionPlugin({ root, target })],
  };
});
