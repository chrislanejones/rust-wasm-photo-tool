import { describe, it, expect } from "vitest";
import { isLegacyHost } from "./legacyHost";

describe("isLegacyHost", () => {
  it.each([
    "rust-wasm-photo-tool.netlify.app",
    "RUST-WASM-PHOTO-TOOL.netlify.app",
    "deploy-preview-148--rust-wasm-photo-tool.netlify.app",
    "fix-something--rust-wasm-photo-tool.netlify.app",
  ])("is true on the retired Netlify site: %s", (host) => {
    expect(isLegacyHost(host)).toBe(true);
  });

  it.each([
    "edit.imagehorse.app",
    "imagehorse.app",
    "localhost",
    "127.0.0.1",
    // lookalikes — the notice must never appear on someone else's site
    "xrust-wasm-photo-tool.netlify.app",
    "other-rust-wasm-photo-tool.netlify.app",
    "rust-wasm-photo-tool.netlify.app.example.com",
    "netlify.app",
    "",
  ])("is false everywhere else: %j", (host) => {
    expect(isLegacyHost(host)).toBe(false);
  });
});
