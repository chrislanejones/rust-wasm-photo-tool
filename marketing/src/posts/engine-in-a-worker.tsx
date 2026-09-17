/* "We moved the engine off the main thread. The pixels stayed put."
 *
 * Body only — the headline, the deck, the dateline and the footer are the
 * shell's (pages/BlogPost.tsx). This file starts at the first paragraph.
 *
 * Every figure in here is in the repository. The blocking times and the
 * round-trip numbers come from docs/engine-worker-feasibility.md and
 * docs/engine-worker-a11-0-finding.md; the invariant, the stage table and the
 * kill switch come from docs/adr/024-engine-in-a-worker.md. Nothing is
 * estimated, and nothing is rounded to sound better than it measured.
 */

import { external, repoFile } from "../config";

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
        is a different animal. Its whole value on the render path is a view straight into WASM linear
        memory, blitted to the canvas without a copy. This post is about what happens to that view at a
        thread boundary, and what we did instead.
      </p>

      <h2 id="impossible">The obvious way is impossible</h2>

      <p>
        <code>postMessage</code> has two modes and neither one fits. It copies, which buys you the copy
        you spent the whole engine avoiding. Or it transfers, which hands the buffer over and leaves the
        engine without its own heap. A view into linear memory is not a thing you can send; it is a thing
        that is only meaningful next to the memory it points at.
      </p>

      <p>
        The sharpest case was <code>flushToCanvas</code>. It reads the canvas width and height, then
        recomposites against them — per frame, in the hot path. Split that across a boundary and it stops
        being one operation and becomes a read, a wait, and a write against numbers that may have changed
        while you waited. There were nine sites shaped like that. This was the worst of them.
      </p>

      <h2 id="canvas">So the canvas went too</h2>

      <p>
        The decision was to move the engine <em>and</em> the main canvas into the worker, rather than
        leaving the canvas behind and marshaling pixels back to it. That sounds like more work and it is
        less: under this arrangement <code>flushToCanvas</code> never crosses the boundary at all. The
        worst read-modify-write site disappears instead of needing a careful rewrite, and every one of
        the arguments against moving the canvas was measured first — zoom and pan survive the transfer
        11/11 across four browsers, overlays stay pinned 9/9, and <code>desynchronized</code> is honored
        4/4.
      </p>

      <p>
        The <code>&lt;canvas&gt;</code> element stays in the page, where layout and pointer events still
        need it. What leaves is its drawing surface, handed over once with{" "}
        <code>transferControlToOffscreen</code> and never handed back.
      </p>

      <figure className="post__figure">
        <div className="boundary">
          <div className="boundary__plane">
            <p className="boundary__name">Main thread</p>
            <ul className="boundary__list">
              <li>React, pointer input, layout</li>
              <li>
                <code>&lt;canvas&gt;</code> — the element stays, the surface is gone
              </li>
              <li>No engine. No WASM memory. Nothing to block on.</li>
            </ul>
          </div>

          <div className="boundary__seam" aria-hidden="true">
            <span className="boundary__port">one port</span>
            <span className="boundary__msg">call &#123; id, method, args &#125; →</span>
            <span className="boundary__msg">← reply &#123; id, ok, value &#125;</span>
          </div>

          <div className="boundary__plane boundary__plane--engine">
            <p className="boundary__name">Engine worker</p>
            <ul className="boundary__list">
              <li>
                <code>stamp_tool</code>, with its own WASM linear memory
              </li>
              <li>
                <code>OffscreenCanvas</code> — the blit lands here, never crosses back
              </li>
              <li>One queue, drained one call at a time</li>
            </ul>
          </div>
        </div>
        <figcaption className="post__caption">
          The boundary after v8.32. Pixels never cross it — only calls and replies do, and the replies
          are small.
        </figcaption>
      </figure>

      <h2 id="one-port">One port per document</h2>

      <p>
        The whole arrangement rests on a single rule: every mutation of the document you are editing
        reaches the engine through one message queue.
      </p>

      <p>
        That rule is not tidiness. <code>OpLog::append</code> records arrival order — there is no sequence
        number anywhere in an <code>Op</code> — and a <code>MessagePort</code> is FIFO. So message order{" "}
        <em>is</em> append order, and the undo log after the move is byte-identical to the one before it.
        Open a second port, or reach the engine anywhere outside the queue, and that guarantee is gone
        without a single error in the console.
      </p>

      <p>
        Which makes it the wrong kind of thing to remember and the right kind of thing to test.{" "}
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

      <h2 id="latency">Latency was never the problem</h2>

      <p>
        The instinct is that a round trip per call is unaffordable, especially on a pointer-move handler.
        It was measured before anything was built, and it is not.
      </p>

      <table className="spec">
        <caption className="spec__caption">
          Measured before the migration started, and again once a real engine ran inside a transferred
          canvas.
        </caption>
        <thead>
          <tr>
            <th scope="col">What</th>
            <th scope="col">Measured</th>
            <th scope="col">Against</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Fixed round trip, median</th>
            <td>
              <span className="fig">0.100&nbsp;ms</span>
            </td>
            <td className="muted">0.6% of one 60 fps frame</td>
          </tr>
          <tr>
            <th scope="row">Fixed round trip, p95</th>
            <td>
              <span className="fig">0.300&nbsp;ms</span>
            </td>
            <td className="muted">Over 50 pings</td>
          </tr>
          <tr>
            <th scope="row">Flush at 3.1 MP, in the worker</th>
            <td>
              <span className="fig">22.1&nbsp;ms</span>
            </td>
            <td className="muted">The same on the main thread</td>
          </tr>
          <tr>
            <th scope="row">
              Warm <code>adjust_sharpen</code>, in the worker
            </th>
            <td>
              <span className="fig">392&nbsp;ms</span>
            </td>
            <td className="muted">419 ms on the main thread</td>
          </tr>
        </tbody>
      </table>

      <p>The feasibility note put its own conclusion in one line.</p>

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

      <p>
        A later recount raised that considerably — 290 call sites, of which 101 can be fired and
        forgotten, 27 sit in a hot path, and <span className="fig">162</span> consume a value and so need
        both a promise and a rewrite of the code around them.
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

      <h2 id="switch">The switch is still there</h2>

      <p>
        Set <code>ih_engine_worker</code> to <code>0</code> and reload, and the engine goes back on the
        main thread. It takes effect on the next load, like every kill switch in this app. It is there
        because a change this structural should be something you can undo from your own browser without
        waiting for a release from us.
      </p>

      <p>
        What you get for it is unglamorous and it is the whole point: the main thread's blocking time per
        heavy operation went from <span className="fig">129–137&nbsp;ms</span> to none. The engine does
        exactly what it did before, in exactly the order it did it. It just stopped doing it where you
        were trying to draw.
      </p>
    </>
  );
}
