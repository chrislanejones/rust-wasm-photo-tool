import { test, expect } from "./guard/test";
import type { BrowserContext, Request } from "@playwright/test";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  CHECKER,
  DESKTOP,
  PAIR_LAUNCH,
  galleryTiles,
  pairUp,
  phoneTiles,
  png,
  storedOriginals,
  syntheticPng,
} from "./pair-harness";

// ─────────────────────────────────────────────────────────────────────────────
// Sending photos over a pairing (ticket 242 PR 2, ADR-105 "Sending"): a
// computer at 1280 and a phone at 390, in two browser contexts, paired over
// real WebRTC (pair-harness.ts says what stands in for Convex), then photos
// both ways over the data channel.
//
// "Byte-identical" here means the SHA-256 of the original IndexedDB stored on
// the receiving side equals the SHA-256 of the synthetic fixture the sender
// picked. Every fixture is generated in this file; none is a real photo.
// ─────────────────────────────────────────────────────────────────────────────

test.use(PAIR_LAUNCH);
test.setTimeout(180_000);

const SHOTS = process.env.PAIR_SHOTS_DIR;
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");

/** Anything that could carry a photo off the device: any request that is not
 *  a GET or that has a body, anything naming Convex, storage or an upload, a
 *  GET off localhost, and every byte sent on a websocket. Collected on every
 *  context given, from now until the returned function is called.
 *
 *  One exception, named: Clerk's loader re-requesting its own script
 *  (`clerk.browser.js`) from the build's placeholder `.invalid` host, on its
 *  own retry timer. It is a bodiless GET, aborted offline, and unrelated to
 *  the send; it landed inside the window on one run in three.
 *
 *  A second, just as narrow: the Convex client reconnecting to the build's
 *  PLACEHOLDER deployment on its own timer. Each reconnect opens the sync
 *  socket and sends exactly two frames, measured 11-21-2026:
 *    {"type":"Connect", "connectionCount":3, "sessionId":…}            ~156 B
 *    {"type":"ModifyQuerySet", "modifications":[Add users:me {},
 *                              Add subscriptions:getByUser {}]}       ~209 B
 *  That is the signed-out app's own two subscriptions, unrelated to the send;
 *  it failed CI twice (#492's run, #494's run) when a reconnect landed inside
 *  the window. Only those two message shapes, on that host, are ignored: a
 *  Mutation, an Action, an Authenticate, or any other query still counts. */
function serverTraffic(contexts: BrowserContext[]) {
  const seen: string[] = [];
  const local = (u: string) => /^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(u) || u.startsWith("blob:") || u.startsWith("data:");
  const clerkLoader = (u: string) => /^https:\/\/clerk\.[a-z0-9-]+\.invalid\/npm\/@clerk\/clerk-js@[^/]+\/dist\/clerk\.browser\.js$/.test(u);
  const placeholderSync = (u: string) => /^wss:\/\/smoke-placeholder-[0-9]+\.convex\.cloud\/api\/[^/]+\/sync$/.test(u);
  const SIGNED_OUT_QUERIES = new Set(["users:me", "subscriptions:getByUser"]);
  const reconnectHandshake = (payload: string) => {
    let m: { type?: string; modifications?: { type?: string; udfPath?: string; args?: unknown }[] };
    try { m = JSON.parse(payload); } catch { return false; }
    if (m.type === "Connect") return true;
    return m.type === "ModifyQuerySet" && Array.isArray(m.modifications) && m.modifications.every((q) =>
      q.type === "Add" && SIGNED_OUT_QUERIES.has(q.udfPath ?? "") && JSON.stringify(q.args) === "[{}]");
  };
  const onRequest = (r: Request) => {
    const u = r.url();
    const carries = r.method() !== "GET" || r.postDataBuffer() !== null || /convex|storage|upload/i.test(u);
    if (carries || (!local(u) && !clerkLoader(u))) seen.push(`${r.method()} ${u}`);
  };
  for (const c of contexts) {
    c.on("request", onRequest);
    for (const p of c.pages()) {
      p.on("websocket", (ws) => {
        const reconnect = placeholderSync(ws.url());
        if (!reconnect) seen.push(`WEBSOCKET ${ws.url()}`);
        ws.on("framesent", (f) => {
          const payload = String(f.payload);
          if (reconnect && reconnectHandshake(payload)) return;
          seen.push(`FRAME ${ws.url()} ${payload.length} B`);
        });
      });
    }
  }
  return () => {
    for (const c of contexts) c.off("request", onRequest);
    return seen;
  };
}

