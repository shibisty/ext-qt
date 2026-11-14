/* Manifest = manifests/manifest.base.json shallow-merged with manifests/manifest.<target>.json. */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

export const TARGETS = ['chrome', 'firefox'] as const;
export type Target = (typeof TARGETS)[number];
export type Manifest = Record<string, unknown> & { manifest_version: number; name: string; version: string };

export const isTarget = (x: unknown): x is Target => TARGETS.includes(x as Target);

export function mergeManifest(base: Record<string, unknown>, specific: Record<string, unknown>): Manifest {
  return { ...base, ...specific } as Manifest;
}

export function manifestPaths(root: string, target: Target): string[] {
  return [join(root, 'manifests/manifest.base.json'), join(root, `manifests/manifest.${target}.json`)];
}

export function loadManifest(root: string, target: Target): Manifest {
  const [base, specific] = manifestPaths(root, target).map(p => JSON.parse(readFileSync(p, 'utf8')) as Record<string, unknown>);
  return mergeManifest(base, specific);
}

/** Every file path the manifest points at (icons and HTML pages), for existence checks. */
export function referencedFiles(m: Manifest): string[] {
  const out = new Set<string>();
  const icons = (o: unknown) => { if (o && typeof o === 'object') for (const v of Object.values(o)) if (typeof v === 'string') out.add(v); };
  const obj = (k: string) => (m[k] && typeof m[k] === 'object' ? (m[k] as Record<string, unknown>) : undefined);
  icons(m.icons);
  const action = obj('action'), side = obj('side_panel'), sidebar = obj('sidebar_action');
  if (action) { icons(action.default_icon); if (typeof action.default_popup === 'string') out.add(action.default_popup); }
  if (side && typeof side.default_path === 'string') out.add(side.default_path);
  if (sidebar) { icons(sidebar.default_icon); if (typeof sidebar.default_panel === 'string') out.add(sidebar.default_panel); }
  return [...out];
}
