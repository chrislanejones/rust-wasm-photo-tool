// PackBits — the run-length scheme PSD calls "RLE" (compression = 1). One
// signed header byte per run: 0..127 means "the next n+1 bytes are literal",
// -1..-127 means "repeat the next byte 1-n times", -128 is a no-op. Each image
// row is packed on its own, and the byte count of every packed row is written
// in a table ahead of the data (that table is the caller's job).

/** Pack one row. Runs of two or more identical bytes become a repeat; anything
 *  else is copied literally, 128 bytes at a time. Never longer than
 *  `src.length + ceil(src.length / 128)`. */
export function packBits(src: Uint8Array): Uint8Array {
  const out = new Uint8Array(src.length + Math.ceil(src.length / 128) + 1);
  let o = 0;
  let i = 0;
  const n = src.length;
  while (i < n) {
    let run = 1;
    while (i + run < n && run < 128 && src[i + run] === src[i]) run++;
    if (run >= 2) {
      out[o++] = (257 - run) & 0xff; // -(run - 1) as a byte
      out[o++] = src[i];
      i += run;
      continue;
    }
    // A literal stretch: stop where a run of three starts, or at 128 bytes.
    let j = i + 1;
    while (j < n && j - i < 128) {
      if (j + 2 < n && src[j] === src[j + 1] && src[j] === src[j + 2]) break;
      j++;
    }
    out[o++] = j - i - 1;
    out.set(src.subarray(i, j), o);
    o += j - i;
    i = j;
  }
  return out.subarray(0, o);
}

/**
 * Unpack `src[pos, end)` into `dst`. Stops at either end — a row packed for a
 * different width neither overruns `dst` nor reads past `end`. Returns how many
 * bytes of `dst` were written, so a short row is detectable by the caller.
 */
export function unpackBits(
  src: Uint8Array,
  pos: number,
  end: number,
  dst: Uint8Array,
): number {
  let o = 0;
  let p = pos;
  while (p < end && o < dst.length) {
    const h = src[p++];
    if (h === 128) continue;
    if (h < 128) {
      const len = Math.min(h + 1, end - p, dst.length - o);
      dst.set(src.subarray(p, p + len), o);
      o += len;
      p += len;
    } else {
      if (p >= end) break;
      const len = Math.min(257 - h, dst.length - o);
      dst.fill(src[p++], o, o + len);
      o += len;
    }
  }
  return o;
}
