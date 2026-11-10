import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { api, internal } from "./_generated/api";
import type { Id } from "./_generated/dataModel";
import { checkImageUrl, senderLabel, sniffImage } from "./mcpImage";
import { MCP_TOOLS } from "./mcpTools";
import { TRANSFER_INBOX_LIMIT } from "./transfers";
import { addUser, callTool, newBackend, rawPost, setupMcp, signToken, type Backend, type Keys } from "./mcp.testkit";

const MiB = 1024 * 1024;
const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 13]);
const b64 = (bytes: Uint8Array) => btoa(String.fromCharCode(...bytes));

let keys: Keys;
let remote: (url: string, init?: RequestInit) => Response | undefined;
beforeEach(async () => {
  remote = () => undefined;
  keys = await setupMcp(async (url, init) => remote(url, init));
});
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

const asA = () => signToken(keys.pair, { sub: "user_a" });
const asB = () => signToken(keys.pair, { sub: "user_b" });

const addFile = (t: Backend, bytes = 10) => t.run((ctx) => ctx.storage.store(new Blob([new Uint8Array(bytes)])));
async function addShare(t: Backend, userId: Id<"users">, token: string, fields: Record<string, unknown> = {}) {
  const storageId = await addFile(t);
  return t.run((ctx) => ctx.db.insert("shares", { token, userId, storageId, canvasW: 1, canvasH: 1, views: 3, createdAt: Date.now(), ...fields }));
}
async function addTransfer(t: Backend, userId: Id<"users">, name = "a.png") {
  const storageId = await addFile(t);
  return t.run((ctx) => ctx.db.insert("transfers", { userId, storageId, name, mime: "image/png", bytes: 10, fromDevice: "Phone", createdAt: Date.now(), expiresAt: Date.now() + 86_400_000 }));
}
const addPrefs = (t: Backend, userId: Id<"users">, value: unknown, format = 2, rev = 4) =>
  t.run((ctx) => ctx.db.insert("sync_docs", { userId, key: "prefs", value: value === null ? null : JSON.stringify(value), rev, updatedAt: 1, format }));
const shareRow = (t: Backend, id: Id<"shares">) => t.run((ctx) => ctx.db.get(id));

/** One legal call for every tool, so each is exercised and each is refused. */
const SAMPLE: Record<string, Record<string, unknown>> = {
  pause_share: { token: "x" }, resume_share: { token: "x" }, set_share_limits: { token: "x", max_views: 5 },
  delete_share: { token: "x" }, restore_share: { token: "x" },
  add_palette_colors: { colors: ["#112233"] }, remove_palette_color: { color: "#112233" },
  save_export_recipe: { name: "r", size: { fit: "keep" }, format: "png", quality: 90 },
  send_image_to_inbox: { image_base64: b64(PNG) }, remove_from_inbox: { id: "x" },
};

describe("tools/list", () => {
  it("has the 21 tools, marked correctly, each saying what it can't do", async () => {
    const t = newBackend();
    await addUser(t, "user_a");
    const res = await rawPost(t, await asA(), { jsonrpc: "2.0", id: 2, method: "tools/list", params: {} });
    const tools = ((await res.json()) as any).result.tools as { name: string; description: string; annotations: any }[];
    expect(tools).toHaveLength(21);

    const destructive = tools.filter((x) => x.annotations.destructiveHint).map((x) => x.name).sort();
    expect(destructive).toEqual(["delete_share", "remove_from_inbox"]);
    const writes = ["pause_share", "resume_share", "set_share_limits", "delete_share", "restore_share", "add_palette_colors", "remove_palette_color", "save_export_recipe", "send_image_to_inbox", "remove_from_inbox"];
    for (const x of tools) {
      expect(x.annotations.readOnlyHint, x.name).toBe(!writes.includes(x.name));
      expect(x.description, x.name).toMatch(/gallery/);
    }
  });
  it("no tool has a user argument", () => {
    for (const tool of MCP_TOOLS) expect(Object.keys(tool.input).filter((k) => /user|owner|account/i.test(k)), tool.name).toEqual([]);
  });
  it("has the three prompts", async () => {
    const t = newBackend();
    await addUser(t, "user_a");
    const res = await rawPost(t, await asA(), { jsonrpc: "2.0", id: 2, method: "prompts/list", params: {} });
    expect(((await res.json()) as any).result.prompts).toHaveLength(3);
  });
});

