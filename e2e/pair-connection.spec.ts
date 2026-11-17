import { test, expect } from "./guard/test";
import type { Browser, BrowserContext, Page } from "@playwright/test";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Pair a phone (ticket 242, ADR-105): a computer at 1280 and a phone at 390,
// in two separate browser contexts (separate storage, like two devices),
// connect over REAL WebRTC on this machine.
//
// WHAT STANDS IN FOR CONVEX. e2e has no live backend (e2e/guard). Each context
// gets `window.__ihPairRelay` (exposeBinding), a fake signaling server that
// lives in THIS test process and keeps the rules the client depends on: one
// join, null once gone. The app uses it instead of Convex when it is present
// (features/pair/signaling.ts). The server's own rules — caps, expiry, a used
// key looking like a wrong one — are pinned by convex/pairSessions.test.ts.
//
// WHAT IS REAL. Both pages' RTCPeerConnections, the offer and answer, the
// HMACs, the trickled candidates, the data channel opening. No STUN: the
// relay hands the pages no ICE servers, and they find each other on host
// candidates. Chrome's mDNS masking of those is switched off for this file,
// because two contexts in one headless browser cannot resolve each other's
// `.local` names here. So this does NOT cover STUN, NAT traversal, or two
// real devices on two networks.
// ─────────────────────────────────────────────────────────────────────────────

test.use({ launchOptions: { args: ["--disable-features=WebRtcHideLocalIpsWithMdns"] } });