test("phone → computer: 3 photos, accepted, land byte-identical, and nothing goes to a server", async ({ browser, context, page }) => {
  const { relay, phone } = await pairUp(browser, context, page);
  const files = [1, 2, 3].map((i) => png(`phone-${i}.png`, syntheticPng(96, 64, i)));
  const relayCalls = relay.log.length;
  const traffic = serverTraffic([context, phone.context]);

  await phone.page.getByTestId("pair-send-input").setInputFiles(files);
  const dialog = page.getByTestId("pair-transfer");
  await expect(page.getByTestId("pair-transfer-title")).toHaveText(/^Android phone wants to send 3 photos \(\d+ KB\)$/, { timeout: 30_000 });
  await expect(phone.page.getByTestId("pair-transfer-title")).toHaveText("Waiting for your computer to accept…");
  if (SHOTS) {
    mkdirSync(SHOTS, { recursive: true });
    await dialog.screenshot({ path: join(SHOTS, "pair-incoming-prompt-1280-dark.png") });
  }
  await dialog.getByRole("button", { name: "Accept", exact: true }).click();

  await expect(dialog).toHaveAttribute("data-outcome", "done", { timeout: 60_000 });
  await expect(page.getByTestId("pair-transfer-title")).toHaveText("3 photos added to your gallery");
  await expect(galleryTiles(page)).toHaveCount(4);
  await expect(phone.page.getByTestId("pair-transfer-title")).toHaveText("3 photos sent", { timeout: 30_000 });

  const stored = await storedOriginals(page);
  for (const f of files) expect(stored[f.name], f.name).toBe(sha(f.buffer));

  // Photos never touch the server: no request but the app's own GETs, no
  // websocket byte, and not one call to the signaling stand-in.
  expect(traffic()).toEqual([]);
  expect(relay.log.length).toBe(relayCalls);
  await phone.context.close();
});

test("computer → phone: 2 selected originals, accepted, in the phone's grid byte-identical, no engine", async ({ browser, context, page }) => {
  const desk = [1, 2].map((i) => png(`desk-${i}.png`, syntheticPng(80, 60, 10 + i)));
  const { relay, phone, phoneRequests } = await pairUp(browser, context, page, { computerFiles: [CHECKER, ...desk] });
  const relayCalls = relay.log.length;
  const traffic = serverTraffic([context, phone.context]);

  // Tick both: the "Select image" toggle inside each tile (the tile itself opens it).
  for (const name of ["desk-1", "desk-2"]) {
    const tile = page.getByRole("button", { name: `Select photo ${name}`, exact: true });
    await tile.hover();
    await tile.getByRole("button", { name: "Select image" }).click();
  }
  await page.getByRole("button", { name: "Send 2 to phone" }).click();
  await expect(page.getByTestId("pair-transfer")).toContainText("Edits aren't included unless you export the photo first.");

  const prompt = phone.page.getByTestId("pair-transfer");
  await expect(phone.page.getByTestId("pair-transfer-title")).toHaveText(/^Computer wants to send 2 photos \(\d+ KB\)$/, { timeout: 30_000 });
  if (SHOTS) await prompt.screenshot({ path: join(SHOTS, "pair-incoming-prompt-390-dark.png") });
  await prompt.getByRole("button", { name: "Accept", exact: true }).click();
  await expect(prompt).toHaveAttribute("data-outcome", "done", { timeout: 60_000 });
  await expect(phone.page.getByTestId("pair-transfer-title")).toHaveText("2 photos added to your gallery");
  await prompt.getByRole("button", { name: "Done" }).click();
  await expect(phoneTiles(phone.page)).toHaveCount(2, { timeout: 30_000 });
  await expect(page.getByTestId("pair-transfer-title")).toHaveText("2 photos sent", { timeout: 30_000 });

  const stored = await storedOriginals(phone.page);
  for (const f of desk) expect(stored[f.name], f.name).toBe(sha(f.buffer));
  expect(phoneRequests.engine()).toEqual([]);
  expect(traffic()).toEqual([]);
  expect(relay.log.length).toBe(relayCalls);
  await phone.context.close();
});

