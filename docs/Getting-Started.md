# Getting Started

> Part of the [Image Horse](../README.md) docs. See also: [Architecture](Architecture.md) · [File Map](File-Map.md) · [Keyboard Shortcuts](Keyboard-Shortcuts.md) · [Change Summary](Change-summary.md).

This is a **single pnpm workspace** (`app` + `marketing`) with shared dependency
versions declared in the `pnpm-workspace.yaml` catalog — so install once at the
root and run either package from there:

```bash
cd rust-wasm-photo-tool

# Build the WASM module (consumed by the app via a Vite alias → ./pkg)
pnpm build:wasm        # wasm-pack build --target web --out-dir pkg

# Install the whole workspace (resolves the catalog: deps)
pnpm install

# Start the editor app
pnpm dev               # → pnpm --filter stamp-tool dev

# Start the marketing site
pnpm dev:marketing     # → pnpm --filter photo-horse-marketing dev
```

**Deploying:** the **marketing site** deploys on **Vercel** with its **Root Directory set to `marketing/`** — Vercel reads `marketing/vercel.json` (`pnpm install` + `pnpm build`, output `dist`); pnpm resolves the workspace `catalog:` from the repo root. The **editor app** deploys on **Netlify** from the repo (git) root — `netlify.toml` installs Rust + `wasm-pack`, builds the app, and publishes `www-dist`.

## With Convex

```bash
# In a separate terminal from the app/ directory
npx convex dev
```

Set up `app/.env.local` (never committed — see `.gitignore`):

```
VITE_CONVEX_URL=https://your-deployment.convex.cloud
VITE_CLERK_PUBLISHABLE_KEY=pk_...
```
