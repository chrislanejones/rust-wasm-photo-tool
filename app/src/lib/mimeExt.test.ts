import { describe, it, expect } from "vitest";
import { extFromMime } from "./mimeExt";

// The phone's Download saves the stored original under the gallery name, which
// has its extension stripped on import — so the file's type comes from the
// stored mime, and a file with no extension was the bug.
describe("extFromMime", () => {
  it.each([
    ["image/png", ".png"],
    ["image/jpeg", ".jpg"],
    ["image/webp", ".webp"],
    ["image/avif", ".avif"],
    ["image/gif", ".gif"],
    ["image/svg+xml", ".svg"],
  ])("%s → %s", (mime, ext) => expect(extFromMime(mime)).toBe(ext));

  it("falls back to the subtype, then to nothing", () => {
    expect(extFromMime("image/heic")).toBe(".heic");
    expect(extFromMime("application/octet-stream")).toBe(".octet-stream");
    expect(extFromMime("")).toBe("");
  });
});
