import { test, expect } from "@playwright/test";
import type { Page } from "@playwright/test";
import { writeFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
interface Probe { broken: boolean; status: string; cursor: number; ops: number; undo: number; hash: string; }
async function exposeEngine(page: Page): Promise<void> {
  const found = () => page.evaluate(() => {
    const root = document.querySelector("#root") as unknown as Record<string, unknown>;
    const key = Object.keys(root).find((k) => k.startsWith("__reactContainer"))!;
    type Fiber = { child?: Fiber; sibling?: Fiber; memoizedState?: unknown };
    const isTool = (v: unknown) =>
      !!v && typeof (v as { add_layer_mask_from?: unknown }).add_layer_mask_from === "function";
    let tool: unknown = null;
    const walk = (f: Fiber | undefined, d: number) => {
      if (!f || tool || d > 600) return;
      let s = f.memoizedState as { memoizedState?: unknown; next?: unknown } | null;
      while (s && !tool) {
        const v = s.memoizedState as { current?: unknown } | undefined;
        if (isTool(v)) tool = v;
        else if (v && isTool(v.current)) tool = v.current;
        s = s.next as typeof s;
      }
      walk(f.child, d + 1);
      walk(f.sibling, d + 1);
    };
    walk(root[key] as Fiber, 0);
    (window as unknown as { __ihTool: unknown }).__ihTool = tool;
    return !!tool;
  });
  await expect.poll(found, { message: "engine handle reachable", timeout: 30_000 }).toBe(true);
}

async function probe(page: Page): Promise<Probe> {
  return page.evaluate(async () => {
    type T = {
      oplog_is_broken: () => Promise<boolean>;
      oplog_status: () => Promise<string>;
      oplog_cursor: () => Promise<number>;
      oplog_op_count: () => Promise<number>;
      undo_count: () => Promise<number>;
      composite_hash_hex: () => Promise<string>;
    };
    const t = (window as unknown as { __ihTool: T }).__ihTool;
    return {
      broken: await t.oplog_is_broken(),
      status: await t.oplog_status(),
      cursor: await t.oplog_cursor(),
      ops: await t.oplog_op_count(),
      undo: await t.undo_count(),
      hash: await t.composite_hash_hex(),
    };
  });
}


test("capture shipped v13 preset", async ({ page }) => {
 await page.route("**/*", route => {
  const u = route.request().url();
  return u.startsWith("https://edit.imagehorse.app/") || u.startsWith("blob:") || u.startsWith("data:") ? route.continue() : route.abort();
 });
 const info = await (await page.request.get("https://edit.imagehorse.app/build-info.json")).json();
 expect(info.commit).toBe("d486fd4bac01cb4a24589a95ad008dfbe79c1b26");
 await page.goto("https://edit.imagehorse.app/");
 await page.locator('input[type="file"]').first().setInputFiles("e2e/fixtures/checker.png");
 await exposeEngine(page);
 await page.getByRole("button", { name: "Enhance", exact: true }).first().click();
 await page.getByRole("button", { name: "Presets", exact: true }).first().click();
 await page.getByRole("button", { name: /^Apply Vivid —/ }).first().click();
 await expect.poll(async()=> (await probe(page)).ops).toBe(1);
 const after = await probe(page);
 await page.waitForTimeout(6000);
 const saved = await page.evaluate(async () => {
  const db = await new Promise<IDBDatabase>((resolve, reject) => {const r=indexedDB.open("image-horse-dexie");r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const all = (s:string)=>new Promise<any[]>((resolve,reject)=>{const r=db.transaction(s).objectStore(s).getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const chunks=await all("opLogs"), bases=await all("keyframes"), manifests=await all("oplogManifests");
  db.close();
  const base=bases.find(b=>b.atOp===0), chunk=chunks[0];
  return { frames:Array.from(chunk.bytes as Uint8Array), annotations:Array.from(base.annotations as Uint8Array), png:Array.from(new Uint8Array(await base.blob.arrayBuffer())), width:base.width, height:base.height, manifest:manifests[0] };
 });
 expect(saved.frames[4]).toBe(13);expect(saved.frames[5]).toBe(23);
 const dir="tests/fixtures/oplog";
 mkdirSync(dir,{recursive:true});
 const hashes:Record<string,string>={};
 for(const [name,bytes] of Object.entries({"v13-preset.frames.bin":saved.frames,"v13-preset.annotations.bin":saved.annotations,"v13-preset.base.png":saved.png})){
  const b=Buffer.from(bytes);writeFileSync(dir+"/"+name,b);hashes[name]=createHash("sha256").update(b).digest("hex");
 }
 writeFileSync(dir+"/v13-preset.json",JSON.stringify({source:"https://edit.imagehorse.app/",commit:"d486fd4bac01cb4a24589a95ad008dfbe79c1b26",capturedAt:new Date().toISOString(),method:"Browse checker.png → Enhance → Presets → Vivid; raw IndexedDB after autosave",width:saved.width,height:saved.height,cursor:1,compositeHash:after.hash,sha256:hashes},null,2)+"\n");
 console.log("captured v13",after, saved.width,saved.height);
});
