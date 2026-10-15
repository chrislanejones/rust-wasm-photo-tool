/* "The engine left the main thread. The pixels stayed put."
 *
 * Body only — the headline, the deck, the dateline and the footer are the
 * shell's (pages/BlogPost.tsx). This file starts at the first paragraph. The
 * one thing it adds above that is `Topper`, the scene behind the shell's
 * headline, at the bottom of this file.
 *
 * REWRITTEN 10-13-2026 at Chris's request, for a reader who is not deep in the
 * stack: a tech manager, or someone two years in. Same measurements, same
 * figures and tables, plainer words. The narration mp3 was re-recorded from
 * the new text the same day (Emma, widened stereo, edge-tts 7.3.1).
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
import { Link } from "react-router";

import { external, repoFile } from "../config";
import { Queue, Scene } from "./engine-in-a-worker.figures";
import "./engine-in-a-worker.figures.css";
import PostAudio from "../components/PostAudio";

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
      <p className="post__sourcenote">
        Shipped as the default in v8.32 on September 18th, 2026. Every measurement below comes from the
        repository's own records:{" "}
        <a href={repoFile("docs/adr/024-engine-in-a-worker.md")} {...external}>
          ADR-024
        </a>
        , the{" "}
        <a href={repoFile("docs/engine-worker-feasibility.md")} {...external}>
          feasibility note
        </a>{" "}
        that opened the question, and the{" "}
        <a href={repoFile("docs/engine-worker-a11-0-finding.md")} {...external}>
          transferred-canvas finding
        </a>{" "}
        that closed the last objection.
      </p>
      <PostAudio src="/audio/engine-in-a-worker.mp3" minutes={15} />

      <p>
        Picture a Lowe's with one employee. He runs the register, answers the phone, restocks the
        shelves, and walks you to aisle 14 for the rubber mallet, and he does all of it in order, one
        thing at a time, so when somebody at the Pro desk asks him to cut forty pieces of lumber,
        everyone in line at the register just stands there and waits. That's a browser tab. The one
        employee is called the main thread, and until August he was also the one doing the heavy photo
        work in Image Horse.
      </p>

      <p>
        The heavy photo work is done by a program called <code>stamp_tool</code>, written in Rust and
        compiled to run in the browser. Every blur, every export, every batch job ran on the same thread
        that draws your brush strokes. A big operation froze the page for{" "}
        <span className="fig">129–137&nbsp;ms</span>, and your stroke stuttered while it did.
      </p>

      <p>
        The obvious fix is a second employee. Browsers have one, it's called a Web Worker, and Image
        Horse already used one for squeezing photos into WebP and JPEG. That one works because what it's
        handed is small, or already shaped like a plain block of bytes. The engine is a different animal.
        The reason it's fast is that the screen reads straight out of the engine's memory, no copy in
        between. This post is about what happens to that trick when you put a wall between the engine and
        the screen, and what I did instead.
      </p>

      <figure className="post__figure">
        <Scene kind="threads" />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 1</span>
          <span>
            Where things live now. The engine, its memory and the drawing surface all sit in the back
            room. Requests go in with a ticket number and get an answer back; the per-frame{" "}
            <em>blit</em>, the "put the picture on screen" call, skips the line entirely.
          </span>
        </figcaption>
      </figure>

      <h2 id="doors">Three doors, one wall</h2>

      <p>
        There are exactly three ways to get something from one thread to another, and the browser picks
        one based on what you hand it. Think of it as moving a filing cabinet to the back room.
      </p>

      <table className="spec">
        <caption className="spec__caption">
          How each door behaves. The cost lands on the <em>sending</em> side.
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
            <td>Structured clone: photocopy every page</td>
            <td>Grows with the size</td>
            <td className="muted">Yes, two separate cabinets</td>
          </tr>
          <tr>
            <th scope="row">Move</th>
            <td>Transfer list: hand over the keys</td>
            <td>
              <span className="fig">O(1)</span>, the same cost at any size
            </td>
            <td className="muted">No, the old handle is dead and reading it throws</td>
          </tr>
          <tr>
            <th scope="row">Share</th>
            <td>
              <code>SharedArrayBuffer</code>: a joint account
            </td>
            <td>Free after the first time</td>
            <td className="muted">
              Yes, <em>the same bytes</em>, seen from both rooms
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        Move is the door you want for anything big: ownership changes hands and nothing gets copied. It
        works by <em>detaching</em> the memory, unhooking it from the sender and rehooking it in the
        receiver. And that's exactly where the engine hits a wall.
      </p>

      <p>
        The engine's memory can't be detached. The spec stamps it with an internal mark that{" "}
        <code>postMessage</code> can't carry, so the hand-off fails (
        <a href="https://github.com/whatwg/html/issues/4601" {...external}>
          whatwg/html&nbsp;#4601
        </a>
        ). It's not a filing cabinet you can wheel down the hall. It's the floor the engine is standing
        on.
      </p>

      <figure className="post__figure">
        <Scene kind="doors" />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 2</span>
          <span>
            The three doors, and the wall. Copy duplicates and pays by the byte. Move is instant and
            leaves the sender empty-handed. Share is one block visible from both rooms. The engine's
            memory is chained to its room: it strains and snaps back.
          </span>
        </figcaption>
      </figure>

      <aside className="post__callout">
        <p className="post__callout-title">The part that bites in review, not in dev</p>
        <p>
          The browsers don't agree on how to fail. Firefox and Safari throw an error. Chrome has, since
          2014, <strong>quietly made a copy instead</strong>, a habit older than WebAssembly that survived
          because sites depend on it. So the lazy version <em>looks like it works</em> in Chrome, at full
          copying cost, right up until someone opens Safari and it falls over. It's the contractor who
          says "yeah, that'll hold" and leaves before you put weight on it.
        </p>
      </aside>

      <h2 id="budgets">Why the pixels can't make the trip</h2>

      <p>
        Fine, copy them then. Copying is the default door and it isn't free. Surma measured it across
        five devices and browsers and found the time tracks the size of what you send almost exactly (
        <a href="https://surma.dev/things/is-postmessage-slow/" {...external}>
          Surma, <em>Is postMessage slow?</em>
        </a>
        ). Two budgets fall out of that.
      </p>

      <table className="spec">
        <caption className="spec__caption">
          How much you can copy per message and still feel smooth, even on a slow phone.
        </caption>
        <thead>
          <tr>
            <th scope="col">If you are…</th>
            <th scope="col">Time budget</th>
            <th scope="col">Max size</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Responding to a click</th>
            <td>
              <span className="fig">100&nbsp;ms</span>
            </td>
            <td>
              <span className="fig">100&nbsp;KiB</span>
            </td>
          </tr>
          <tr>
            <th scope="row">Drawing one frame of an animation</th>
            <td>
              <span className="fig">16&nbsp;ms</span>
            </td>
            <td>
              <span className="fig">10&nbsp;KiB</span>
            </td>
          </tr>
        </tbody>
      </table>

      <p>Now put one frame of an Image Horse photo against that.</p>

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
          {/* Roles stated explicitly: the phone layout (styles.css) changes
              these elements' `display`, which drops implicit table semantics
              in some screen readers. */}
          <table className="scale__grid" role="table">
            <tbody role="rowgroup">
              {PAYLOADS.map((p) => {
                const over = overBudget(p);
                return (
                  <tr
                    key={p.label}
                    role="row"
                    className={[
                      "scale__row",
                      p.budget && "scale__row--budget",
                      over && "scale__row--over",
                    ]
                      .filter(Boolean)
                      .join(" ")}
                  >
                    <th scope="row" role="rowheader" className="scale__label">
                      {p.label}
                      {p.note && <span className="scale__note">{p.note}</span>}
                    </th>
                    <td role="cell" className="scale__track">
                      <span
                        className="scale__bar"
                        style={{ width: `${widthOf(p.bytes).toFixed(2)}%` }}
                        aria-hidden="true"
                      />
                    </td>
                    <td role="cell" className="scale__value">
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
            The line sits at the 10&nbsp;KiB per-frame budget. Every bar past it is a frame you drop.
          </p>
        </div>
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 3</span>
          <span>
            Copying the pixels on every stroke is off the table before we start. One HD frame is 810
            times the per-frame budget, and handing them over is forbidden by the wall above. The
            pixels can't make that trip at all.
          </span>
        </figcaption>
      </figure>

      <h2 id="canvas">So the canvas moved instead</h2>

      <p>
        If the pixels can't come to the screen, the screen goes to the pixels. The browser lets you take
        the drawing surface out of a canvas element (<code>transferControlToOffscreen()</code>) and hand{" "}
        <em>that</em> to the back room. One message, once per canvas, and from then on the worker draws
        onto it directly. The element stays on the page, where the layout still sizes it and the
        overlays still line up with it. The front counter just can't draw on it anymore.
      </p>

      <p>
        That sounds like more work and it's less. The worst piece of code on the old path, the one that
        read from the engine and wrote to the screen on every frame, doesn't need a careful rewrite. It
        just disappears. And every argument against moving the canvas got measured before anyone
        believed it: zoom and pan survived the move 11 out of 11 times across four browsers, the overlays
        stayed pinned 9 out of 9, and the low-latency drawing mode kept working 4 out of 4.
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
            <th scope="row">Building the engine</th>
            <td className="muted">Built at the front counter, then handed over</td>
            <td>Built in the back room, where it runs. One engine, one history.</td>
          </tr>
          <tr>
            <th scope="row">Combining the layers</th>
            <td className="muted">front counter</td>
            <td>back room</td>
          </tr>
          <tr>
            <th scope="row">Resizing the canvas</th>
            <td className="muted">
              <code>canvas.width = w</code>
            </td>
            <td>the worker resizes the surface it owns</td>
          </tr>
          <tr>
            <th scope="row">Putting the picture on screen</th>
            <td className="muted">read engine memory → copy → draw</td>
            <td>same code, in the back room, against its own memory</td>
          </tr>
          <tr>
            <th scope="row">Crosses the wall</th>
            <td className="muted">nothing</td>
            <td>one "go" message per frame, and nobody waits for a reply</td>
          </tr>
        </tbody>
      </table>

      <figure className="post__figure">
        <Scene kind="canvas" controls />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 4</span>
          <span>
            <strong>Yours to drive</strong>: play, scrub, or jump to any of the four beats. The surface
            leaves the page element and lands next to the engine; from then on pixels flow memory →
            screen without leaving the back room, and the only per-frame traffic is a "go" that nobody
            waits on.
          </span>
        </figcaption>
      </figure>

      <p>
        The back-room draw is the same dozen lines the front counter used to run, with the same two
        warnings attached. It has to look up where the pixels are on every call, because when the engine
        asks for more memory it gets a new block and every old pointer into the old one goes dead. And
        it copies the pixels into a private buffer before drawing, because drawing straight out of live
        memory while the engine is still writing to it is the "garbage after five strokes" bug Firefox
        taught me about.
      </p>

      <pre className="post__code">
        <code>
          <span className="tok-c">{"// engine.worker.ts: fire-and-forget, not routed through the queue"}</span>
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
        Notice what's <em>not</em> in there: no ticket number, no reply, no line to wait in. Drawing the
        picture changes nothing about the photo, so making it wait behind pending edits would delay what
        you see without protecting anything, and the round trip it would add is the exact lag this whole
        project exists to remove.
      </p>

      <h2 id="one-port">One line, in order</h2>

      <p>
        Everything that <em>does</em> change the photo goes through a single door and waits its turn in
        a strict line. That's not caution for its own sake. Image Horse's undo history is a ledger of
        edits, and the ledger records them <em>in the order they arrive</em>; no edit carries its own
        number. So the order messages arrive in has to <em>be</em> the order in the ledger, and that's only
        true while every edit goes through one door, one at a time. Picture a deli counter that hands out
        tickets but has three windows calling numbers at once: everyone gets served, nobody gets served
        in order, and now the ledger says you blurred the plate before you cropped the photo when you
        did it the other way round, and undo quietly takes back the wrong thing.
      </p>

      <p>
        Each request carries a ticket number that only ever counts up, so two requests in flight can't
        grab each other's answers; a request that's been overtaken can be canceled before it runs; and if
        the engine crashes, the request fails loudly instead of hanging forever. The first rough draft of
        this had none of those.
      </p>

      <figure className="post__figure">
        <Queue />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 5</span>
          <span>
            The gate that can say no. Edits sent without waiting land in the worker's line in the order
            they were sent and drain one at a time into the ledger; a canceled ticket is refused, not
            skipped. Run for real with 16 edits in flight at once, the back room's ledger came out
            byte-for-byte identical to the old front-counter one.
          </span>
        </figcaption>
      </figure>

      <table className="spec">
        <caption className="spec__caption">
          Gate 3, the pile-on: 16 edits fired at once without waiting, then 6 more aimed at their ticket
          numbers. Waiting politely for each one would have proven nothing.
        </caption>
        <thead>
          <tr>
            <th scope="col">
              <span className="visually-hidden">Measurement</span>
            </th>
            <th scope="col">Front counter</th>
            <th scope="col">Back room</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">ticket numbers returned</th>
            <td>1..16 in order</td>
            <td>1..16 in order</td>
          </tr>
          <tr>
            <th scope="row">edits · bytes</th>
            <td>
              <span className="fig">7 · 910</span>
            </td>
            <td>
              <span className="fig">7 · 910</span>
            </td>
          </tr>
          <tr>
            <th scope="row">ledger fingerprint</th>
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
        A rule like "all edits go through the one door" is the wrong kind of thing to remember and the
        right kind of thing to test, so there's a test that fails if anyone opens a second door, builds
        an engine somewhere else, or sneaks around the seam. All three were checked by breaking the code
        on purpose and watching the test go red.
      </p>

      <p>
        The rule also needed a correction five days in, and the correction is the interesting half. Two
        parts of the app legitimately build their own engine, batch export and the settings panel behind
        it, for a photo you are <em>not</em> currently editing. Sending those through the main door would
        put their edits in the open photo's ledger, so undo would replay changes to a photo you never
        opened, and a forty-photo batch would stand in line behind your one open image. The first
        version of the rule said "every edit," a test enforced exactly that, and the easiest way to make
        the test pass was to introduce the bug. The rule had to get more specific, not the code more
        obedient.
      </p>

      <p>
        One more thing the door had to get right. The front counter talks to the engine through a
        stand-in that forwards every call to the back room. A stand-in that says "sure, I have that" to
        every question would make every "does this build support X?" check in the app answer yes, for
        every X, forever. So at startup the worker reads the real engine's list of functions and sends it
        over, and the stand-in forwards only those names. A list the engine wrote about itself can't
        drift from the engine, and the test that asks for a function that doesn't exist and gets a "no"
        back is the row that proves the gate is live.
      </p>

      <h2 id="truthy">The IOU problem</h2>

      <p>
        Here's the part of this project that cost me the most sleep, and it never once produced an error
        message. When a call moves to the back room, you no longer get the answer back immediately. You
        get a promise, which is the JavaScript word for an IOU: "the answer is coming." If you've ever
        looked at derivatives, you already know the trap. A futures contract for a thousand barrels of
        oil is not a thousand barrels of oil, and if you check your warehouse by asking "do I have a
        piece of paper about oil?" the answer is always yes. The Dutch found that one out with tulip
        contracts in 1637 and it's been a reliable way to lose money ever since.
      </p>

      <p>
        In code, a guard like <code>if (!tool.has_source())</code> reads fine after the move. But if the{" "}
        <code>await</code> is missing, the thing being checked is now an IOU, and an IOU is never
        "nothing," so the guard always passes. Nothing throws, nothing logs, and the tool quietly does
        the exact thing the guard existed to prevent.
      </p>

      <p>
        The variants got worse the deeper I went. Turn an IOU into a list and you get an empty list,
        which also counts as "something," so a check written specifically to catch a missing value could
        never fire, and the math downstream turned a whole batch into <code>NaN</code>. One engine call
        reports whether a layer had text to bake in; un-awaited, it reads as "yes" after the first layer,
        so every export would have told you your redo history had been thrown away.
      </p>

      <p>
        TypeScript doesn't save you here, and the reason is worth writing down. A function that returns
        an IOU-for-a-number is allowed to sit in a slot that says "returns nothing," because an IOU
        you're going to ignore is, technically, nothing. One of the pen tool's handlers sat in exactly
        that kind of slot, so the move would have type-checked clean while a <code>typeof id ===
        "number"</code> check silently went false and pen paths stopped staying selected.
      </p>

      <blockquote className="post__quote post__quote--pull">
        <p>
          A <code>void</code> return is not proof that nothing is consumed.
        </p>
      </blockquote>

      <p>
        So I ratcheted it, the same way I ratcheted the file sizes in{" "}
        <Link to="/blog/entropy-is-the-default">the entropy post</Link>. A test pins the number of calls that
        still read the answer the old way, and that number may only go down; a script, not a hand-written
        list, is the authority on what's left; and every batch was checked by putting the bug back in
        and confirming a test turned red. Twice the tests caught something the script structurally
        couldn't see, because the script reads the line where the call is made, and a guard one line
        below it is invisible from there.
      </p>

      <h2 id="numbers">The numbers</h2>

      <p>
        Speed was never the obstacle. I measured the wall between the rooms before writing a line of the
        move, and the real obstacle turned out to be a counting problem.
      </p>

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
            <th scope="row">Round trip to the back room and back, empty message, 50 tries</th>
            <td>
              <span className="fig">0.100&nbsp;ms</span> median · 0.300 ms worst-of-20 ·{" "}
              <span className="muted">0.6% of a frame</span>
            </td>
          </tr>
          <tr>
            <th scope="row">Cold sharpen on a 48 MB photo, front counter vs back room</th>
            <td>
              468.6 ms → 483.6 ms (<span className="fig">1.03×</span>)
            </td>
          </tr>
          <tr>
            <th scope="row">Drawing one frame, back room vs front counter</th>
            <td>22.1 ms vs 23.9 ms</td>
          </tr>
          <tr>
            <th scope="row">Back-room warm-up, cold vs warmed up ahead of time</th>
            <td>
              715.4 ms vs <span className="fig">392.1&nbsp;ms</span>
            </td>
          </tr>
          <tr>
            <th scope="row">Places in the app that call the engine</th>
            <td>
              206 total: 77 don't need an answer · <span className="fig">117 read the answer</span> · 12 on
              the hot path
            </td>
          </tr>
          <tr>
            <th scope="row">Shared memory, special headers, threaded WebAssembly</th>
            <td className="muted">none needed</td>
          </tr>
          <tr>
            <th scope="row">Page freeze per heavy operation</th>
            <td>
              129–137 ms → <span className="fig">0</span>
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        The third door, shared memory, never got opened. It was tested and would have worked, but a back
        room that owns its own engine and swaps ownership of a few big things needs none of it, and this
        project had already tried multi-threaded WebAssembly once and dropped it at 8 to 31 times slower
        than the plain version. The simplest setup that could work is the one that shipped.
      </p>

      <h2 id="stages">Six stages, each one shippable</h2>

      <p>
        The plan was staged on purpose. Stages one and two added no worker and changed nothing you could
        see: they put every engine call behind a single door and removed the places that read and wrote
        engine memory in the same breath. Those were worth shipping even if everything after them had
        been abandoned, which is the point of doing them first. Stage three built the back room and left
        it switched off, and the build didn't even include it, because nothing used it yet. That got
        written down as the honest status rather than smoothed over.
      </p>

      <p>
        Every stage could be undone on its own, and the whole thing sat behind a switch that stayed off
        for five weeks. It became the default on September 18th, 2026, in v8.32.
      </p>

      <h2 id="see-it">See it yourself</h2>

      <p>
        The wall is a claim from a 2019 spec discussion, and browsers move. Paste this into the console
        of any page, in each browser you care about, and see which door it takes.
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
          <span className="tok-s">"copied silently, byteLength still"</span>
          {", m.buffer.byteLength);\n} "}
          <span className="tok-k">catch</span>
          {" (e) {\n  console.log("}
          <span className="tok-s">"threw:"</span>
          {", e.constructor.name, e.message);\n}"}
        </code>
      </pre>

      <p>
        And in the editor itself, the back room is the default for every photo. Add{" "}
        <code>?ih_engine_worker=0</code> to the URL to put a tab back on the front counter, run a blur
        on a big photo in each, and watch the pointer. It takes effect on the next load, like every kill
        switch in this app. It's there because a change this big should be something you can undo from
        your own browser without waiting on me for a release.
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

/* The header banner. FIG 1's scene, full-bleed and unlabeled, behind the
 * headline the shell renders — the shell owns the words, this owns what sits
 * under them. Wired up in registry.tsx.
 *
 * The same picture is the post's share card: scripts/gen-og-images.mjs loads
 * the built post, screenshots this scene, and lays the card over it. */
export function Topper() {
  return <Scene kind="threads" backdrop />;
}
