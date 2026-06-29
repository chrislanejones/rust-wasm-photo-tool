# Security Hardening — Audit & Roadmap

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [Architecture Roadmap](Architecture-Roadmap.md).
>
> No critical "hacked in 5 minutes" holes — React (auto-escaping), Clerk (auth), WASM (memory-safe pixel ops), and TypeScript already remove whole bug classes. This tracks the hardening worth doing before calling Image Horse production-ready, with what's **done now** vs. **next** vs. **supervised**.

## Done in this pass

| Fix | Where | Note |
| --- | --- | --- |
| **Share tokens → CSPRNG** | `convex/shares.ts` `makeToken()` | Was `Math.random()` (~72 bits, non-crypto) gating the **public** `get` endpoint — i.e. the token *is* the access control. Now `crypto.randomUUID()` (122 bits, Convex-seeded, replay-safe). Existing tokens still resolve via the `by_token` index. |
| **EXIF privacy-by-default** | `app/src/lib/preferences.ts` | `DEFAULT_PREFERENCES.exifKeep` flipped `true → false` — export strips GPS / capture-time / device unless the user opts in. Existing users keep their stored choice (via `normalize`). |
| **Image firewall (utility)** | `app/src/lib/security/imageFirewall.ts` | Magic-byte sniff (never trusts `file.type`/`file.name`), size/pixel/dimension caps (decompression-bomb guard), explicit SVG rejection. **Not yet wired** — see below. |
| **Filename sanitizer (utility)** | `app/src/lib/security/sanitizeFilename.ts` | Strips `../`, separators, control chars, reserved names; bounded basename. For ZIP entries + download names. **Not yet wired.** |

## 🔴 High priority

1. **Image upload validation** — the utility exists; **wire it**. Before decoding in `handleAddPhotos` / `decodeImageSource`, call `validateUpload(file)` and reject `{ ok: false }`. ⚠️ Confirm the full set of accepted input formats first (AVIF? HEIC? TIFF?) so the magic-byte allowlist doesn't false-reject valid uploads — that's why it's a **supervised wire-in**, not a blind overnight change. Extend `SIGNATURES` to match.
2. **SVG** — handled by the firewall (rejected outright). If SVG support is ever wanted, **rasterize** it (don't render untrusted SVG); never inline it.
3. **Clipboard** — `navigator.clipboard.read()` paths must accept image MIME types only; reject `text/html`, SVG, and unexpected types. (Wire alongside the firewall.)
4. **Share viewer** — addressed by the token fix above. ✅
5. **AI prompts / titles** — treat user-supplied prompt/filename/title as untrusted on store + display (React escapes on render; sanitize before any non-React sink).

## 🟠 Medium priority

- **EXIF** — default now off (above). ✅
- **ZIP export** — normalize every entry name with `sanitizeFilename` (no `../`, no absolute paths) before adding to the archive.
- **Filename handling** — same util on any `download=` attribute.
- **IndexedDB encryption** — if storing private/AI work, consider AES-GCM before Dexie (Web Crypto). Note the key-management cost; only worth it for genuinely sensitive data. See [IndexedDB Investigation](IndexedDB-Investigation.md).
- **Drag & drop** — validate `DataTransferItem.kind === "file"`; reject `text/html` / `text/plain` / `uri-list` unless intentionally supported.

## 🟡 Low priority

- **Console logging** — route production diagnostics through the existing diagnostics logger / PostHog, not raw `console.*`.
- **CSP** — the `index.html` theme-bootstrap inline `<script>` needs a `nonce`/hash before a strict CSP. ⚠️ Getting CSP wrong breaks the app — do it deliberately and test, not blind.
- **Object URLs** — already mostly revoked; audit every `createObjectURL` for a matching `revokeObjectURL` (incl. the new Dexie `getOriginalAsBlobUrl` / `getDisplayBlobUrl`).
- **Web workers** — accept only typed arrays / buffers / known command messages; never `eval`-style payloads.

## ✅ Already good

React HTML auto-escaping · Clerk auth · WASM memory-safety for pixel ops · most Blob URLs revoked · explicit (not automatic) EXIF handling · TypeScript.

## The "image firewall" pipeline

This is what `validateUpload` implements; wiring it puts it on the critical path:

```
Upload → extension → MIME → MAGIC BYTES → size cap → pixel/dimension caps → decode (worker) → Rust/WASM
```

Reject before decode. Protects against oversized images, malformed files, and decompression-bomb DoS.

## Future hardening (supervised, larger)

CSP + Trusted Types · COOP/COEP + cross-origin isolation (needed anyway for WASM **threads** — see [Service Workers & Caching](Service-Workers-Caching.md) §5) · SRI for any CDN assets · worker sandboxing · upload/share/AI **rate limiting** (Convex) · signed URLs + request signing · AES-encrypted IndexedDB · automated dependency scanning (Dependabot already on — see [GitHub Actions](GitHub-Actions.md)) · security headers.