test("decline adds nothing; a 51st photo and a 60 MB one are refused with the reason", async ({ browser, context, page }) => {
  const { phone } = await pairUp(browser, context, page);
  const dir = test.info().outputPath("picks");
  mkdirSync(dir, { recursive: true });
  // The 60 MB file is made here, never committed. Its size refuses it, so its
  // bytes (zeros) are never read.
  const huge = join(dir, "huge.png");
  writeFileSync(huge, Buffer.alloc(60 * 1024 * 1024));
  const tiny = Array.from({ length: 51 }, (_, i) => {
    const p = join(dir, `tiny-${i}.png`);
    writeFileSync(p, syntheticPng(8, 8, 100 + i));
    return p;
  });
  const before = Object.keys(await storedOriginals(page)).length;

  await phone.page.getByTestId("pair-send-input").setInputFiles([huge, ...tiny]);
  const sent = phone.page.getByTestId("pair-transfer");
  await expect(sent).toContainText("huge.png can't go: 60.0 MB, over the 50 MB limit for one photo.", { timeout: 30_000 });
  await expect(sent).toContainText("tiny-50.png can't go: over the 50 photos you can send at once.");

  const dialog = page.getByTestId("pair-transfer");
  await expect(page.getByTestId("pair-transfer-title")).toHaveText(/^Android phone wants to send 50 photos \(\d+ KB\)$/, { timeout: 30_000 });
  // Demo galleries hold 12, and this one has 1.
  await expect(dialog).toContainText("Your gallery has room for 11 more, so 39 won't fit.");
  await expect(dialog.getByRole("button", { name: "Accept 11" })).toBeVisible();
  await dialog.getByRole("button", { name: "Decline" }).click();

  await expect(page.getByTestId("pair-transfer-title")).toHaveText("Declined. Nothing was added.");
  await expect(phone.page.getByTestId("pair-transfer-title")).toHaveText("Your computer declined. Nothing was sent.", { timeout: 30_000 });
  await expect(galleryTiles(page)).toHaveCount(1);
  expect(Object.keys(await storedOriginals(page)).length).toBe(before);
  await phone.context.close();
});

test("a gallery 1 short of its limit takes 1 of 3 and says 2 didn't fit", async ({ browser, context, page }) => {
  const filler = Array.from({ length: 10 }, (_, i) => png(`fill-${i}.png`, syntheticPng(16, 16, 200 + i)));
  const { phone } = await pairUp(browser, context, page, { computerFiles: [CHECKER, ...filler] });
  const files = [1, 2, 3].map((i) => png(`more-${i}.png`, syntheticPng(32, 32, 300 + i)));

  await phone.page.getByTestId("pair-send-input").setInputFiles(files);
  const dialog = page.getByTestId("pair-transfer");
  await expect(dialog).toContainText("Your gallery has room for 1 more, so 2 won't fit.", { timeout: 30_000 });
  await dialog.getByRole("button", { name: "Accept 1" }).click();

  await expect(dialog).toHaveAttribute("data-outcome", "done", { timeout: 60_000 });
  await expect(page.getByTestId("pair-transfer-title")).toHaveText("1 photo added to your gallery");
  await expect(dialog).toContainText("2 didn't fit: the gallery is full.");
  await expect(galleryTiles(page)).toHaveCount(12);
  await expect(phone.page.getByTestId("pair-transfer-title")).toHaveText("1 of 3 sent", { timeout: 30_000 });
  await expect(phone.page.getByTestId("pair-transfer")).toContainText("2 didn't fit: your computer's gallery is full.");
  const stored = await storedOriginals(page);
  expect(stored["more-1.png"]).toBe(sha(files[0]!.buffer));
  expect(stored["more-2.png"]).toBeUndefined();
  await phone.context.close();
});

