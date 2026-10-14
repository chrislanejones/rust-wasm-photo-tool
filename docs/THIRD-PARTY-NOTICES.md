# Third-party notices

Libraries the Image Horse app ships whose licenses ask for a notice beyond the
dependency manifest. Everything else is in `app/package.json` and
`Cargo.toml`, under permissive licenses.

## libheif-js (libheif + libde265)

| | |
|---|---|
| What | HEIC/HEIF decoder, compiled to WebAssembly (`libheif-js/libheif-wasm/libheif-bundle.mjs`) |
| Used for | The HEIC import Beta (`?beta=heic-import`, ADR-087). Off by default. |
| Version | libheif-js 1.23.5 (`heif_get_version()` reports 1.23.5); bundles the libde265 HEVC decoder |
| License | GNU LGPL-3.0 (libheif and libde265) |
| License text, as shipped | [`app/public/licenses/libheif-js.LICENSE.txt`](../app/public/licenses/libheif-js.LICENSE.txt), served at `/licenses/libheif-js.LICENSE.txt` |
| Source | libheif-js: <https://github.com/catdad-experiments/libheif-js> · libheif: <https://github.com/strukturag/libheif> · libde265: <https://github.com/strukturag/libde265> |
| Modified? | No. The package is used exactly as published on npm. |

How it is kept a separate, replaceable work (LGPL-3.0 §4):

- It is its own file in the build (`assets/libheif-bundle-<hash>.js`), never
  inlined into app code. The only thing that reaches it is one dynamic
  `import()` inside the codec worker (`app/src/lib/heicCodec.ts`).
- It is fetched only when the Beta is on and a HEIC is opened. It is kept out
  of the service-worker precache (`app/vite.config.ts`, `globIgnores`).
- The app talks to it through the package's published JS API only (see
  `app/src/lib/libheif-js.d.ts`), so any build of libheif-js with the same API
  can be dropped in its place.
- `app/src/lib/heicCodec.test.ts` fails if the shipped license text stops
  matching the installed package's.
