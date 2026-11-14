import type { Matrix } from '../src/lib/qr-encode';
import type { ImageLike } from '../src/lib/qr-decode';

/** Rasterize a module matrix to RGBA (dark = black) with a white quiet zone. */
export function rasterize(m: Matrix, scale = 4, quiet = 4, invert = false): ImageLike {
  const n = m.length, side = (n + 2 * quiet) * scale, data = new Uint8ClampedArray(side * side * 4).fill(255);
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const mx = Math.floor(x / scale) - quiet, my = Math.floor(y / scale) - quiet;
    let dark = mx >= 0 && my >= 0 && mx < n && my < n && m[my][mx];
    if (invert) dark = !dark;
    if (dark) { const i = (y * side + x) * 4; data[i] = data[i + 1] = data[i + 2] = 0; }
  }
  return { data, width: side, height: side };
}

/** Deterministic PRNG for reproducible "random" test data. */
export function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => (s = (Math.imul(s, 1664525) + 1013904223) >>> 0) / 2 ** 32;
}