const FIXTURE = join(__dirname, "fixtures", "checker.png");
const DESKTOP = { width: 1280, height: 800 };
const PHONE = { width: 390, height: 844 };
const SHOTS = process.env.PAIR_SHOTS_DIR;

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
class Relay {
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
async function offline(context: BrowserContext) {
  await context.route("**/*", (route) => {
    const url = route.request().url();
    if (/^https?:\/\/(localhost|127\.0\.0\.1)[:/]/.test(url) || url.startsWith("blob:") || url.startsWith("data:")) {
      return route.continue();
    }
    return route.abort();
  });
}

async function wire(context: BrowserContext, relay: Relay, theme: "light" | "dark") {
  await offline(context);
  await context.exposeBinding("__ihPairRelay", (_source, op: string, args: Record<string, unknown>) => relay.handle(op, args));
  await context.addInitScript((t) => localStorage.setItem("image-horse-prefs", JSON.stringify({ theme: t })), theme);
}

/** Every request a page makes, and the engine's among them. */
function watchRequests(page: Page) {
  const all: string[] = [];
  page.on("request", (r) => all.push(r.url()));
  return { all, engine: () => all.filter((u) => /stamp_tool|\.wasm(\?|$)/.test(u)) };
}

/** The computer: the editor with one photo, so the gallery (and its Pair a
 *  phone button) is on screen. */
async function openComputer(page: Page) {
  await page.setViewportSize(DESKTOP);
  await page.goto("/?beta=pair");
  await page.locator('input[type="file"]').first().setInputFiles([FIXTURE]);
  await page.locator("canvas.main-canvas").waitFor({ state: "visible", timeout: 60_000 });
  await expect(page.getByTestId("pair-button")).toBeVisible({ timeout: 30_000 });
}

async function turnOnlineOn(page: Page) {
  await page.evaluate(() => {
    window.location.hash = "#/settings/security";
  });
  await page.getByRole("radio", { name: "Online features" }).click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
}

async function phoneContext(browser: Browser, relay: Relay, theme: "light" | "dark") {
  const context = await browser.newContext({ viewport: PHONE, baseURL: test.info().project.use.baseURL });
  await wire(context, relay, theme);
  const page = await context.newPage();
  return { context, page };
}

const THEMES: ("light" | "dark")[] = SHOTS ? ["light", "dark"] : ["dark"];

for (const theme of THEMES) {
  test(`a computer at 1280 and a phone at 390 pair over real WebRTC, the phone never loads the engine (${theme})`, async ({
    browser,
    context,
    page,
  }) => {
    const relay = new Relay();
    await wire(context, relay, theme);
    await context.grantPermissions(["clipboard-read", "clipboard-write"]);
    await openComputer(page);

    // The online switch is off by default: pairing is off, and says why.
    await page.getByTestId("pair-button").click();
    await expect(page.getByTestId("pair-off")).toContainText("Pairing is off while everything stays in your browser");
    await expect(page.getByTestId("pair-qr")).toHaveCount(0);
    expect(relay.log).toEqual([]);
    await page.keyboard.press("Escape");

    await turnOnlineOn(page);
    await page.getByTestId("pair-button").click();
    await expect(page.getByTestId("pair-qr")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("pair-countdown")).toHaveText(/^Expires in [45]:\d\d$/);
    if (SHOTS) {
      mkdirSync(SHOTS, { recursive: true });
      await page.getByTestId("pair-dialog").screenshot({ path: join(SHOTS, `pair-qr-dialog-1280-${theme}.png`) });
    }

    // Copy link: the same link the QR holds.
    await page.getByRole("button", { name: "Copy link" }).click();
    const link = await page.evaluate(() => navigator.clipboard.readText());
    const base = test.info().project.use.baseURL!;
    expect(link).toMatch(new RegExp(`^${base}/#/pair/[A-Za-z0-9_-]{22}$`));
    const secret = link.split("#/pair/")[1]!;

    // The phone opens it. Its own switch is off too, and it offers it.
    const phone = await phoneContext(browser, relay, theme);
    const requests = watchRequests(phone.page);
    await phone.page.goto(link);
    await phone.page.getByRole("button", { name: "Got it" }).click({ timeout: 30_000 });
    const card = phone.page.getByTestId("pair-phone");
    await expect(card).toHaveAttribute("data-status", "online-off");
    // The secret left the address bar before anything could read it.
    expect(phone.page.url()).not.toContain(secret);
    await card.getByRole("switch").click();

    await expect(card).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
    await expect(card.getByRole("heading", { name: "Connected" })).toBeVisible();
    await expect(page.getByTestId("pair-status")).toHaveAttribute("data-status", "connected", { timeout: 30_000 });
    await expect(page.getByTestId("pair-status")).toContainText("Connected");

    // Once connected, the row is deleted, and the server never saw the secret.
    expect(relay.rows.size).toBe(0);
    expect(relay.closed).toHaveLength(1);
    expect(relay.log.join("\n")).not.toContain(secret);
    expect(relay.log.some((l) => l.startsWith("join "))).toBe(true);
    // No request carried it, and the phone never asked for the engine.
    expect(requests.all.filter((u) => u.includes(secret))).toEqual([]);
    expect(requests.engine()).toEqual([]);

    if (SHOTS) {
      await phone.page.screenshot({ path: join(SHOTS, `pair-phone-connected-390-${theme}.png`) });
    }
    await phone.context.close();
  });
}

test("a tampered offer is refused on the phone, before it answers", async ({ browser, context, page }) => {
  const relay = new Relay();
  relay.tamperOffer = true;
  await wire(context, relay, "dark");
  await openComputer(page);
  await turnOnlineOn(page);
  await page.getByTestId("pair-button").click();
  await expect(page.getByTestId("pair-qr")).toBeVisible({ timeout: 15_000 });
  const key = [...relay.rows.keys()][0]!;
  const offer = relay.rows.get(key)!.offer;
  // The real offer carries a fingerprint for the tamper to change.
  expect(offer).toMatch(/a=fingerprint:sha-256 [0-9A-F]/);

  // The link is not on the page as text; Copy link is the way to it.
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.getByRole("button", { name: "Copy link" }).click();
  const link = await page.evaluate(() => navigator.clipboard.readText());

  const phone = await phoneContext(browser, relay, "dark");
  await phone.page.goto(link);
  await phone.page.getByRole("button", { name: "Got it" }).click({ timeout: 30_000 });
  const card = phone.page.getByTestId("pair-phone");
  await card.getByRole("switch").click();
  await expect(card).toHaveAttribute("data-status", "tampered", { timeout: 15_000 });
  await expect(card).toContainText("This connection couldn't be verified");
  // It never joined: the computer is still waiting, the door still open.
  expect(relay.log.some((l) => l.startsWith("join "))).toBe(false);
  expect(relay.rows.get(key)!.joined).toBe(false);
  await expect(page.getByTestId("pair-status")).toHaveAttribute("data-status", "waiting");
  await phone.context.close();
});
