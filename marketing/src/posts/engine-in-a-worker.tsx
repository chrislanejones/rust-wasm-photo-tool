/* "The engine left the main thread. The pixels stayed put."
 *
 * Body only — the headline, the deck, the dateline and the footer are the
 * shell's (pages/BlogPost.tsx). This file starts at the first paragraph.
 *
 * Every figure in here is in the repository. The blocking times and the
 * round-trip numbers come from docs/engine-worker-feasibility.md and
 * docs/engine-worker-a11-0-finding.md; the invariant, the stage table and the
 * kill switch come from docs/adr/024-engine-in-a-worker.md. Nothing is
 * estimated, and nothing is rounded to sound better than it measured.
 *
 * The two outside citations — Surma's structured-clone benchmark and
 * whatwg/html#4601 — are the only claims here that did not come out of this
 * repository, and both are linked rather than summarised for that reason.
 *
 * Five figures. FIG 1, 2 and 4 are WebGL scenes and FIG 5 a DOM timeline,
 * all in engine-in-a-worker.figures.tsx; FIG 3 is the log-scale bar table
 * below, built from the data at the top of this file. The scenes load
 * three.js lazily and only on this page — see figures.tsx for the how.
 */

import type { CSSProperties } from "react";

import { external, repoFile } from "../config";
import { Queue, Scene } from "./engine-in-a-worker.figures";
import "./engine-in-a-worker.figures.css";

/* ── FIG 3's data ─────────────────────────────────────────────────────────
 * Bytes per postMessage, on a log scale, because a linear axis would render
 * the first three rows as nothing at all — a 4096² layer is a million times a
 * pointer event, and the whole point of the figure is that the small ones are
 * budgets and the big ones are pixels.
 *
 * The bar widths are DERIVED from `bytes`, never typed in. Hand-written
 * percentages are a second copy of the data that silently stops agreeing with
 * the first, and this figure's entire claim is the ratio between the rows.
 */
const SCALE_LO = 10; // log2(1 KiB)  — left edge of the axis
const SCALE_HI = 26; // log2(64 MiB) — right edge

interface Payload {
  label: string;
  /** Second line under the label — the shape of the thing, or its time budget. */
  note?: string;
  /** The ONE number. Bar width and the over-budget ratio both derive from it. */
  bytes: number;
  /** How the size is written for a reader. "7.9 MiB" beats 8,294,400. */
  size: string;
  /**
   * A budget row is a reference line, not a thing anyone sends.
   *
   * ⚠️ This field exists because deriving "over budget" from bytes alone got
   * it wrong, and the browser caught it: the 100 KiB interaction budget is ten
   * times the 10 KiB frame budget, so the arithmetic dutifully labelled a
   * REFERENCE LINE "10× over" and painted it as a violation. The ratio was
   * right and the sentence it made was false. Only a payload can exceed a
   * budget; a budget just sits there.
   */
  budget?: true;
}

const FRAME_BUDGET = 10 * 1024;

const PAYLOADS: Payload[] = [
  { label: "Pointer event", note: "{ tool, x, y, pressure }", bytes: 60, size: "~60 B" },
  { label: "Frame budget", note: "16 ms", bytes: FRAME_BUDGET, size: "10 KiB", budget: true },
  { label: "Interaction budget", note: "100 ms", bytes: 100 * 1024, size: "100 KiB", budget: true },
  { label: "1920×1080 RGBA frame", bytes: 1920 * 1080 * 4, size: "7.9 MiB" },
  { label: "4096×4096 RGBA layer", bytes: 4096 * 4096 * 4, size: "64 MiB" },
];

/** Position on the log axis, 0–100. Clamped at the low end: a pointer event is
 *  60 bytes, which sits BELOW the 1 KiB left edge and computes to −25%. It is
 *  drawn as a visible sliver instead of a negative bar, because "smaller than
 *  the axis can show" is the true reading and an invisible bar is not. */
const widthOf = (bytes: number) =>
  Math.max(1.5, ((Math.log2(bytes) - SCALE_LO) / (SCALE_HI - SCALE_LO)) * 100);