// The day log's number: 10 photos, 40 MB, phone → computer, from Accept to the
// 10th tile in the computer's gallery, three runs. Off in the suite; run with
// PAIR_TIMING=1. Each run is a fresh pair of contexts.
test("timing: 10 photos / 40 MB, phone → computer", async ({ browser }) => {
  test.skip(!process.env.PAIR_TIMING, "set PAIR_TIMING=1");
  test.setTimeout(900_000);
  // 1000 × 1332 RGB noise, stored uncompressed: ~4.0 MB each.
  const photos = Array.from({ length: 10 }, (_, i) => png(`t-${i}.png`, syntheticPng(1000, 1332, 400 + i, true)));
  const bytes = photos.reduce((n, p) => n + p.buffer.length, 0);
  const runs: number[] = [];
  for (let run = 0; run < 3; run++) {
    const context = await browser.newContext({ viewport: DESKTOP, baseURL: test.info().project.use.baseURL });
    const page = await context.newPage();
    const { phone } = await pairUp(browser, context, page);
    await phone.page.getByTestId("pair-send-input").setInputFiles(photos);
    const dialog = page.getByTestId("pair-transfer");
    const accept = dialog.getByRole("button", { name: "Accept", exact: true });
    await expect(accept).toBeVisible({ timeout: 120_000 });
    // Clocked inside the page: the Accept click, and the frame the 10th new
    // tile (11 with the checker) is in the gallery.
    await page.evaluate(() => {
      const w = window as unknown as { __pairT: { accept?: number; last?: number } };
      w.__pairT = {};
      document.addEventListener(
        "click",
        (e) => {
          if ((e.target as HTMLElement).closest("button")?.textContent?.trim() === "Accept") w.__pairT.accept = performance.now();
        },
        true,
      );
      const tick = () => {
        if (document.querySelectorAll('[aria-label^="Select photo"]').length >= 11) {
          w.__pairT.last = performance.now();
          return;
        }
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    await accept.click();
    await expect(galleryTiles(page)).toHaveCount(11, { timeout: 600_000 });
    await expect.poll(() => page.evaluate(() => (window as unknown as { __pairT: { last?: number } }).__pairT.last ?? 0)).toBeGreaterThan(0);
    const ms = await page.evaluate(() => {
      const t = (window as unknown as { __pairT: { accept: number; last: number } }).__pairT;
      return t.last - t.accept;
    });
    if (run === 0) {
      const stored = await storedOriginals(page);
      for (const p of photos) expect(stored[p.name], p.name).toBe(sha(p.buffer));
    }
    runs.push(ms);
    await phone.context.close();
    await context.close();
  }
  const sorted = [...runs].sort((a, b) => a - b);
  const median = sorted[1]!;
  const result = {
    photos: photos.length,
    bytes,
    runsMs: runs.map((r) => Math.round(r)),
    medianMs: Math.round(median),
    mbPerSecond: Number((bytes / 1e6 / (median / 1000)).toFixed(2)),
  };
  console.log(`PAIR_TIMING ${JSON.stringify(result)}`);
  writeFileSync(test.info().outputPath("timing.json"), JSON.stringify(result, null, 2));
  if (process.env.PAIR_TIMING_OUT) writeFileSync(process.env.PAIR_TIMING_OUT, JSON.stringify(result, null, 2));
});
