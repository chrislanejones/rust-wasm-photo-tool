// Image Horse — clean A/B Compare view.
//
// Paste into Chrome DevTools › Sources › Snippets, then run it (Ctrl+Enter)
// on edit.imagehorse.app (or a local build) with a photo loaded.
//
// It turns Compare on, puts the divider at POSITION of the photo's width, and
// hides everything on the page except the canvas and the Original / Edited
// overlay, so screenshots can be taken at any zoom.
//
//   Zoom while it is on:  Alt + =  /  Alt + -  /  Alt + 0 (reset)  /  Alt + scroll
//   Turn it off:          Esc, or run the snippet again
//
// Nothing is changed in the app: it is one <style> tag and a data attribute,
// and turning it off removes both. Compare itself stays on.

(() => {
  const POSITION = 0.75;     // 0 = all Edited, 1 = all Original
  const KEEP_LABELS = true;  // false hides the "Original" / "Edited" chips
  const BACKDROP = "#111";   // page color behind the photo

  const STYLE_ID = "ih-compare-clean";
  const KEEP = "data-ih-keep";

  if (window.__ihCompareClean) {
    window.__ihCompareClean.off();
    return;
  }

  const findOverlay = () =>
    [...document.querySelectorAll("div.cursor-col-resize")].find((el) =>
      [...el.children].some((c) => c.style.backgroundImage.startsWith("url(")),
    ) || null;

  // The canvas the overlay sits over: same positioned parent, biggest overlap.
  const findCanvas = (overlay) => {
    const o = overlay.getBoundingClientRect();
    let best = null;
    let bestArea = 0;
    for (const c of overlay.parentElement.querySelectorAll("canvas")) {
      const r = c.getBoundingClientRect();
      const w = Math.min(o.right, r.right) - Math.max(o.left, r.left);
      const h = Math.min(o.bottom, r.bottom) - Math.max(o.top, r.top);
      const area = w > 0 && h > 0 ? w * h : 0;
      if (area > bestArea) {
        bestArea = area;
        best = c;
      }
    }
    return best;
  };

  // The divider position lives in a React store with no handle on window, so
  // set it the way a person would: one click at that point of the overlay.
  const setPosition = (overlay) => {
    const r = overlay.getBoundingClientRect();
    const init = {
      bubbles: true,
      cancelable: true,
      composed: true,
      pointerId: 1,
      pointerType: "mouse",
      isPrimary: true,
      button: 0,
      buttons: 1,
      clientX: r.left + r.width * POSITION,
      clientY: r.top + r.height / 2,
    };
    overlay.dispatchEvent(new PointerEvent("pointerdown", init));
    overlay.dispatchEvent(new PointerEvent("pointerup", { ...init, buttons: 0 }));
  };

  const tag = () => {
    const overlay = findOverlay();
    if (!overlay) return false;
    const canvas = findCanvas(overlay);
    if (!overlay.hasAttribute(KEEP)) overlay.setAttribute(KEEP, "");
    if (canvas && !canvas.hasAttribute(KEEP)) canvas.setAttribute(KEEP, "");
    return true;
  };

  const css = `
    html, body { background: ${BACKDROP} !important; }
    body * { visibility: hidden !important; }
    [${KEEP}], [${KEEP}] * { visibility: visible !important; }
    ${KEEP_LABELS ? "" : `div[${KEEP}].cursor-col-resize > div.top-3 { visibility: hidden !important; }`}
  `;

  const waitFor = (fn, ms = 3000) =>
    new Promise((resolve) => {
      const t0 = performance.now();
      const tick = () => {
        const v = fn();
        if (v || performance.now() - t0 > ms) resolve(v);
        else requestAnimationFrame(tick);
      };
      tick();
    });

  (async () => {
    if (!findOverlay()) {
      const btn = document.querySelector('button[aria-label="Compare"]');
      if (!btn) return console.warn("[ih] No Compare button on this page.");
      if (btn.disabled)
        return console.warn(
          "[ih] Compare is disabled: load a photo first (it does not work in Batch).",
        );
      btn.click();
    }
    const overlay = await waitFor(findOverlay);
    if (!overlay) return console.warn("[ih] The Compare overlay never appeared.");

    setPosition(overlay);

    const style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = css;
    document.head.appendChild(style);
    tag();

    // Zoom can re-render the overlay; re-tag whatever is there now.
    const mo = new MutationObserver(() => tag());
    mo.observe(document.body, { childList: true, subtree: true });

    const onKey = (e) => {
      if (e.key === "Escape") off();
    };
    window.addEventListener("keydown", onKey, true);

    function off() {
      mo.disconnect();
      window.removeEventListener("keydown", onKey, true);
      document.getElementById(STYLE_ID)?.remove();
      document.querySelectorAll(`[${KEEP}]`).forEach((el) => el.removeAttribute(KEEP));
      delete window.__ihCompareClean;
      console.log("[ih] Clean compare view OFF.");
    }

    window.__ihCompareClean = { off };
    console.log(
      `[ih] Clean compare view ON, divider at ${POSITION * 100}%. Alt+= / Alt+- to zoom, Esc to exit.`,
    );
  })();
})();
