import { afterEach, describe, expect, it, vi } from "vitest";
import {
  NAME_TOKENS,
  expandNameTokens,
  extOf,
  patternNeedsNameFacts,
  sanitizeTokenValue,
  supportedNameTokens,
  type NameTokenInput,
} from "./nameTokens";

const photo = (over: Partial<NameTokenInput> = {}): NameTokenInput => ({
  name: "beach",
  original: "IMG_4021",
  n: "01",
  width: 4032,
  height: 3024,
  ext: "jpg",
  dateTaken: "2024-05-01 10:30",
  ...over,
});

describe("expandNameTokens — one token at a time", () => {
  it("{name} is the current name", () => {
    expect(expandNameTokens("{name}", photo())).toBe("beach");
  });

  it("{original} is the name it was uploaded with, not the current one", () => {
    expect(expandNameTokens("{original}", photo())).toBe("IMG_4021");
  });

  it("{original} falls back to the current name when the upload name is unknown", () => {
    expect(expandNameTokens("{original}", photo({ original: undefined }))).toBe("beach");
  });

  it("{n} is the sequence number exactly as the caller padded it", () => {
    expect(expandNameTokens("{n}", photo({ n: "007" }))).toBe("007");
  });

  it("{date} defaults to ISO YYYY-MM-DD", () => {
    expect(expandNameTokens("{date}", photo())).toBe("2024-05-01");
  });

  it("{date:FORMAT} builds from YYYY, MM, DD, HH and mm", () => {
    expect(expandNameTokens("{date:YYYY-MM-DD}", photo())).toBe("2024-05-01");
    expect(expandNameTokens("{date:YYYYMMDD-HHmm}", photo())).toBe("20240501-1030");
    expect(expandNameTokens("{date:DD.MM.YYYY}", photo())).toBe("01.05.2024");
    expect(expandNameTokens("{date:YYYY}", photo())).toBe("2024");
  });

  it("{date:} with an empty format is the default format", () => {
    expect(expandNameTokens("{date:}", photo())).toBe("2024-05-01");
  });

  it("{width} and {height} are pixels", () => {
    expect(expandNameTokens("{width}x{height}", photo())).toBe("4032x3024");
  });

  it("{ext} is the file type without the dot", () => {
    expect(expandNameTokens("{name}-{ext}", photo({ ext: "webp" }))).toBe("beach-webp");
  });

  it("mixes tokens and literal text", () => {
    expect(expandNameTokens("{date}_{original}_{n}", photo())).toBe("2024-05-01_IMG_4021_01");
  });

  it("leaves unknown tokens, and a plain token given a format, as typed", () => {
    expect(expandNameTokens("{nope}-{name:X}", photo())).toBe("{nope}-{name:X}");
  });

  it("takes extra tokens from the caller (the AI Rename words, the recipe's {w}/{h})", () => {
    expect(expandNameTokens("{color}-{n}", photo(), { color: "blue" })).toBe("blue-01");
  });
});

describe("{date} fallback: EXIF, then the file's date, then today", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("an EXIF date wins over the file's date", () => {
    const fileDate = new Date(2023, 6, 4, 9, 5).getTime();
    expect(expandNameTokens("{date}", photo({ fileDate }))).toBe("2024-05-01");
  });

  it("no EXIF date falls back to the file's date, in local time", () => {
    const fileDate = new Date(2023, 6, 4, 9, 5).getTime();
    const p = photo({ dateTaken: undefined, fileDate });
    expect(expandNameTokens("{date}", p)).toBe("2023-07-04");
    expect(expandNameTokens("{date:HHmm}", p)).toBe("0905");
  });

  it("an unset camera clock (0000:00:00) is no date, so the file's date is used", () => {
    const fileDate = new Date(2023, 6, 4, 9, 5).getTime();
    expect(expandNameTokens("{date}", photo({ dateTaken: "0000-00-00 00:00", fileDate }))).toBe(
      "2023-07-04",
    );
  });

  it("an unreadable EXIF date falls back to the file's date", () => {
    const fileDate = new Date(2023, 6, 4, 9, 5).getTime();
    expect(expandNameTokens("{date}", photo({ dateTaken: "sometime in May", fileDate }))).toBe(
      "2023-07-04",
    );
  });

  it("no EXIF date and no file date is today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 15, 8, 42));
    const p = photo({ dateTaken: undefined, fileDate: undefined });
    expect(expandNameTokens("{date}", p)).toBe("2026-11-15");
    expect(expandNameTokens("{date:HHmm}", p)).toBe("0842");
  });

  it("a zero or broken file date is no date either, so it is today", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 15, 8, 42));
    expect(expandNameTokens("{date}", photo({ dateTaken: undefined, fileDate: 0 }))).toBe(
      "2026-11-15",
    );
    expect(expandNameTokens("{date}", photo({ dateTaken: undefined, fileDate: NaN }))).toBe(
      "2026-11-15",
    );
  });
});