describe("kill switch", () => {
  it.each(MCP_TOOLS.map((x) => x.name))("%s refuses when access is off, and changes nothing", async (name) => {
    const t = newBackend();
    const a = await addUser(t, "user_a", { mcpEnabled: false });
    await addShare(t, a, "x");
    const r = await callTool(t, await asA(), name, SAMPLE[name] ?? {});
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/AI access is off/);
    expect((await t.run((ctx) => ctx.db.query("shares").first()))).toMatchObject({ views: 3 });
    expect((await t.run((ctx) => ctx.db.query("shares").first()))!.pausedAt).toBeUndefined();
    expect((await t.run((ctx) => ctx.db.query("shares").first()))!.deletedAt).toBeUndefined();
    expect(await t.run((ctx) => ctx.db.query("transfers").collect())).toHaveLength(0);
  });
});

describe("switched off between admit and the write", () => {
  it("the write still refuses, inside its own transaction", async () => {
    const t = newBackend();
    const a = await addUser(t, "user_a", { mcpEnabled: false });
    const id = await addShare(t, a, "s");
    await expect(t.mutation(internal.mcpData.pauseShare, { userId: a, token: "s" })).rejects.toThrow(/AI access is off/);
    expect((await shareRow(t, id))!.pausedAt).toBeUndefined();
  });
  it("an image already uploaded is deleted, not stranded", async () => {
    const t = newBackend();
    const a = await addUser(t, "user_a", { mcpEnabled: false });
    const storageId = await addFile(t);
    expect(await t.mutation(internal.mcpData.receiveImage, { userId: a, storageId, name: "a.png", from: "AI app" })).toMatchObject({ ok: false });
    expect(await t.run((ctx) => ctx.db.system.get(storageId))).toBeNull();
  });
});

describe("isolation: user A's token against user B's things", () => {
  async function world() {
    const t = newBackend();
    await addUser(t, "user_a");
    const b = await addUser(t, "user_b");
    const share = await addShare(t, b, "bs-token", { title: "B's secret" });
    const trashed = await addShare(t, b, "bs-trashed", { deletedAt: Date.now() });
    const transfer = await addTransfer(t, b, "bs-photo.png");
    await t.run(async (ctx) => {
      await ctx.db.insert("user_colors", { userId: b, color: "#abcdef", createdAt: 1 });
      await ctx.db.insert("recent_texts", { userId: b, text: "B's text", fontSize: 1, fontWeight: "normal", textColor: "#000", usedAt: 1 });
    });
    await addPrefs(t, b, { exportRecipes: [{ id: "1", name: "B's recipe" }] });
    return { t, b, share, trashed, transfer, token: await asA() };
  }

  it.each(["pause_share", "resume_share", "delete_share"])("%s: not found, and B's link is untouched", async (name) => {
    const { t, share, token } = await world();
    const r = await callTool(t, token, name, { token: "bs-token" });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/No share link/);
    const row = await shareRow(t, share);
    expect(row!.pausedAt).toBeUndefined();
    expect(row!.deletedAt).toBeUndefined();
  });
  it("set_share_limits: not found", async () => {
    const { t, share, token } = await world();
    expect((await callTool(t, token, "set_share_limits", { token: "bs-token", max_views: 1 })).text).toMatch(/No share link/);
    expect((await shareRow(t, share))!.maxViews).toBeUndefined();
  });
  it("restore_share: not found, and B's stays trashed", async () => {
    const { t, trashed, token } = await world();
    expect((await callTool(t, token, "restore_share", { token: "bs-trashed" })).text).toMatch(/No share link/);
    expect((await shareRow(t, trashed))!.deletedAt).toBeDefined();
  });
  it("remove_from_inbox: not found, and B's stays", async () => {
    const { t, transfer, token } = await world();
    expect((await callTool(t, token, "remove_from_inbox", { id: transfer })).text).toMatch(/Nothing with that id/);
    expect(await t.run((ctx) => ctx.db.get(transfer))).not.toBeNull();
  });
  it("the same message for B's token as for one that doesn't exist", async () => {
    const { t, token } = await world();
    expect((await callTool(t, token, "pause_share", { token: "bs-token" })).text).toBe((await callTool(t, token, "pause_share", { token: "nope" })).text);
  });
  it.each(["list_shares", "list_trash", "list_palette", "list_recent_text_styles", "list_export_recipes", "list_inbox"])("%s shows none of B's", async (name) => {
    const { t, token } = await world();
    const r = await callTool(t, token, name);
    expect(r.isError).toBe(false);
    expect(r.text).not.toMatch(/bs-|B's|abcdef/);
  });
  it("A's palette write doesn't touch B's", async () => {
    const { t, b, token } = await world();
    await callTool(t, token, "add_palette_colors", { colors: ["#112233"] });
    await callTool(t, token, "remove_palette_color", { color: "#abcdef" });
    expect((await t.run((ctx) => ctx.db.query("user_colors").collect())).filter((c) => c.userId === b).map((c) => c.color)).toEqual(["#abcdef"]);
  });
});

