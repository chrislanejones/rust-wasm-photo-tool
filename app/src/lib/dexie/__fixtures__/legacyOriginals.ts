// Canonical legacy-originals fixture — a realistic snapshot of the hand-rolled
// `image-horse-originals` IndexedDB store as it exists BEFORE the Dexie
// cut-over. Used by the read-through round-trip test (legacyFixture.test.ts) and
// mirrored by the browser-capture procedure in scripts/db-snapshot/README.md.
//
// Each record models what `originalsStore.putOriginal` writes: content-addressed
// bytes plus mimeType/name/dimensions. `content` stands in for the raw file
// bytes (real galleries hold JPEG/PNG/WebP binaries; a short byte string is
// enough to prove the round-trip and keep the fixture readable).
import { putOriginal, type StoredOriginal } from "@/lib/originalsStore";

export interface FixtureOriginal {
  name: string;
  mimeType: string;
  width: number;
  height: number;
  /** Stand-in for the raw file bytes. */
  content: string;
}

/** A small, realistic gallery: mixed formats, sizes, and a portrait/landscape mix. */
export const LEGACY_ORIGINALS_FIXTURE: FixtureOriginal[] = [
  { name: "sunset.jpg", mimeType: "image/jpeg", width: 4032, height: 3024, content: "JPEG-sunset-bytes" },
  { name: "logo.png", mimeType: "image/png", width: 512, height: 512, content: "PNG-logo-bytes" },
  { name: "portrait.webp", mimeType: "image/webp", width: 1080, height: 1920, content: "WEBP-portrait-bytes" },
  { name: "scan.png", mimeType: "image/png", width: 2480, height: 3508, content: "PNG-scan-bytes" },
];

/**
 * Seed the fixture into the LEGACY raw-IndexedDB originals store (exactly as a
 * real user's gallery would look pre-migration). Returns the content-address
 * key for each record, in fixture order.
 */
export async function seedLegacyOriginals(
  fixture: FixtureOriginal[] = LEGACY_ORIGINALS_FIXTURE,
): Promise<string[]> {
  const keys: string[] = [];
  for (const f of fixture) {
    const file = new File([new TextEncoder().encode(f.content)], f.name, {
      type: f.mimeType,
    });
    keys.push(await putOriginal(file, f.width, f.height));
  }
  return keys;
}

/** Decode a `StoredOriginal`'s bytes back to the fixture's `content` string. */
export function decodeContent(rec: StoredOriginal): string {
  return new TextDecoder().decode(new Uint8Array(rec.bytes));
}
