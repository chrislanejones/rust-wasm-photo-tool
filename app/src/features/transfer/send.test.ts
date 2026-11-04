// The phone side of Transfer as plain functions (ADR-102): the label, the
// upload type, the timeout, one file's send, and the result line.
import { describe, expect, it, vi } from "vitest";
import { deviceLabel, MAX_BYTES, resultLine, sendOne, uploadContentType, uploadTimeoutMs, type SendDeps } from "./send";

const IPHONE = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148";
const PIXEL = "Mozilla/5.0 (Linux; Android 15; Pixel 9) AppleWebKit/537.36 Chrome/130 Mobile Safari/537.36";
const TAB = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130 Safari/537.36";
const IPAD = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Version/18.0 Safari/605.1.15";

describe("deviceLabel", () => {
  it("names the five kinds the server keeps", () => {
    expect(deviceLabel(IPHONE)).toBe("iPhone");
    expect(deviceLabel(PIXEL)).toBe("Android phone");
    expect(deviceLabel(TAB)).toBe("Android tablet");
    expect(deviceLabel(IPAD, 5)).toBe("iPad"); // iPadOS says Macintosh; touch gives it away
    expect(deviceLabel(IPAD, 0)).toBe("Phone"); // a real Mac is not a phone either
    expect(deviceLabel("curl/8")).toBe("Phone");
  });
});

describe("uploadContentType", () => {
  it("is the file's own type, or the extension's when the browser gave none", () => {
    expect(uploadContentType({ name: "a.jpg", type: "image/jpeg" })).toBe("image/jpeg");
    expect(uploadContentType({ name: "IMG_1.HEIC", type: "" })).toBe("image/heic");
    expect(uploadContentType({ name: "mystery", type: "" })).toBe("application/octet-stream");
  });
});

describe("uploadTimeoutMs", () => {
  it("is a minute plus time at 100 KB/s, so a big photo on a slow signal is not cut off", () => {
    expect(uploadTimeoutMs(0)).toBe(60_000);
    expect(uploadTimeoutMs(30 * 1024 * 1024)).toBeGreaterThan(5 * 60_000);
  });
});

function deps(over: Partial<SendDeps> = {}) {
  const fetchFn = vi.fn(async () => new Response(JSON.stringify({ storageId: "st1" }), { status: 200 }));
  const d = {
    generateUploadUrl: vi.fn(async () => "https://upload.invalid/u"),
    create: vi.fn(async () => ({ ok: true as const, bytes: 3, expiresAt: 99 })),
    fetch: fetchFn as unknown as typeof fetch,
    ...over,
  };
  return d;
}

const photo = (name = "IMG_1.HEIC", bytes = 3, type = "") => new File([new Uint8Array(bytes)], name, { type });

describe("sendOne", () => {
  it("asks for a URL, uploads the file as is with its type, then creates", async () => {
    const d = deps();
    const out = await sendOne(photo(), "iPhone", d);
    expect(out).toEqual({ ok: true, bytes: 3, expiresAt: 99 });
    const [url, init] = (d.fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(url).toBe("https://upload.invalid/u");
    expect(init.headers).toEqual({ "Content-Type": "image/heic" });
    expect(init.body).toBeInstanceOf(File);
    expect(d.create).toHaveBeenCalledWith({ storageId: "st1", name: "IMG_1.HEIC", fromDevice: "iPhone" });
  });

  it("passes the server's refusal through, word for word", async () => {
    const d = deps({ create: vi.fn(async () => ({ ok: false as const, message: "Storage full: 12 MB left, and this photo is 20 MB." })) });
    expect(await sendOne(photo(), "Phone", d)).toEqual({ ok: false, message: "Storage full: 12 MB left, and this photo is 20 MB." });
  });

  it("refuses an over-50 MB file before any network call", async () => {
    const d = deps();
    const big = { name: "big.jpg", type: "image/jpeg", size: MAX_BYTES + 1 } as File;
    const out = await sendOne(big, "Phone", d);
    expect(out.ok).toBe(false);
    expect(d.generateUploadUrl).not.toHaveBeenCalled();
  });

  it("shows a ConvexError's own line (inbox full) from the URL step", async () => {
    const err = Object.assign(new Error("Server Error"), { data: "Your inbox already has 50 photos waiting." });
    const d = deps({ generateUploadUrl: vi.fn(async () => Promise.reject(err)) });
    expect(await sendOne(photo(), "Phone", d)).toEqual({ ok: false, message: "Your inbox already has 50 photos waiting." });
  });

  it("times out, aborts the upload, and says to try again", async () => {
    vi.useFakeTimers();
    let aborted = false;
    const hang = vi.fn((_u: string, init: RequestInit) => {
      init.signal!.addEventListener("abort", () => (aborted = true));
      return new Promise<Response>(() => {});
    });
    const d = deps({ fetch: hang as unknown as typeof fetch });
    const p = sendOne(photo(), "Phone", d);
    await vi.advanceTimersByTimeAsync(uploadTimeoutMs(3) + 1);
    expect(await p).toEqual({ ok: false, message: "Upload timed out. Try again." });
    expect(aborted).toBe(true);
    expect(d.create).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it("cancel aborts the upload in flight, and no row is made", async () => {
    const ctl = new AbortController();
    const hang = vi.fn(
      (_u: string, init: RequestInit) =>
        new Promise<Response>((_res, rej) => init.signal!.addEventListener("abort", () => rej(new Error("aborted")))),
    );
    const d = deps({ fetch: hang as unknown as typeof fetch });
    const p = sendOne(photo(), "Phone", d, ctl.signal);
    await Promise.resolve();
    await Promise.resolve();
    ctl.abort();
    expect(await p).toEqual({ ok: false, message: "Canceled.", canceled: true });
    expect(d.create).not.toHaveBeenCalled();
  });
});

describe("resultLine", () => {
  it("says how many went and how long they wait", () => {
    expect(resultLine(4, 4)).toBe("4 photos sent. They'll wait 7 days.");
    expect(resultLine(1, 1)).toBe("1 photo sent. It'll wait 7 days.");
    expect(resultLine(3, 4)).toBe("3 of 4 sent. They'll wait 7 days.");
    expect(resultLine(0, 2)).toBe("No photos were sent.");
  });
});
