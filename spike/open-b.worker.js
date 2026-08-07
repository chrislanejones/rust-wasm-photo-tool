// OPEN-B worker — owns the transferred canvas, exactly as Option A would.
//
// Mirrors what useEngineCore.flushToCanvas does today, minus the engine: take a
// 2d context with `desynchronized: true` (the app already uses that on every
// main-canvas context), size the backing store, draw, and be the only writer.
let canvas = null;
let ctx = null;

function paint() {
  const { width: w, height: h } = canvas;
  ctx.fillStyle = "#1e3a8a";
  ctx.fillRect(0, 0, w, h);
  // corner markers, so a wrong crop or a stale size is visible as well as measurable
  ctx.fillStyle = "#f97316";
  const m = Math.round(Math.min(w, h) * 0.05);
  for (const [x, y] of [[0, 0], [w - m, 0], [0, h - m], [w - m, h - m]]) ctx.fillRect(x, y, m, m);
  // a grid, so scaling artefacts are legible
  ctx.strokeStyle = "rgba(255,255,255,0.35)";
  ctx.lineWidth = 2;
  for (let x = 0; x <= w; x += Math.round(w / 8)) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
  for (let y = 0; y <= h; y += Math.round(h / 6)) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
}

self.onmessage = (e) => {
  const d = e.data;
  switch (d.type) {
    case "init":
      canvas = d.canvas;
      // `desynchronized: true` matches every main-canvas getContext in the app.
      ctx = canvas.getContext("2d", { desynchronized: true });
      canvas.width = d.w;
      canvas.height = d.h;
      break;

    case "draw":
      paint();
      self.postMessage({ type: "draw:done", w: canvas.width, h: canvas.height });
      break;

    case "resize":
      // The assignment the main thread can no longer make. This is the concrete
      // work item ADR-024 names: useEngineCore's `canvas.width = w` lines move
      // into the worker as messages.
      canvas.width = d.w;
      canvas.height = d.h;
      paint();
      self.postMessage({ type: "resize:done", w: canvas.width, h: canvas.height });
      break;

    case "probe": {
      const px = ctx.getImageData(10, 10, 1, 1).data;
      self.postMessage({
        type: "probe:done",
        px: `rgba(${px[0]},${px[1]},${px[2]},${px[3]})`,
        // (10,10) lands inside the top-left orange marker at any size tested
        ok: px[3] === 255 && px[0] > 200 && px[1] > 80 && px[2] < 80,
      });
      break;
    }
  }
};
