import { describe, expect, it } from "vitest";
import { MAX_BYTES } from "@/features/transfer/send";
import {
  PAIR_BATCH_MAX,
  PAIR_FILE_MAX_BYTES,
  batchLine,
  checkPicked,
  ownLabel,
  peerLabel,
} from "./limits";

const pick = (name: string, size: number, type = "image/jpeg") => ({ name, size, type });

describe("pairing's limits", () => {
  it("are Transfer's 50 MB a photo, and 50 a batch", () => {
    expect(PAIR_FILE_MAX_BYTES).toBe(MAX_BYTES);
    expect(PAIR_FILE_MAX_BYTES).toBe(50 * 1024 * 1024);
    expect(PAIR_BATCH_MAX).toBe(50);
  });

  it("refuse a 60 MB photo with the reason, and send the rest", () => {
    const { send, refused } = checkPicked([pick("ok.jpg", 1000), pick("huge.jpg", 60 * 1024 * 1024)]);
    expect(send.map((f) => f.name)).toEqual(["ok.jpg"]);
    expect(refused).toEqual([{ name: "huge.jpg", reason: "60.0 MB, over the 50 MB limit for one photo" }]);
  });

  it("leave out the 51st photo, and say why", () => {
    const files = Array.from({ length: 51 }, (_, i) => pick(`p${i}.png`, 100, "image/png"));
    const { send, refused } = checkPicked(files);
    expect(send).toHaveLength(50);
    expect(refused).toEqual([{ name: "p50.png", reason: "over the 50 photos you can send at once" }]);
  });

  it("take only the image types Transfer takes, HEIC by its extension too", () => {
    const { send, refused } = checkPicked([
      pick("a.heic", 10, ""),
      pick("b.webp", 10, "image/webp"),
      pick("clip.mov", 10, "video/quicktime"),
      pick("notes.txt", 10, ""),
    ]);
    expect(send.map((f) => f.name)).toEqual(["a.heic", "b.webp"]);
    expect(refused.map((r) => r.name)).toEqual(["clip.mov", "notes.txt"]);
    expect(refused[0]!.reason).toBe("not a photo Image Horse can open");
  });

  it("refuse an empty file", () => {
    expect(checkPicked([pick("empty.png", 0, "image/png")]).refused[0]!.reason).toBe("empty");
  });
});

describe("device labels", () => {
  it("are a guess from the user agent, and a computer is just Computer", () => {
    const iphone = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)";
    const android = "Mozilla/5.0 (Linux; Android 15; Pixel 9) Mobile Safari/537.36";
    expect(ownLabel("phone", iphone)).toBe("iPhone");
    expect(ownLabel("phone", android)).toBe("Android phone");
    expect(ownLabel("computer", iphone)).toBe("Computer");
  });

  it("from the other side are kept only when they are one of ours", () => {
    expect(peerLabel("iPhone", "phone")).toBe("iPhone");
    expect(peerLabel("Android phone", "phone")).toBe("Android phone");
    expect(peerLabel("<img src=x>", "phone")).toBe("Phone");
    expect(peerLabel(42, "phone")).toBe("Phone");
    // A computer is a computer, whatever it claims.
    expect(peerLabel("iPhone", "computer")).toBe("Computer");
  });
});

describe("batchLine", () => {
  it("reads like the prompt", () => {
    expect(batchLine(4, 18 * 1024 * 1024)).toBe("4 photos (18 MB)");
    expect(batchLine(1, 300 * 1024)).toBe("1 photo (300 KB)");
    expect(batchLine(2, 2.5 * 1024 * 1024)).toBe("2 photos (2.5 MB)");
  });
});
