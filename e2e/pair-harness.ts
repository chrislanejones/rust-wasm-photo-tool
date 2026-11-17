// Shared harness for the pairing specs (ADR-105): pair-connection.spec.ts,
// pair-send.spec.ts and phone-no-engine.spec.ts.
//
// WHAT STANDS IN FOR CONVEX. e2e has no live backend (e2e/guard). Each context
// gets `window.__ihPairRelay` (exposeBinding), a fake signaling server that
// lives in the TEST process and keeps the rules the client depends on: one
// join, null once gone. The app uses it instead of Convex when it is present
// (features/pair/signaling.ts). The server's own rules — caps, expiry, a used
// key looking like a wrong one — are pinned by convex/pairSessions.test.ts.
//
// WHAT IS REAL. Both pages' RTCPeerConnections, the offer and answer, the
// HMACs, the trickled candidates, the data channel, and (pair-send) every
// photo byte over it. No STUN: the relay hands the pages no ICE servers, and
// they find each other on host candidates. Chrome's mDNS masking of those is
// switched off by the specs (`PAIR_LAUNCH`), because two contexts in one
// headless browser cannot resolve each other's `.local` names here. So none
// of this covers STUN, NAT traversal, or two real devices on two networks.
import { deflateSync, crc32 } from "node:zlib";
import { readFileSync } from "node:fs";
import { basename, join } from "node:path";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { expect, test } from "./guard/test";

export const PAIR_LAUNCH = { launchOptions: { args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] } };

export const CHECKER = join(__dirname, "fixtures", "checker.png");
export const DESKTOP = { width: 1280, height: 800 };
export const PHONE = { width: 390, height: 844 };
/** An Android phone's user agent, so the phone's label is a real one. */
const ANDROID_UA =
  "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36";

interface Row {
  offer: string;
  offerMac: string;
  answer?: string;
  answerMac?: string;
  joined: boolean;
  computerCandidates: string[];
  phoneCandidates: string[];
}

/** The fake signaling server, shared by both contexts. */
export class Relay {
  rows = new Map<string, Row>();
  log: string[] = [];
  closed: string[] = [];
  /** Swap one character of the offer's DTLS fingerprint on its way to the phone. */
  tamperOffer = false;

  handle(op: string, args: Record<string, unknown>): unknown {
    this.log.push(`${op} ${JSON.stringify(args)}`);
    const key = args.keyHash as string;
    const row = this.rows.get(key);
    switch (op) {
      case "create":
        this.rows.set(key, {
          offer: args.offer as string,
          offerMac: args.offerMac as string,
          joined: false,
          computerCandidates: [],
          phoneCandidates: [],
        });
        return { ok: true, expiresAt: Date.now() + 5 * 60_000 };
      case "readOffer": {
        if (!row || row.joined) return null;
        const offer = this.tamperOffer
          ? row.offer.replace(/(a=fingerprint:sha-256 )([0-9A-F])/, (_m, p: string, c: string) => p + (c === "A" ? "B" : "A"))
          : row.offer;
        return { offer, offerMac: row.offerMac };
      }
      case "join":
        if (!row || row.joined) return { ok: false, reason: "unavailable" };
        Object.assign(row, { joined: true, answer: args.answer, answerMac: args.answerMac });
        return { ok: true };
      case "addCandidates": {
        if (!row || (args.side === "phone" && !row.joined)) return { ok: false, reason: "unavailable" };
        const list = args.side === "computer" ? row.computerCandidates : row.phoneCandidates;
        list.push(...(args.candidates as string[]));
        return { ok: true, accepted: (args.candidates as string[]).length };
      }
      case "watch":
        return row
          ? {
              joined: row.joined,
              answer: row.answer,
              answerMac: row.answerMac,
              computerCandidates: row.computerCandidates,
              phoneCandidates: row.phoneCandidates,
              expiresAt: 0,
            }
          : null;
      case "close":
        if (row) this.closed.push(key);
        this.rows.delete(key);
        return null;
    }
    throw new Error(`unknown op ${op}`);
  }
}

/** Offline and deterministic: nothing leaves localhost. */
export async function offline(context: BrowserContext) {
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

export async function wire(context: BrowserContext, relay: Relay, theme: "light" | "dark") {
  await offline(context);
  await context.exposeBinding("__ihPairRelay", (_source, op: string, args: Record<string, unknown>) => relay.handle(op, args));
  await context.addInitScript((t) => localStorage.setItem("image-horse-prefs", JSON.stringify({ theme: t })), theme);
}

/** Every request a page makes, and the engine's among them. */
export function watchRequests(page: Page) {
  const all: string[] = [];
  page.on("request", (r) => all.push(r.url()));
  return { all, engine: () => all.filter((u) => /stamp_tool|\.wasm(\?|$)/.test(u)) };
}

export type Upload = string | { name: string; mimeType: string; buffer: Buffer };

/** The computer: the editor with photos in it, so the gallery (and its Pair a
 *  phone button) is on screen. */
export async function openComputer(page: Page, files: Upload[] = [CHECKER]) {
  await page.setViewportSize(DESKTOP);
  await page.goto("/?beta=pair");
  // Playwright takes paths OR payloads in one call, not both: a mix is made
  // all payloads.
  const mixed = files.some((f) => typeof f !== "string");
  const list = mixed
    ? files.map((f) => (typeof f === "string" ? { name: basename(f), mimeType: "image/png", buffer: readFileSync(f) } : f))
    : (files as string[]);
  await page.locator('input[type="file"]').first().setInputFiles(list);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.getByTestId("pair-button")).toBeVisible({ timeout: 30_000 });
  await expect(galleryTiles(page)).toHaveCount(files.length, { timeout: 60_000 });
}