/** How many times over the per-frame clone budget, or null if it is not a
 *  payload or it fits. Derived, so the "810×" in the caption and the "810×" in
 *  the row cannot drift apart — and so neither can drift from the byte count
 *  that produced them. Rounded, because 810.0× is false precision here. */
const overBudget = (p: Payload) =>
  !p.budget && p.bytes > FRAME_BUDGET ? Math.round(p.bytes / FRAME_BUDGET) : null;

export default function EngineInAWorker() {
  return (
    <>
      {/* The receipts, before the argument. Every figure below came out of one
          of these three documents, and they are linked rather than summarized
          so a reader who doubts a number can go and check it. */}
      <p className="post__sourcenote">
        Shipped as the default in v8.32 on 13 August 2026. Everything measured below comes from the
        repository's own records —{" "}
        <a href={repoFile("docs/adr/024-engine-in-a-worker.md")} {...external}>
          ADR-024
        </a>
        , the{" "}
        <a href={repoFile("docs/engine-worker-feasibility.md")} {...external}>
          feasibility note
        </a>{" "}
        that opened it, and the{" "}
        <a href={repoFile("docs/engine-worker-a11-0-finding.md")} {...external}>
          transferred-canvas finding
        </a>{" "}
        that closed the last objection to it.
      </p>

      <p>
        Until August, the engine that does the actual pixel work in Image Horse — <code>stamp_tool</code>,
        compiled from Rust to WebAssembly — ran on the same thread as the interface. Every blur, every
        export, every batch run competed with painting. A heavy operation blocked the main thread for{" "}
        <span className="fig">129–137&nbsp;ms</span>, and strokes stuttered while it did.
      </p>

      <p>
        Image Horse already ran a worker. <code>codec.worker.ts</code> encodes WebP and JPEG off-thread,
        and it works because what it sends across is small, or already shaped like a buffer. The engine
        is a different animal. Its whole value on the render path is a <em>view straight into WASM
        linear memory</em>, blitted to the canvas without a copy. This post is about what happens to
        that view at a thread boundary, and what we did instead.
      </p>

      <figure className="post__figure">
        <Scene kind="threads" />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 1</span>
          <span>
            Where things live now. The engine, its linear memory and the canvas surface all sit in the
            worker. Calls carry a request id and get a reply; the per-frame <em>blit</em> is
            fire-and-forget and bypasses the queue.
          </span>
        </figcaption>
      </figure>

      <h2 id="doors">Three doors, one wall</h2>

      <p>
        There are exactly three ways a value gets from one thread to another, and <code>postMessage</code>{" "}
        picks between them based on what you hand it.
      </p>

      <table className="spec">
        <caption className="spec__caption">
          How each door behaves. Cost is on the <em>sending</em> thread.
        </caption>
        <thead>
          <tr>
            <th scope="col">Door</th>
            <th scope="col">Mechanism</th>
            <th scope="col">Cost</th>
            <th scope="col">Sender keeps it?</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Copy</th>
            <td>Structured clone</td>
            <td>∝ payload size</td>
            <td className="muted">Yes — two independent values</td>
          </tr>
          <tr>
            <th scope="row">Move</th>
            <td>Transfer list, 2nd argument</td>
            <td>
              <span className="fig">O(1)</span> — size-independent
            </td>
            <td className="muted">No — original is detached, throws on read</td>
          </tr>
          <tr>
            <th scope="row">Share</th>
            <td>
              <code>SharedArrayBuffer</code>
            </td>
            <td>O(1), once</td>
            <td className="muted">
              Yes — <em>same bytes</em>, both threads
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        Move is the door you want for anything big: ownership changes hands, nothing is copied. It works
        by <em>detaching</em> the buffer — unhooking the memory from the sending realm and rehooking it
        in the receiving one. And that is exactly where the engine hits a wall.
      </p>

      <p>
        WebAssembly linear memory cannot be detached. When the engine creates a{" "}
        <code>WebAssembly.Memory</code>, the spec stamps its buffer with an internal{" "}
        <code>[[ArrayBufferDetachKey]]</code> that <code>postMessage</code> does not carry, so the
        detach fails (
        <a href="https://github.com/whatwg/html/issues/4601" {...external}>
          whatwg/html&nbsp;#4601
        </a>
        ). The engine's heap is not a buffer you may move. It is the running program's memory.
      </p>

      <figure className="post__figure">
        <Scene kind="doors" />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 2</span>
          <span>
            The three doors, and the wall. Copy duplicates and pays by the byte. Move is instant and
            leaves the sender detached. Share is one block visible from both sides. WASM memory is
            chained to its realm — it strains and snaps back.
          </span>
        </figcaption>
      </figure>

      {/* The browser-disagreement note is a callout rather than another
          paragraph because it is the one thing here that will bite someone
          who tests in a single browser — which is most people, most of the
          time. A reader skimming the headings should still catch it. */}
      <aside className="post__callout">
        <p className="post__callout-title">The part that bites in review, not in dev</p>
        <p>
          The browsers disagree about the failure. Firefox and Safari throw a <code>TypeError</code>.
          Chrome has, since 2014, <strong>silently copied instead</strong> — behavior that predates
          WebAssembly and survived because sites depend on it. So the naive port <em>appears to work</em>{" "}
          in Chrome, at full copy cost, and hard-fails the moment anyone opens Safari.
        </p>
      </aside>

      <h2 id="budgets">Why the pixels can't make the trip</h2>

      <p>
        Fine — copy them, then. Copy is the default door and it is not free. Surma benchmarked
        structured clone across five device and browser combinations and found the time tracks the size
        of the payload almost exactly (
        <a href="https://surma.dev/things/is-postmessage-slow/" {...external}>
          Surma, <em>Is postMessage slow?</em>
        </a>
        ). Two budgets fall out of it.
      </p>

      <table className="spec">
        <caption className="spec__caption">
          Structured-clone budgets, derived from the RAIL guidelines. Safe even on slow devices.
        </caption>
        <thead>
          <tr>
            <th scope="col">If you are…</th>
            <th scope="col">Budget</th>
            <th scope="col">Max payload</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Responding to a user interaction</th>
            <td>
              <span className="fig">100&nbsp;ms</span>
            </td>
            <td>
              <span className="fig">100&nbsp;KiB</span>
            </td>
          </tr>
          <tr>
            <th scope="row">Driving a JS animation frame</th>
            <td>
              <span className="fig">16&nbsp;ms</span>
            </td>
            <td>
              <span className="fig">10&nbsp;KiB</span>
            </td>
          </tr>
        </tbody>
      </table>

      <p>Now put an Image Horse frame against that.</p>

      <figure className="post__figure">
        {/* The dashed budget rule is positioned from the SAME formula the bars
            use, handed to CSS as a custom property. It was a literal 20.76% in
            the stylesheet first, which is the formula's answer copied by hand
            into a second place that could not be recomputed. */}
        <div
          className="scale"
          style={{ "--budget-at": `${widthOf(FRAME_BUDGET).toFixed(2)}%` } as CSSProperties}
        >
          <p className="scale__head">
            <span>Bytes per postMessage, log scale</span>
            <span className="scale__range">1 KiB → 64 MiB</span>
          </p>

          {/* A table, not a stack of divs. Each row is a label, a magnitude and
              a value — that is tabular data, and a screen reader should get the
              numbers rather than a wall of unlabeled bars. The bar itself is
              decorative and the figure it depicts is in the next cell as text. */}
          <table className="scale__grid">
            <tbody>
              {PAYLOADS.map((p) => {
                const over = overBudget(p);
                return (
                  <tr
                    key={p.label}
                    className={[
                      "scale__row",
                      p.budget && "scale__row--budget",
                      over && "scale__row--over",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <th scope="row" className="scale__label">
                      {p.label}
                      {p.note && <span className="scale__note">{p.note}</span>}
                    </th>
                    <td className="scale__track">
                      <span
                        className="scale__bar"
                        style={{ width: `${widthOf(p.bytes).toFixed(2)}%` }}
                        aria-hidden="true"
                      />
                    </td>
                    <td className="scale__value">
                      <span className="fig">{p.size}</span>
                      {over !== null && (
                        <span className="scale__over">{over.toLocaleString("en-US")}× over</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <p className="scale__foot">
            The rule sits at the 10&nbsp;KiB per-frame budget. Every bar past it is a frame you drop.
          </p>
        </div>
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 3</span>
          <span>
            Copying pixels per stroke is off the table before we start. A single HD composite is 810× the
            per-frame clone budget, and transferring is forbidden by the wall above. The pixels cannot
            make that trip at all.
          </span>
        </figcaption>
      </figure>

      <h2 id="canvas">So the canvas moved instead</h2>

      <p>
        If the pixels can't come to the canvas, the canvas goes to the pixels.{" "}
        <code>canvas.transferControlToOffscreen()</code> yields an <code>OffscreenCanvas</code>, which{" "}
        <em>is</em> transferable. One message carries it into the worker, once per element, and from
        then on the worker draws onto it directly. The element stays in the DOM, where CSS still sizes
        it and overlays still align to it — the main thread simply can no longer get a 2D context from
        it.
      </p>

      <p>
        That sounds like more work and it is less: under this arrangement <code>flushToCanvas</code>{" "}
        never crosses the boundary at all. The worst read-modify-write site disappears instead of
        needing a careful rewrite, and every argument against moving the canvas was measured first —
        zoom and pan survive the transfer 11/11 across four browsers, overlays stay pinned 9/9, and{" "}
        <code>desynchronized</code> is honored 4/4.
      </p>

      <p>Three things had to move together for that to hold.</p>

      <table className="spec">
        <caption className="spec__caption">What lives where, after the move.</caption>
        <thead>
          <tr>
            <th scope="col">Step</th>
            <th scope="col">Before</th>
            <th scope="col">In the worker</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Construction</th>
            <td className="muted">
              <code>new Tool(w, h)</code> on the main thread, then handed over
            </td>
            <td>
              <code>createLiveEngine(&#123; width, height, pixels &#125;)</code> — built where it runs.
              One engine, one op log.
            </td>
          </tr>
          <tr>
            <th scope="row">Recomposite</th>
            <td className="muted">main thread</td>
            <td>worker</td>
          </tr>
          <tr>
            <th scope="row">Canvas resize</th>
            <td className="muted">
              <code>canvas.width = w</code>
            </td>
            <td>
              worker sets <code>OffscreenCanvas.width</code>
            </td>
          </tr>
          <tr>
            <th scope="row">Blit</th>
            <td className="muted">
              zero-copy view → backbuffer → <code>putImageData</code>
            </td>
            <td>same code, worker-side, against its own memory</td>
          </tr>
          <tr>
            <th scope="row">Crosses the boundary</th>
            <td className="muted">—</td>
            <td>one fire-and-forget message per frame</td>
          </tr>
        </tbody>
      </table>

      <figure className="post__figure">
        <Scene kind="canvas" controls />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 4</span>
          <span>
            <strong>Yours to drive</strong> — play, scrub, or jump to any of the four beats. The
            transfer, in four beats. The surface leaves the element and lands beside the engine; from
            then on pixels flow memory → canvas without leaving the worker, and the only per-frame
            traffic is a blit message that nobody waits for.
          </span>
        </figcaption>
      </figure>

      <p>
        The worker-side blit is the same dozen lines the main thread used to run, and it carries the
        same two warnings. The view has to be rebuilt on every call, because a <code>memory.grow()</code>{" "}
        replaces the backing buffer and detaches every earlier view of it. And it copies into a private
        backbuffer before <code>putImageData</code>, because a desynchronized present reading live WASM
        memory is the Firefox garbage-after-five-strokes bug.
      </p>

      <pre className="post__code">
        <code>
          <span className="tok-c">{"// engine.worker.ts — fire-and-forget, not routed through the queue"}</span>
          {"\n"}
          <span className="tok-k">function</span>
          {" blit() {\n  "}
          <span className="tok-k">if</span>
          {" (!tool || !surface) "}
          <span className="tok-k">return</span>
          {";\n  tool.recomposite();\n  "}
          <span className="tok-k">const</span>
          {" view = "}
          <span className="tok-k">new</span>
          {" Uint8ClampedArray(wasmMemory.buffer, tool.data_ptr(), tool.data_len());\n  backbuffer.data.set(view);          "}
          <span className="tok-c">{"// copy once, worker-side"}</span>
          {"\n  surface.getContext("}
          <span className="tok-s">"2d"</span>
          {").putImageData(backbuffer, 0, 0);\n}"}
        </code>
      </pre>

      <p>
        Notice what is <em>not</em> in there: no request id, no reply, no queue. A blit mutates nothing,
        so ordering it behind pending work would delay the picture without buying any guarantee — and
        the round trip it would add is the regression the whole arc exists to remove.
      </p>

      <h2 id="one-port">One port, in order</h2>

      <p>
        Everything that <em>does</em> mutate the document goes through a single port and an explicit
        FIFO queue. That is not caution for its own sake. Image Horse's undo history is an op log, and{" "}
        <code>OpLog::append</code> records <em>arrival</em> order — no op carries a sequence number. So{" "}
        <code>postMessage</code> order has to <em>be</em> append order, and it only is while every
        mutation goes through one port, drained one at a time. A library that gives correct results with
        no ordering promise between concurrent calls would silently corrupt history.
      </p>

      <p>
        Each request carries a monotonic id, so concurrent calls cannot take each other's answers; a
        superseded request can be cancelled before it runs; and a Rust panic comes back as a rejection
        instead of a hang. Those are exactly what the original spike lacked.
      </p>

      <figure className="post__figure">
        <Queue />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 5</span>
          <span>
            The gate that could say no. Mutations posted with no await land in the worker's queue in
            post order and drain one at a time into the op log; a canceled id is rejected, not
            skipped. Run for real against 16 concurrent mutations, the worker's log came out
            byte-identical to the local engine's.
          </span>
        </figcaption>
      </figure>

      <table className="spec">
        <caption className="spec__caption">
          Gate 3, the concurrent burst: 16 mutations in flight at once, then 6 edits against their ids.
          Awaiting each call would have proven nothing.
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Measurement</span>
            </th>
            <th scope="col">Local engine</th>
            <th scope="col">Worker engine</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">ids returned</th>
            <td>1..16 in order</td>
            <td>1..16 in order</td>
          </tr>
          <tr>
            <th scope="row">ops · bytes</th>
            <td>
              <span className="fig">7 · 910</span>
            </td>
            <td>
              <span className="fig">7 · 910</span>
            </td>
          </tr>
          <tr>
            <th scope="row">op-log SHA-256</th>
            <td>
              <span className="fig">ea77112d…</span>
            </td>
            <td>
              <span className="fig">ea77112d…</span> identical
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        Which makes the rule the wrong kind of thing to remember and the right kind of thing to test.{" "}
        <code>engineOwnership.contract.test.ts</code> fails on a second writer to the live handle, on an
        engine built outside the owner, and on an assignment that bypasses the seam. All three were
        mutation-tested rather than assumed.
      </p>

      <p>
        The rule also needed a correction, five days in, and the correction is the interesting half. Two
        modules legitimately build their own engine — batch export, and the settings panel behind it —
        for a document you are <em>not</em> editing. Routing those through the live port would put their
        operations in the live document's log, so undo would replay edits to a photo nobody opened, and a
        forty-photo batch would queue behind the one open image. The first version of the rule said
        "every mutation", a structural test enforced exactly that, and the obvious way to make the test
        pass was to introduce the bug.
      </p>

      <p>
        One more thing the port had to get right. The main thread's handle to the engine is a Proxy, and
        a Proxy that answers every property lookup with a forwarding function would make every feature
        detection in the app — <code>typeof t.remove_object === "function"</code> and three others —
        answer <em>yes</em> on every build. So the worker enumerates its own engine's prototype at init
        and sends the list back, and the proxy forwards only those names. A surface reported by the
        engine itself cannot drift from the engine, and the control check — an absent method answering{" "}
        <code>false</code> — is the row that proves the gate is live.
      </p>

      <h2 id="truthy">The truthy trap</h2>

      <p>
        Turning a synchronous read into an asynchronous one does not break loudly. That is the entire
        difficulty. A guard like <code>if (!tool.has_source())</code> reads perfectly well after the
        conversion, and if the <code>await</code> is missing the expression is now a promise — and a
        promise is truthy. The guard stops guarding. Nothing throws, nothing logs, and the tool quietly
        does the thing the guard existed to prevent.
      </p>

      <p>
        The variants got worse the further in we went. <code>Array.from(promise)</code> is{" "}
        <code>[]</code>, which is also truthy, so a <code>if (!m) throw</code> written specifically to
        catch a cache miss could never fire — and the arithmetic downstream produced <code>NaN</code> for
        an entire batch. <code>flatten_text_annotations</code> reports whether a layer had annotations to
        bake; un-awaited it reads as true after the first layer, so every OpenRaster export would have
        told you your redo history had been cleared.
      </p>

      <p>
        TypeScript does not save you here, and the reason is worth writing down. A function returning{" "}
        <code>Promise&lt;number&gt;</code> is assignable to a slot declared <code>=&gt; void</code>. One
        of the pen tool's commit handlers sat in exactly such a slot, so the conversion would have
        typechecked cleanly while <code>typeof newId === "number"</code> silently went false and paths
        stopped staying selected.
      </p>

      {/* Pulled out of the paragraph above rather than repeated from it — the
          sentence is the one line of this post that transfers to any codebase
          doing the same migration, and it was doing no work buried at the end
          of a paragraph about pen tools. */}
      <blockquote className="post__quote post__quote--pull">
        <p>
          A <code>void</code> return is not proof that nothing is consumed.
        </p>
      </blockquote>

      <p>
        So the conversions were ratcheted. A contract test pins the number of unconverted value-consuming
        sites so it can only go down, an audit script — not a hand-written list — is the authority on
        what is left, and every batch was mutation-tested: change the code so the bug is present again,
        and confirm a test goes red. Twice the tests caught what the audit structurally could not see,
        because the audit reads the text at the call site and a guard one line below is invisible to it.
      </p>

      <h2 id="numbers">The numbers</h2>

      <p>
        Latency was never the obstacle. The feasibility night measured the boundary before anyone wrote
        a line of migration, and the obstacle turned out to be structural.
      </p>

      {/* A real quotation from a real document, so it is marked up as one and
          cited to the file it came from. It was written inline in an <em> at
          first, which reads as emphasis rather than as someone else's sentence
          — and this sentence is the whole finding. */}
      <blockquote className="post__quote" cite={repoFile("docs/engine-worker-feasibility.md")}>
        <p>Latency is not the obstacle. The obstacle is 117 synchronous reads.</p>
        <cite className="post__quote-cite">
          <a href={repoFile("docs/engine-worker-feasibility.md")} {...external}>
            docs/engine-worker-feasibility.md
          </a>
        </cite>
      </blockquote>

      <table className="spec">
        <caption className="spec__caption">Measured, not estimated. Medians unless stated.</caption>
        <thead>
          <tr>
            <th scope="col">Measurement</th>
            <th scope="col">Result</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Empty-payload round trip, 50 pings</th>
            <td>
              <span className="fig">0.100&nbsp;ms</span> median · 0.300 ms p95 ·{" "}
              <span className="muted">0.6% of a frame</span>
            </td>
          </tr>
          <tr>
            <th scope="row">Cold sharpen on a 48 MB photo, main vs worker</th>
            <td>
              468.6 ms → 483.6 ms (<span className="fig">1.03×</span>)
            </td>
          </tr>
          <tr>
            <th scope="row">Per-frame flush, in worker vs main</th>
            <td>22.1 ms vs 23.9 ms</td>
          </tr>
          <tr>
            <th scope="row">Worker warm-up, cold vs warmed before the flip</th>
            <td>
              715.4 ms vs <span className="fig">392.1&nbsp;ms</span>
            </td>
          </tr>
          <tr>
            <th scope="row">Engine call sites audited</th>
            <td>
              206 — 77 fire-and-forget · <span className="fig">117 value-consumed</span> · 12 hot-path
            </td>
          </tr>
          <tr>
            <th scope="row">SharedArrayBuffer, COOP/COEP, wasm threads</th>
            <td className="muted">none needed — transfer-based, single instance per side</td>
          </tr>
          <tr>
            <th scope="row">Main-thread blocking per heavy operation</th>
            <td>
              129–137 ms → <span className="fig">0</span>
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        The third door — shared memory — was never opened. Cross-origin isolation was tested and would
        have worked, but a worker that owns its own WASM instance and exchanges transferables needs none
        of it, and this project had already tried WASM threads once and dropped them at 8–31× slower
        than the scalar kernel. The simplest architecture that could work is the one that shipped.
      </p>

      <h2 id="stages">Six stages, each one shippable</h2>

      <p>
        The plan was staged on purpose. Stages one and two introduce no worker and change no behavior at
        all — they establish the single seam and remove the read-modify-write sites — and they were worth
        shipping even if everything after them had been abandoned. That is the point of putting them
        first. Stage three built the worker and left it switched off, and the build emitted no worker
        chunk at all, because nothing imported it yet. That was written down as the honest status rather
        than smoothed over.
      </p>

      <p>
        Every stage was reversible by itself, and the whole arc sat behind a flag that stayed off for
        five weeks. It became the default on 13 August 2026, in v8.32.
      </p>

      <h2 id="see-it">See it yourself</h2>

      <p>
        The wall is a claim from a 2019 spec thread, and browsers move. Paste this into the console of
        any page, in each browser you care about.
      </p>

      <pre className="post__code">
        <code>
          <span className="tok-k">const</span>
          {" m = "}
          <span className="tok-k">new</span>
          {" WebAssembly.Memory({ initial: 1 });\n"}
          <span className="tok-k">try</span>
          {" {\n  "}
          <span className="tok-c">{"// structuredClone uses the same transfer machinery as postMessage"}</span>
          {"\n  structuredClone(m.buffer, { transfer: [m.buffer] });\n  console.log("}
          <span className="tok-s">"copied silently — byteLength still"</span>
          {", m.buffer.byteLength);\n} "}
          <span className="tok-k">catch</span>
          {" (e) {\n  console.log("}
          <span className="tok-s">"threw:"</span>
          {", e.constructor.name, e.message);\n}"}
        </code>
      </pre>

      <p>
        And in the editor itself, the worker engine is the default for every document. Add{" "}
        <code>?ih_engine_worker=0</code> to opt a tab back onto the main thread, run a blur on a big
        photo in each, and watch the pointer. It takes effect on the next load, like every kill switch
        in this app. It is there because a change this structural should be something you can undo from
        your own browser without waiting for a release from us.
      </p>

      <p className="post__actions">
        <a className="cta cta--fill" href="https://edit.imagehorse.app" {...external}>
          Open the beta
        </a>
        <a className="cta" href={repoFile("app/src/workers/engine.worker.ts")} {...external}>
          Read engine.worker.ts
        </a>
      </p>

      <p className="post__sources">
        Sources:{" "}
        <a href={repoFile("docs/engine-worker-feasibility.md")} {...external}>
          Phase 0 feasibility
        </a>{" "}
        ·{" "}
        <a href={repoFile("docs/engine-worker-a12-design.md")} {...external}>
          a12 design and gates
        </a>{" "}
        ·{" "}
        <a href={repoFile("docs/adr/024-engine-in-a-worker.md")} {...external}>
          ADR-024
        </a>{" "}
        ·{" "}
        <a href="https://surma.dev/things/is-postmessage-slow/" {...external}>
          Surma, Is postMessage slow?
        </a>{" "}
        ·{" "}
        <a href="https://github.com/whatwg/html/issues/4601" {...external}>
          whatwg/html #4601
        </a>{" "}
        ·{" "}
        <a
          href="https://developer.mozilla.org/en-US/docs/Web/API/Web_Workers_API/Transferable_objects"
          {...external}
        >
          MDN, Transferable objects
        </a>
      </p>

      <p className="post__kicker">The engine works in the back room now. The tab just paints.</p>
    </>
  );
}
