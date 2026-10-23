// Builds the screenshot-compare fixtures (Night 10-23). Real browser
// screenshots of one small settings screen, rendered twice: B moves the Save
// button 24 px right, changes the "Draft" label to "Published" and recolors
// the bell icon. Run once and commit the PNGs:
//   node e2e/fixtures/compare/make-fixtures.mjs
// known.json holds the ground truth the spec checks boxes against: per
// change, the bounding box of every pixel that differs at all between a.png
// and b.png inside that element's old-or-new rectangle.
import { chromium } from "@playwright/test";
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const page = (b) => `<!doctype html><html><head><style>
  body { margin: 0; font: 15px/1.4 system-ui, sans-serif; background: #f6f7f9; color: #1f2933; }
  .top { height: 52px; background: #1f2430; color: #fff; display: flex; align-items: center; padding: 0 20px; gap: 12px; }
  .top b { font-size: 17px; }
  .card { position: absolute; left: 40px; top: 90px; width: 600px; background: #fff; border: 1px solid #d9dde3; border-radius: 8px; padding: 20px 24px; }
  .row { display: flex; gap: 12px; align-items: center; margin: 10px 0; }
  .row span { width: 120px; color: #52606d; }
  .field { flex: 1; height: 30px; border: 1px solid #c5cbd3; border-radius: 4px; padding: 0 8px; line-height: 30px; }
  #status { display: inline-block; padding: 2px 10px; border-radius: 10px; background: #eef2f6; }
  #save { position: absolute; left: ${b ? 64 : 40}px; top: 380px; padding: 9px 22px; background: #2563eb; color: #fff; border-radius: 6px; font-weight: 600; }
  #bell { position: absolute; left: 860px; top: 12px; }
  p { color: #52606d; margin: 6px 0; }
</style></head><body>
  <div class="top"><b>Acme Admin</b><span>Projects</span><span>Reports</span><span>Settings</span>
    <svg id="bell" width="28" height="28" viewBox="0 0 24 24"><path fill="${b ? "#10b981" : "#f59e0b"}" d="M12 22a2.5 2.5 0 0 0 2.4-2h-4.8A2.5 2.5 0 0 0 12 22Zm7-6V11a7 7 0 0 0-5.5-6.8V3a1.5 1.5 0 0 0-3 0v1.2A7 7 0 0 0 5 11v5l-2 2v1h18v-1Z"/></svg></div>
  <div class="card">
    <div class="row"><span>Project name</span><div class="field">Harbor redesign</div></div>
    <div class="row"><span>Owner</span><div class="field">Sam Rivera</div></div>
    <div class="row"><span>Status</span><div><span id="status">${b ? "Published" : "Draft"}</span></div></div>
    <p>Changes are saved to every teammate's view as soon as you press Save.</p>
    <p>Older versions stay in History for thirty days.</p>
  </div>
  <div id="save">Save</div>
</body></html>`;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const rects = {};
for (const b of [false, true]) {
  await p.setContent(page(b));
  await p.evaluate(() => document.fonts.ready);
  for (const id of ["save", "status", "bell"]) {
    const r = await p.locator(`#${id}`).boundingBox();
    (rects[id] ??= []).push(r);
  }
  await p.screenshot({ path: join(here, b ? "b.png" : "a.png") });
  if (!b) await p.screenshot({ path: join(here, "a-resave.jpg"), type: "jpeg", quality: 85 });
}
await browser.close();

// Same pixels, different bytes, so the gallery holds two photos.
execFileSync("python3", ["-I", "-c", `
from PIL import Image
import sys
d = sys.argv[1]
Image.open(d + "/a.png").save(d + "/a-copy.png", compress_level=1)
Image.open(d + "/b.png").crop((0, 0, 800, 500)).save(d + "/b-crop.png")
`, here]);

// Ground truth: every differing pixel inside each element's old ∪ new box.
const truth = execFileSync("python3", ["-I", "-c", `
from PIL import Image, ImageChops
import json, sys
d, rects = sys.argv[1], json.loads(sys.argv[2])
a = Image.open(d + "/a.png").convert("RGBA"); b = Image.open(d + "/b.png").convert("RGBA")
diff = ImageChops.difference(a, b).convert("L").point(lambda v: 255 if v > 0 else 0)
out = {}
for k, (r0, r1) in rects.items():
    x0 = int(min(r0["x"], r1["x"])) - 4; y0 = int(min(r0["y"], r1["y"])) - 4
    x1 = int(max(r0["x"] + r0["width"], r1["x"] + r1["width"])) + 4
    y1 = int(max(r0["y"] + r0["height"], r1["y"] + r1["height"])) + 4
    bb = diff.crop((x0, y0, x1, y1)).getbbox()
    out[k] = [x0 + bb[0], y0 + bb[1], bb[2] - bb[0], bb[3] - bb[1]]
print(json.dumps(out))
`, here, JSON.stringify(rects)], { encoding: "utf8" });
writeFileSync(join(here, "known.json"), JSON.stringify(JSON.parse(truth), null, 2) + "\n");
console.log(truth.trim());