/** The computer's gallery tiles. */
export const galleryTiles = (page: Page) => page.locator('[aria-label^="Select photo"]');
/** The phone's grid tiles. */
export const phoneTiles = (page: Page) => page.getByRole("button", { name: /^View photo / });

export async function turnOnlineOn(page: Page) {
  await page.evaluate(() => {
    window.location.hash = "#/settings/security";
  });
  await page.getByRole("radio", { name: "Online features" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

export async function phoneContext(
  browser: Browser,
  relay: Relay,
  theme: "light" | "dark",
  opts: { userAgent?: string } = {},
) {
  const context = await browser.newContext({ viewport: PHONE, baseURL: test.info().project.use.baseURL, ...opts });
  await wire(context, relay, theme);
  const page = await context.newPage();
  return { context, page };
}

export interface Paired {
  relay: Relay;
  phone: { context: BrowserContext; page: Page };
  phoneRequests: ReturnType<typeof watchRequests>;
  secret: string;
}

/** A computer and a phone, paired and both showing Connected. The computer's
 *  Pair a phone dialog is closed again (the connection stays). */
export async function pairUp(
  browser: Browser,
  context: BrowserContext,
  page: Page,
  opts: { theme?: "light" | "dark"; computerFiles?: Upload[]; userAgent?: string } = {},
): Promise<Paired> {
  const theme = opts.theme ?? "dark";
  const relay = new Relay();
  await wire(context, relay, theme);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await openComputer(page, opts.computerFiles);
  await turnOnlineOn(page);
  await page.getByTestId("pair-button").click();
  await expect(page.getByTestId("pair-qr")).toBeVisible({ timeout: 15_000 });
  await page.getByRole("button", { name: "Copy link" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());
  const secret = link.split("#/pair/")[1]!;

  const phone = await phoneContext(browser, relay, theme, { userAgent: opts.userAgent ?? ANDROID_UA });
  const phoneRequests = watchRequests(phone.page);
  await phone.page.goto(link);
  await phone.page.getByRole("button", { name: "Got it" }).click({ timeout: 30_000 });
  const card = phone.page.getByTestId("pair-phone");
  await card.getByRole("switch").click();
  await expect(card).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  await expect(page.getByTestId("pair-status")).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
  await page.keyboard.press("Escape");
  await expect(page.getByTestId("pair-dialog")).toHaveCount(0);
  return { relay, phone, phoneRequests, secret };
}

/** SHA-256 hex of every original this page's IndexedDB holds, by file name. */
export async function storedOriginals(page: Page): Promise<Record<string, string>> {
  return page.evaluate(async () => {
    const db: IDBDatabase = await new Promise((res, rej) => {
      const r = indexedDB.open("image-horse-dexie");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    const recs: { name: string; blob: Blob }[] = await new Promise((res, rej) => {
      const r = db.transaction("originals").objectStore("originals").getAll();
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
    db.close();
    const out: Record<string, string> = {};
    for (const rec of recs) {
      const d = await crypto.subtle.digest("SHA-256", await rec.blob.arrayBuffer());
      out[rec.name] = [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, "0")).join("");
    }
    return out;
  });
}

/**
 * A synthetic RGB PNG, made here rather than committed. `seed` changes the
 * pixels, so no two share a content hash (the originals store dedupes
 * identical bytes). `noise` fills it with pseudo-random pixels stored
 * uncompressed, so its size is predictable: about w × h × 3 bytes.
 */
export function syntheticPng(w: number, h: number, seed: number, noise = false): Buffer {
  const row = 1 + w * 3;
  const raw = Buffer.alloc(row * h);
  let s = (seed * 2654435761) >>> 0 || 1;
  for (let y = 0; y < h; y++) {
    const o = y * row;
    for (let x = 0; x < w; x++) {
      const p = o + 1 + x * 3;
      if (noise) {
        s ^= s << 13;
        s >>>= 0;
        s ^= s >>> 17;
        s ^= s << 5;
        s >>>= 0;
        raw[p] = s & 0xff;
        raw[p + 1] = (s >>> 8) & 0xff;
        raw[p + 2] = (s >>> 16) & 0xff;
      } else {
        raw[p] = Math.floor((x * 255) / w);
        raw[p + 1] = Math.floor((y * 255) / h);
        raw[p + 2] = (seed * 53 + ((x >> 3) ^ (y >> 3)) * 17) & 0xff;
      }
    }
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length);
    const td = Buffer.concat([Buffer.from(type, "ascii"), data]);
    const crc = Buffer.alloc(4);
    crc.writeUInt32BE(crc32(td) >>> 0);
    return Buffer.concat([len, td, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: noise ? 0 : 6 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

export const png = (name: string, buffer: Buffer) => ({ name, mimeType: "image/png", buffer });