describe("each tool does its job", () => {
  async function me() {
    const t = newBackend();
    const a = await addUser(t, "user_a");
    return { t, a, token: await asA() };
  }

  it("get_connection_status", async () => {
    const { t, token } = await me();
    expect((await callTool(t, token, "get_connection_status")).data).toMatchObject({ account_access: "on", this_client: "client_1" });
  });
  it("get_account", async () => {
    const { t, token } = await me();
    expect((await callTool(t, token, "get_account")).data).toMatchObject({ tier: "free", storage_allowed_mib: 100, ai_uses_left_today: 0 });
  });
  it("get_storage reads the counter and breaks it down", async () => {
    const { t, a, token } = await me();
    await addShare(t, a, "live");
    await addShare(t, a, "gone", { deletedAt: Date.now() });
    await addTransfer(t, a);
    await t.run((ctx) => ctx.db.insert("storage_usage", { userId: a, bytes: 30, updatedAt: 1 }));
    expect((await callTool(t, token, "get_storage")).data).toMatchObject({
      used_bytes: 30, allowed_bytes: 100 * MiB, breakdown_bytes: { shares: 10, trash: 10, transfers: 10, backups: 0 },
    });
  });
  it("list_shares pages newest first and hides the trash", async () => {
    const { t, a, token } = await me();
    await addShare(t, a, "old", { createdAt: 1 });
    await addShare(t, a, "new", { createdAt: 2 });
    await addShare(t, a, "bin", { createdAt: 3, deletedAt: 5 });
    const first = (await callTool(t, token, "list_shares", { limit: 1 })).data;
    expect(first).toMatchObject({ total: 2, next_offset: 1 });
    expect(first.shares[0]).toMatchObject({ token: "new", link: "https://edit.imagehorse.app/?v=new" });
    expect((await callTool(t, token, "list_shares", { limit: 1, offset: 1 })).data).toMatchObject({ next_offset: null, shares: [{ token: "old" }] });
  });
  it("pause then resume", async () => {
    const { t, a, token } = await me();
    const id = await addShare(t, a, "s");
    await callTool(t, token, "pause_share", { token: "s" });
    expect((await shareRow(t, id))!.pausedAt).toBeDefined();
    await callTool(t, token, "resume_share", { token: "s" });
    expect((await shareRow(t, id))!.pausedAt).toBeUndefined();
  });
  it("set_share_limits sets, keeps what's left out, and clears on null", async () => {
    const { t, a, token } = await me();
    const id = await addShare(t, a, "s");
    await callTool(t, token, "set_share_limits", { token: "s", max_views: 5, expires_at: "2030-01-02T00:00:00Z" });
    await callTool(t, token, "set_share_limits", { token: "s", max_views: 9 });
    expect(await shareRow(t, id)).toMatchObject({ maxViews: 9, expiresAt: Date.parse("2030-01-02T00:00:00Z") });
    await callTool(t, token, "set_share_limits", { token: "s", expires_at: null });
    expect((await shareRow(t, id))!.expiresAt).toBeUndefined();
  });
  it("set_share_limits refuses a bad value and a bad date, and logs an error", async () => {
    const { t, a, token } = await me();
    await addShare(t, a, "s");
    expect((await callTool(t, token, "set_share_limits", { token: "s", max_views: 0 })).text).toMatch(/whole number/);
    expect((await callTool(t, token, "set_share_limits", { token: "s", expires_at: "soon" })).text).toMatch(/ISO/);
    expect((await t.run((ctx) => ctx.db.query("mcp_calls").collect())).map((c) => c.outcome)).toEqual(["error", "error"]);
  });
  it("delete_share goes to the trash, the app stops listing it, restore brings it back", async () => {
    const { t, a, token } = await me();
    const id = await addShare(t, a, "s");
    expect((await callTool(t, token, "delete_share", { token: "s" })).data).toMatchObject({ moved_to_trash: true });
    expect(await shareRow(t, id)).not.toBeNull();
    expect(await t.query(api.shares.get, { token: "s" })).toBeNull();
    expect((await callTool(t, token, "list_trash")).data.items).toMatchObject([{ token: "s" }]);
    await callTool(t, token, "restore_share", { token: "s" });
    expect((await shareRow(t, id))!.deletedAt).toBeUndefined();
    expect((await callTool(t, token, "restore_share", { token: "s" })).text).toMatch(/isn't in the trash/);
  });
  it("palette: add normalizes and dedupes, a bad color is refused, remove works", async () => {
    const { t, token } = await me();
    expect((await callTool(t, token, "add_palette_colors", { colors: ["#1F6FEB", "#1f6feb"] })).data.colors).toEqual(["#1f6feb"]);
    expect((await callTool(t, token, "add_palette_colors", { colors: ["blue"] })).isError).toBe(true);
    expect((await callTool(t, token, "list_palette")).data.colors).toEqual(["#1f6feb"]);
    expect((await callTool(t, token, "remove_palette_color", { color: "#1F6FEB" })).data.colors).toEqual([]);
  });
  it("list_recent_text_styles", async () => {
    const { t, a, token } = await me();
    await t.run((ctx) => ctx.db.insert("recent_texts", { userId: a, text: "Hi", fontSize: 12, fontWeight: "bold", textColor: "#000", usedAt: 1 }));
    expect((await callTool(t, token, "list_recent_text_styles")).data.styles).toMatchObject([{ text: "Hi", font_size: 12 }]);
  });
  it("get_backup_summary is totals only", async () => {
    const { t, a, token } = await me();
    const storageId = await addFile(t, 40);
    await t.run((ctx) => ctx.db.insert("photo_edits", { userId: a, photoKey: "secret-key", storageId, canvasW: 1, canvasH: 1, updatedAt: 1 }));
    const r = await callTool(t, token, "get_backup_summary");
    expect(r.data).toEqual({ backups: 1, total_bytes: 40 });
  });
  it("list_ai_usage", async () => {
    const { t, a, token } = await me();
    await t.run((ctx) => ctx.db.patch(a, { tier: "pro", dailyUsage: 3, usageResetAt: Date.now() }));
    expect((await callTool(t, token, "list_ai_usage")).data).toMatchObject({ today: { used: 3, cap: 50 } });
  });
  it("list_inbox and remove_from_inbox", async () => {
    const { t, a, token } = await me();
    const id = await addTransfer(t, a);
    expect((await callTool(t, token, "list_inbox")).data.items).toMatchObject([{ id, name: "a.png", from: "Phone" }]);
    expect((await callTool(t, token, "remove_from_inbox", { id: "not-an-id" })).isError).toBe(true);
    expect((await callTool(t, token, "remove_from_inbox", { id })).data).toEqual({ removed: true });
    expect(await t.run((ctx) => ctx.db.query("transfers").collect())).toHaveLength(0);
  });

  describe("export recipes", () => {
    const recipe = { name: "Web", size: { fit: "long", size: 1600 }, format: "webp", quality: 80 };

    it("adds one, keeps every other preference, and moves the revision", async () => {
      const { t, a, token } = await me();
      await addPrefs(t, a, { theme: "dark", grid: { on: true }, exportRecipes: [{ id: "1", name: "Old" }] });
      expect((await callTool(t, token, "save_export_recipe", recipe)).data).toEqual({ saved: "Web", total: 2 });
      const row = await t.run((ctx) => ctx.db.query("sync_docs").first());
      expect(row).toMatchObject({ rev: 5, format: 2 });
      const value = JSON.parse(row!.value!);
      expect(value).toMatchObject({ theme: "dark", grid: { on: true } });
      expect(value.exportRecipes.map((r: { name: string }) => r.name)).toEqual(["Old", "Web"]);
      expect(value.exportRecipes[1]).toMatchObject({ pattern: "{name}", id: expect.stringMatching(/^recipe-/) });
    });
    it("replaces by name and keeps the id", async () => {
      const { t, a, token } = await me();
      await addPrefs(t, a, { exportRecipes: [{ id: "keep", name: "Web", quality: 1 }] });
      await callTool(t, token, "save_export_recipe", recipe);
      expect((await callTool(t, token, "list_export_recipes")).data.recipes).toMatchObject([{ id: "keep", name: "Web", quality: 80 }]);
    });
    it("a format-1 row becomes format 2, so old builds can't drop the recipe", async () => {
      const { t, a, token } = await me();
      await addPrefs(t, a, { theme: "dark" }, 1);
      await callTool(t, token, "save_export_recipe", recipe);
      expect(await t.run((ctx) => ctx.db.query("sync_docs").first())).toMatchObject({ format: 2 });
    });
    it.each([["no row", undefined], ["a forgotten row", null]])("%s: refused, nothing written", async (_n, value) => {
      const { t, a, token } = await me();
      if (value === null) await addPrefs(t, a, null, 0);
      expect((await callTool(t, token, "save_export_recipe", recipe)).text).toMatch(/preferences are synced/);
      const rows = await t.run((ctx) => ctx.db.query("sync_docs").collect());
      expect(rows.filter((r) => r.value !== null)).toHaveLength(0);
    });
    it("the 21st new recipe is refused", async () => {
      const { t, a, token } = await me();
      await addPrefs(t, a, { exportRecipes: Array.from({ length: 20 }, (_, i) => ({ id: String(i), name: `r${i}` })) });
      expect((await callTool(t, token, "save_export_recipe", recipe)).text).toMatch(/20 saved recipes/);
    });
    it("a bad recipe is refused before it reaches the document", async () => {
      const { t, a, token } = await me();
      await addPrefs(t, a, {});
      expect((await callTool(t, token, "save_export_recipe", { ...recipe, format: "bmp" })).isError).toBe(true);
      expect((await callTool(t, token, "save_export_recipe", { ...recipe, size: { fit: "long", size: 99999 } })).isError).toBe(true);
    });
  });
});

describe("send_image_to_inbox", () => {
  async function me(fields: Record<string, unknown> = { mcpEnabled: true }) {
    const t = newBackend();
    const a = await addUser(t, "user_a", fields);
    return { t, a, token: await asA() };
  }
  const rows = (t: Backend) => t.run((ctx) => ctx.db.query("transfers").collect());
  const files = (t: Backend) => t.run((ctx) => ctx.db.system.query("_storage").collect());

  it("base64: lands in the inbox, labeled, and the counter moves", async () => {
    const { t, a, token } = await me();
    const r = await callTool(t, token, "send_image_to_inbox", { image_base64: b64(PNG), name: "logo", sender_name: "Claude" });
    expect(r.data).toMatchObject({ in_inbox: true, bytes: PNG.length });
    expect(await rows(t)).toMatchObject([{ name: "logo.png", mime: "image/png", bytes: PNG.length, fromDevice: "Claude (AI app)" }]);
    expect(await t.run((ctx) => ctx.db.query("storage_usage").withIndex("by_userId", (q) => q.eq("userId", a)).unique())).toMatchObject({ bytes: PNG.length });
    expect(((await t.query(api.transfers.listMine, {})))).toBeNull(); // no identity here: the owner-only read still holds
  });
  it("accepts a data: URL", async () => {
    const { t, token } = await me();
    expect((await callTool(t, token, "send_image_to_inbox", { image_base64: `data:image/png;base64,${b64(PNG)}` })).isError).toBe(false);
  });
  it("a misnamed file is stored as what it really is", async () => {
    const { t, token } = await me();
    await callTool(t, token, "send_image_to_inbox", { image_base64: b64(PNG), name: "photo.jpg" });
    expect(await rows(t)).toMatchObject([{ name: "photo.png", mime: "image/png" }]);
  });
  it("a non-image is refused, whatever it's named, and no file stays", async () => {
    const { t, token } = await me();
    const r = await callTool(t, token, "send_image_to_inbox", { image_base64: btoa("<html>hello there, friend</html>"), name: "x.png" });
    expect(r.text).toMatch(/isn't an image/);
    expect(await rows(t)).toHaveLength(0);
    expect(await files(t)).toHaveLength(0);
  });
  it("SVG is refused", async () => {
    const { t, token } = await me();
    expect((await callTool(t, token, "send_image_to_inbox", { image_base64: btoa("<svg xmlns='http://www.w3.org/2000/svg'/>") })).text).toMatch(/isn't an image/);
  });
  it("exactly one source", async () => {
    const { t, token } = await me();
    expect((await callTool(t, token, "send_image_to_inbox", {})).text).toMatch(/exactly one/);
    expect((await callTool(t, token, "send_image_to_inbox", { image_base64: b64(PNG), image_url: "https://a.example/x.png" })).text).toMatch(/exactly one/);
  });
  it("the 51st item is refused and its file is deleted", async () => {
    const { t, a, token } = await me();
    for (let i = 0; i < TRANSFER_INBOX_LIMIT; i++) await addTransfer(t, a, `${i}.png`);
    const before = (await files(t)).length;
    expect((await callTool(t, token, "send_image_to_inbox", { image_base64: b64(PNG) })).text).toMatch(/already has 50/);
    expect(await rows(t)).toHaveLength(TRANSFER_INBOX_LIMIT);
    expect(await files(t)).toHaveLength(before);
  });
  it("over quota is refused and its file is deleted", async () => {
    const { t, a, token } = await me();
    const big = await addFile(t, 100 * MiB - 2);
    await t.run((ctx) => ctx.db.insert("photo_edits", { userId: a, photoKey: "k", storageId: big, canvasW: 1, canvasH: 1, updatedAt: 1 }));
    expect((await callTool(t, token, "send_image_to_inbox", { image_base64: b64(PNG) })).text).toMatch(/Storage full/);
    expect(await files(t)).toHaveLength(1);
  });
  it("base64 too long says to use a URL", async () => {
    const { t, token } = await me();
    expect((await callTool(t, token, "send_image_to_inbox", { image_base64: "A".repeat(20 * MiB + 1) })).text).toMatch(/URL instead/);
  });

  describe("by URL", () => {
    const image = () => new Response(PNG);

    it("fetches a public https image", async () => {
      const { t, token } = await me();
      remote = (url) => (url === "https://cdn.example/a.png" ? image() : undefined);
      expect((await callTool(t, token, "send_image_to_inbox", { image_url: "https://cdn.example/a.png" })).isError).toBe(false);
      expect(await rows(t)).toHaveLength(1);
    });
    it("a redirect to a public host is followed", async () => {
      const { t, token } = await me();
      remote = (url) => (url === "https://a.example/x" ? new Response(null, { status: 302, headers: { location: "https://b.example/y" } }) : url === "https://b.example/y" ? image() : undefined);
      expect((await callTool(t, token, "send_image_to_inbox", { image_url: "https://a.example/x" })).isError).toBe(false);
    });
    it("a redirect to an internal address is refused and never fetched", async () => {
      const { t, token } = await me();
      const seen: string[] = [];
      remote = (url) => { seen.push(url); return url === "https://a.example/x" ? new Response(null, { status: 302, headers: { location: "https://169.254.169.254/latest/" } }) : image(); };
      expect((await callTool(t, token, "send_image_to_inbox", { image_url: "https://a.example/x" })).text).toMatch(/can't be fetched/);
      expect(seen).toEqual(["https://a.example/x"]);
    });
    it("too many redirects", async () => {
      const { t, token } = await me();
      remote = () => new Response(null, { status: 302, headers: { location: "https://a.example/again" } });
      expect((await callTool(t, token, "send_image_to_inbox", { image_url: "https://a.example/x" })).text).toMatch(/too many/);
    });
    it("an honest Content-Length over 20 MB is refused without reading", async () => {
      const { t, token } = await me();
      remote = () => new Response(PNG, { headers: { "content-length": String(21 * MiB) } });
      expect((await callTool(t, token, "send_image_to_inbox", { image_url: "https://a.example/x" })).text).toMatch(/20 MB/);
    });
    it("a lying Content-Length: the bytes are counted", async () => {
      const { t, token } = await me();
      const chunk = new Uint8Array(MiB);
      let sent = 0;
      remote = () => new Response(new ReadableStream({ pull(c) { if (sent++ > 30) c.close(); else c.enqueue(chunk); } }), { headers: { "content-length": "12" } });
      expect((await callTool(t, token, "send_image_to_inbox", { image_url: "https://a.example/x" })).text).toMatch(/20 MB/);
      expect(sent).toBeLessThan(25);
      expect(await files(t)).toHaveLength(0);
    });
    it("an error status and a network failure", async () => {
      const { t, token } = await me();
      remote = () => new Response("", { status: 404 });
      expect((await callTool(t, token, "send_image_to_inbox", { image_url: "https://a.example/x" })).text).toMatch(/404/);
      remote = () => { throw new Error("internal detail"); };
      const r = await callTool(t, token, "send_image_to_inbox", { image_url: "https://a.example/x" });
      expect(r.text).toMatch(/couldn't be fetched/);
      expect(r.text).not.toMatch(/internal detail/);
    });
  });

  it.each([
    "http://cdn.example/a.png", "file:///etc/passwd", "ftp://a.example/x", "https://localhost/x", "https://foo.localhost/x",
    "https://127.0.0.1/x", "https://2130706433/x", "https://0x7f.0.0.1/x", "https://10.0.0.5/x", "https://169.254.169.254/x",
    "https://[::1]/x", "https://[fd00::1]/x", "https://user:pw@a.example/x", "https://a.example:8443/x", "https://intranet/x",
    "https://db.internal/x", "https://printer.local/x", "https://localhost./x", "https://intranet./x",
    "https://printer.local./x", "not a url",
  ])("refuses %s", (url) => { expect(() => checkImageUrl(url)).toThrow(); });
  it("allows an ordinary https URL", () => { expect(checkImageUrl("https://cdn.example.com:443/a.png").hostname).toBe("cdn.example.com"); });

  it("recognizes each format by its bytes", () => {
    const bytes = (...parts: (string | number[])[]) => new Uint8Array(parts.flatMap((p) => (typeof p === "string" ? [...p].map((c) => c.charCodeAt(0)) : p)));
    expect(sniffImage(bytes([0xff, 0xd8, 0xff, 0xe0]))?.mime).toBe("image/jpeg");
    expect(sniffImage(PNG)?.mime).toBe("image/png");
    expect(sniffImage(bytes("GIF89a"))?.mime).toBe("image/gif");
    expect(sniffImage(bytes("RIFF", [0, 0, 0, 0], "WEBP"))?.mime).toBe("image/webp");
    expect(sniffImage(bytes([0, 0, 0, 28], "ftypavif"))?.mime).toBe("image/avif");
    expect(sniffImage(bytes([0, 0, 0, 28], "ftypheic"))?.mime).toBe("image/heic");
    expect(sniffImage(bytes([0, 0, 0, 28], "ftypisom"))).toBeNull();
  });
  it("a sender can't pose as a phone, and junk is stripped", () => {
    expect(senderLabel("iPhone")).toBe("iPhone (AI app)");
    expect(senderLabel(undefined)).toBe("AI app");
    expect(senderLabel("<b>Claude</b>")).toBe("bClaudeb (AI app)");
  });
});
