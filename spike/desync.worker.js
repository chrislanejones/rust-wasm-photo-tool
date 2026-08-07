// Reads back what the implementation actually settled on for `desynchronized`,
// for both shapes a worker migration could take:
//   transferred — the element's own buffer, moved in (Option A)
//   standalone  — a worker-owned buffer whose pixels get shipped back (Option B)
self.onmessage = (e) => {
  const attrs = (cv) => {
    const ctx = cv.getContext("2d", { desynchronized: true });
    return ctx.getContextAttributes ? ctx.getContextAttributes().desynchronized : "no getContextAttributes";
  };
  self.postMessage({
    transferred: attrs(e.data.canvas),
    standalone: attrs(new OffscreenCanvas(64, 64)),
  });
};
