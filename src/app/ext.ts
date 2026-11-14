/* Cross-browser WebExtension handle: `browser` (Firefox) or `chrome` (Chromium). Undefined outside an extension. */

interface FirefoxExtras {
  sidebarAction?: { open(): Promise<void> };
}
export type Ext = typeof chrome & FirefoxExtras;

const g = globalThis as { browser?: Ext; chrome?: Ext };
export const ext: Ext | undefined = g.browser ?? g.chrome;
export const hasExt = !!ext?.storage?.local;

/** chrome.sidePanel.close only exists from Chrome 141. */
export function sidePanelClose(): ((o: { windowId: number }) => Promise<void>) | undefined {
  const sp = ext?.sidePanel as { close?: (o: { windowId: number }) => Promise<void> } | undefined;
  return typeof sp?.close === 'function' ? sp.close.bind(sp) : undefined;
}