describe("characters a file name cannot hold", () => {
  it("strips / \\ : * ? \" < > | and control characters from a value", () => {
    expect(sanitizeTokenValue('a/b\\c:d*e?f"g<h>i|j\u0000k\u001fl\u007fm')).toBe("abcdefghijklm");
  });

  it("EXIF's own colon date (2024:05:01 10:30:00) never puts a colon in a name", () => {
    const p = photo({ dateTaken: "2024:05:01 10:30:00" });
    expect(expandNameTokens("{date}", p)).toBe("2024-05-01");
    expect(expandNameTokens("{date:HH:mm}", p)).toBe("1030");
  });

  it("an EXIF date written with slashes and a control byte comes out clean", () => {
    // A camera that writes its date with slashes, plus a stray control byte.
    const p = photo({ dateTaken: "2024/05/01 10/30\u0001" });
    expect(expandNameTokens("{date}", p)).toBe("2024-05-01");
    // A slash typed into the format is inside the token's value, so it goes too.
    expect(expandNameTokens("{date:YYYY/MM/DD}", p)).toBe("20240501");
  });

  it("a file-derived {original} is stripped too", () => {
    expect(expandNameTokens("{original}", photo({ original: 'trip: day "1"?' }))).toBe(
      "trip day 1",
    );
  });

  it("leaves the text the person typed alone; the caller's own pass decides", () => {
    expect(expandNameTokens("a:b-{n}", photo())).toBe("a:b-01");
  });
});

describe("extOf", () => {
  it("reads the name's extension, lowercased, without the dot", () => {
    expect(extOf("IMG_4021.JPG", "image/png")).toBe("jpg");
  });

  it("falls back to the file type when the name has no extension", () => {
    expect(extOf("beach", "image/jpeg")).toBe("jpg");
    expect(extOf("beach", "image/webp")).toBe("webp");
  });

  it("is empty when neither says", () => {
    expect(extOf("beach", "")).toBe("");
  });
});

describe("patternNeedsNameFacts", () => {
  it("is true only for the tokens that read the stored file", () => {
    expect(patternNeedsNameFacts("{name}-{n}-{width}")).toBe(false);
    expect(patternNeedsNameFacts("{date}")).toBe(true);
    expect(patternNeedsNameFacts("{date:YYYY}")).toBe(true);
    expect(patternNeedsNameFacts("{original}")).toBe(true);
  });
});

// The Rename panel, AI Rename and the Export recipe help all render from
// NAME_TOKENS, and the expander substitutes from its own table. This keeps the
// two equal: add a token to one side only and this fails.
describe("name token drift guard", () => {
  it("documents exactly the tokens the expander honors", () => {
    const documented = NAME_TOKENS.map((t) => t.token).sort();
    expect(documented).toEqual(supportedNameTokens().sort());
  });

  it("covers every token this feature added", () => {
    const documented = NAME_TOKENS.map((t) => t.token);
    for (const t of ["{date}", "{date:FORMAT}", "{width}", "{height}", "{ext}", "{original}"]) {
      expect(documented).toContain(t);
    }
  });

  it("every documented token actually substitutes", () => {
    for (const { token } of NAME_TOKENS) {
      const typed = token.replace(":FORMAT", ":YYYY");
      const out = expandNameTokens(typed, photo());
      expect(out, `${token} was left unexpanded`).not.toContain("{");
    }
  });

  it("every token has a hint", () => {
    for (const { token, hint } of NAME_TOKENS) {
      expect(hint.length, `${token} has no hint`).toBeGreaterThan(0);
    }
  });
});
