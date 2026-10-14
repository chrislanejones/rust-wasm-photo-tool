// Beta "HEIC import" (ih_heic_import, ADR-087): OFF leaves every import funnel
// exactly where master had it, ON lets a .heic through and routes it to the
// converter. The converter itself is lib/heic.ts (heic.test.ts).
import { describe, it, expect, afterEach, vi } from "vitest";

const store = new Map<string, string>();
vi.stubGlobal("window", {
  localStorage: { getItem: (k: string) => store.get(k) ?? null },
  addEventListener: () => {},
  removeEventListener: () => {},
});

const { isHeicImportEnabled, isHeicImport } = await import("./heicImport");
const { isImportableFile, needsConversion, toDecodableFile } = await import("./importBoundary");

afterEach(() => store.clear());

const file = (name: string, type = "") => new File([new Uint8Array(1)], name, { type });
/** What Chrome and Firefox hand over for an iPhone photo: no mime at all. */
const typelessHeic = file("IMG_0001.HEIC");
const typedHeic = file("IMG_0002.heic", "image/heic");

describe("HEIC import switch", () => {
  it("is off unless the key is exactly '1'", () => {
    expect(isHeicImportEnabled()).toBe(false);
    store.set("ih_heic_import", "true");
    expect(isHeicImportEnabled()).toBe(false);
    store.set("ih_heic_import", "1");
    expect(isHeicImportEnabled()).toBe(true);
  });
});

describe("import boundary, Beta OFF = master", () => {
  it("drops a typeless .heic, as the old mime-or-SVG filter did", () => {
    expect(isHeicImport(typelessHeic)).toBe(false);
    expect(isImportableFile(typelessHeic)).toBe(false);
  });

  it("lets an image/heic through untouched, as the old filter did", async () => {
    expect(isImportableFile(typedHeic)).toBe(true);
    expect(needsConversion(typedHeic)).toBe(false);
    expect(await toDecodableFile(typedHeic)).toBe(typedHeic);
  });

  it("still treats SVG and ordinary images exactly as before", () => {
    expect(isImportableFile(file("a.svg"))).toBe(true);
    expect(needsConversion(file("a.svg"))).toBe(true);
    expect(isImportableFile(file("a.jpg", "image/jpeg"))).toBe(true);
    expect(needsConversion(file("a.jpg", "image/jpeg"))).toBe(false);
    expect(isImportableFile(file("notes.txt", "text/plain"))).toBe(false);
  });
});

describe("import boundary, Beta ON", () => {
  it("lets a typeless .heic through and marks it for conversion", () => {
    store.set("ih_heic_import", "1");
    expect(isImportableFile(typelessHeic)).toBe(true);
    expect(needsConversion(typelessHeic)).toBe(true);
    expect(needsConversion(typedHeic)).toBe(true);
  });

  it("leaves non-HEIC files alone", () => {
    store.set("ih_heic_import", "1");
    expect(needsConversion(file("a.jpg", "image/jpeg"))).toBe(false);
    expect(needsConversion(file("a.avif", "image/avif"))).toBe(false);
    expect(isImportableFile(file("notes.txt", "text/plain"))).toBe(false);
  });

  // A .heic that is really a JPEG goes back untouched for the normal decode
  // path — the sniff, not the name, decides what reaches libheif.
  it("hands back a JPEG named .heic without converting it", async () => {
    store.set("ih_heic_import", "1");
    const jpeg = new File(
      [new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 16, 0x4a, 0x46, 0x49, 0x46, 0, 0])],
      "liar.heic",
    );
    expect(await toDecodableFile(jpeg)).toBe(jpeg);
  });
});
