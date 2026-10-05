// EXIF in Rust, behind Beta (`ih_exif_rust`, PR #240).
//
// src/exif.rs is a port of this directory that its oracle tests hold
// byte-identical to the TypeScript on 281 fixtures. Beta is the next proof:
// real photos from real cameras. With the switch on, every EXIF call runs the
// Rust version AND the TypeScript one, and:
//
//   • they agree      → the Rust bytes are used;
//   • they disagree   → the TypeScript bytes are used (the shipped behavior,
//                       so a tester's export is never worse) and the mismatch
//                       is written to Diagnostics with the sizes, which is the
//                       finding Beta exists to collect;
//   • Rust throws     → the TypeScript bytes, and the error is logged.
//
// The public functions stay SYNCHRONOUS: the engine module is loaded once in
// the background (`primeRustExif`, at boot, only when the switch is on), and
// until it is ready the TypeScript path simply runs alone. A phone never loads
// it — `importEngine` waits until the engine is wanted.
import { importEngine } from "@/lib/engineGate";
import { logDiagnostic } from "@/lib/diagnosticsLog";

type Bytes = Uint8Array<ArrayBuffer>;

export function isExifRustEnabled(): boolean {
  try {
    return typeof window !== "undefined" && window.localStorage.getItem("ih_exif_rust") === "1";
  } catch {
    return false;
  }
}

interface RustExif {
  strip(bytes: Bytes, mode: string): Uint8Array;
  read(bytes: Bytes, mime: string): Uint8Array | undefined;
  verbatim(bytes: Bytes, mime: string, mode: string, stripMode: string): Uint8Array;
  reencoded(encoded: Bytes, format: string, mode: string, tiff: Bytes | undefined, w: number, h: number): Uint8Array;
}

let rust: RustExif | null = null;

/** Load the engine's EXIF functions once, in the background. No-op unless the
 *  Beta switch is on. */
export async function primeRustExif(): Promise<void> {
  if (rust || !isExifRustEnabled()) return;
  try {
    const m = await importEngine();
    rust = {
      strip: m.exif_strip_metadata,
      read: m.exif_read_tiff,
      verbatim: m.exif_apply_verbatim,
      reencoded: m.exif_apply_reencoded,
    };
  } catch (err) {
    logDiagnostic("WASM_ENGINE", `EXIF in Rust: engine failed to load, staying on TypeScript: ${String(err)}`);
  }
}

/** The Rust functions when the switch is on and they are loaded, else null. */
export function rustExif(): RustExif | null {
  return rust && isExifRustEnabled() ? rust : null;
}

function same(a: Uint8Array | null | undefined, b: Uint8Array | null | undefined): boolean {
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Run the Rust version beside the TypeScript result; use Rust only when they
 *  agree byte for byte. */
export function crossCheck<T extends Bytes | null>(
  name: string,
  runRust: () => Uint8Array | undefined,
  ts: T,
): T {
  let out: Uint8Array | undefined;
  try {
    out = runRust();
  } catch (err) {
    logDiagnostic("WASM_ENGINE", `EXIF in Rust: ${name} threw, used TypeScript: ${String(err)}`);
    return ts;
  }
  if (same(out ?? null, ts)) return ts === null ? ts : (new Uint8Array(out!) as T);
  logDiagnostic(
    "WASM_ENGINE",
    `EXIF in Rust: ${name} MISMATCH — Rust ${out?.length ?? "none"} B vs TypeScript ${ts?.length ?? "none"} B; used TypeScript`,
  );
  return ts;
}

/** Tests only: install fake Rust functions. */
export function setRustExifForTests(fake: RustExif | null): void {
  rust = fake;
}
