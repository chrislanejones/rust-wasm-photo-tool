/* "The hotel Wi-Fi died. The editor kept running."
 *
 * Body only — the headline, the deck, the dateline and the footer are the
 * shell's (pages/BlogPost.tsx). This file starts at the first paragraph. The
 * one thing it adds above that is `Topper`, the scene behind the shell's
 * headline, at the bottom of this file.
 *
 * Ported from Chris's Claude Design export (project "Image Horse Web Worker
 * Blog", file "Blog - Offline by Construction.dc.html") — structural mapping
 * onto this site's React components and CSS tokens only, not a rewrite. The
 * figures are offline-by-construction.figures.tsx / .scenes.ts, ported from
 * the same export's offline-diagrams.js.
 */

import { Link } from "react-router-dom";

import { external, repoFile } from "../config";
import { Scene } from "./offline-by-construction.figures";
import "./offline-by-construction.figures.css";

export default function OfflineByConstruction() {
  return (
    <>
      <p className="post__sourcenote">
        Describes what ships in v8.85. Everything below is read out of the repository —{" "}
        <a href={repoFile("docs/Architecture.md")} {...external}>
          Architecture.md
        </a>
        , the persistence code, and the ADRs it cites.
      </p>

      <p>
        A wound-care nurse photographs a dressing change on a ward tablet, circles the margin, drops
        an arrow on the thing the attending needs to see, and blurs the wristband. Halfway through,
        the tablet leaves the access point's reach — a lead-lined imaging suite, an elevator, the far bay
        nobody's Wi-Fi survey covered. In most web tools that is the moment the spinner appears and the
        last two minutes of work become a question.
      </p>

      <p>
        In Image Horse nothing happens. Not "it degrades gracefully" — nothing happens, because nothing
        in the editing path was ever on the wire. The engine that does the pixel work is a Rust program
        compiled to WebAssembly, running in a Web Worker inside the tab. The originals and every edit
        sit in the browser's IndexedDB. The network was only ever carrying sign-in, cloud sync and the
        optional AI jobs, and those go dark by themselves without taking the canvas with them.
      </p>

      <p>
        This post is how that falls out of the architecture instead of being bolted on: the worker,
        the op log on disk, and the one piece that's built but not switched on yet. Image
        Horse is an annotation tool, not a medical device, and nothing here claims otherwise. But the
        failure modes it was designed against are exactly the ones a hospital has.
      </p>

      <blockquote className="post__quote post__quote--pull">
        <p>Motel 5GHz: We'll keep the WAP on.</p>
      </blockquote>

      <h2 id="wire">What the wire was ever for</h2>

      <p>
        The honest way to talk about "offline" is to list what needs a network and what doesn't. I
        measured it instead of arguing it: the production build was served with every third-party origin
        blocked, and it booted to the same shell — <span className="fig">same 166 characters of UI text</span>,
        canvas present, nine buttons down to eight. The missing one was sign-in (
        <a href={repoFile("docs/adr/049-the-service-worker-is-blocked-on-eviction-reach-not-the-precache.md")} {...external}>
          ADR-049
        </a>
        ).
      </p>

      <table className="spec">
        <caption className="spec__caption">With the tab open and the network gone.</caption>
        <thead>
          <tr>
            <th scope="col">Keeps working</th>
            <th scope="col">Goes dark</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>The engine — every tool, every filter, every layer op, undo and redo</td>
            <td className="muted">Clerk sign-in</td>
          </tr>
          <tr>
            <td>Open a local file, paste, new canvas, the gallery</td>
            <td className="muted">Convex sync to your other devices</td>
          </tr>
          <tr>
            <td>Originals, edits and the op log in IndexedDB — surviving reload</td>
            <td className="muted">Replicate AI jobs (background removal, restore)</td>
          </tr>
          <tr>
            <td>Export — PNG on the Rust encoder, WebP/JPEG in the codec worker, EXIF/GPS scrub</td>
            <td className="muted">
              Sample Images (they live on <code>ufs.sh</code>)
            </td>
          </tr>
          <tr>
            <td>AI Rename with the on-device MobileCLIP model, once its 21.8 MB has loaded once</td>
            <td className="muted">Google Fonts (falls back to system type)</td>
          </tr>
        </tbody>
      </table>

      <p>
        The right-hand column is short because the logged-out path was never a degraded mode. Convex
        and Clerk are optional at build time; with no keys set the app runs fully local, and the docs
        are explicit that this is <em>a supported path and not a degraded one</em>. An offline Image
        Horse is that path with the sign-in button missing.
      </p>

      <figure className="post__figure">
        <Scene kind="cut" />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 1</span>
          <span>
            The cable goes mid-stroke. Strokes still reach the engine, blits still reach the canvas,
            saves still reach IndexedDB — none of those paths ever left the tab. Sync packets stop,
            sign-in pings stop, and the far side dims. When the wire comes back, held mutations replay.
          </span>
        </figcaption>
      </figure>

      <h2 id="in-the-tab">The engine lives in the tab</h2>

      <p>
        Since <span className="fig">v8.32</span> the engine — <code>stamp_tool</code>, 814,432 bytes of
        Rust compiled to WebAssembly — runs in a dedicated Web Worker.{" "}
        <Link to="/blog/engine-in-a-worker">The last post</Link> was about how it got there without ever
        sending a frame across a thread boundary. The part that matters here is simpler: the worker owns
        its own WASM instance and its own linear memory, and the composite is drawn straight onto an{" "}
        <code>OffscreenCanvas</code> that was transferred in once. No <code>SharedArrayBuffer</code>, no
        server, no round trip anywhere in the render path.
      </p>

      <p>
        That is a thread-boundary story, but it is also a network story, because the same property that
        made the pixels impossible to ship across a thread makes them pointless to ship across a
        network. A 1920×1080 RGBA frame is <span className="fig">7.9&nbsp;MiB</span>. Every editor that
        renders server-side has to move something like that, compressed, on every change — and on a ward
        with two bars of signal, that is the whole product. Here the pixels never move. Input goes in, a
        blit comes out, and the longest anything travels is from one side of the tab to the other, in{" "}
        <span className="fig">0.100&nbsp;ms</span>.
      </p>

      <aside className="post__callout">
        <p className="post__callout-title">The privacy half of the same fact</p>
        <p>
          Because the engine is in the tab, the photo of the patient is in the tab. It does not go to a
          rendering server, a thumbnail service or a model endpoint unless someone signs in and asks for
          the thing that needs one. Export can strip EXIF, GPS, XMP and IPTC before a file leaves the
          device, with a <code>location</code> mode that removes just the coordinates. For a clinical
          photo, "works offline" and "the image never left the room" are the same sentence.
        </p>
      </aside>

      <h2 id="truth">Truth is the original plus the op log</h2>

      <p>
        A worker that keeps running is half of it. A tablet on a ward gets locked, put down, and picked
        up by someone else; a battery dies mid-shift. Offline only counts if the work is still there
        afterward, and that is a storage question, not a compute one.
      </p>

      <p>
        Image Horse's storage story is <strong>local-first</strong> in the literal sense. Three things
        go into IndexedDB, and all three land there without a network:
      </p>

      <blockquote className="post__quote post__quote--pull">
        <p>The local copy is the truth. The cloud, if there is one, is a replica.</p>
      </blockquote>

      <table className="spec">
        <caption className="spec__caption">What is on the device, and how it got there.</caption>
        <thead>
          <tr>
            <th scope="col">Store</th>
            <th scope="col">Holds</th>
            <th scope="col">Written when</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Originals</th>
            <td className="muted">
              The bytes you imported, content-addressed by SHA-256, read through a Dexie adapter
            </td>
            <td>On import. Never modified.</td>
          </tr>
          <tr>
            <th scope="row">Working copy</th>
            <td className="muted">The ≤ 2048 px document the engine actually edits, plus its archive</td>
            <td>On import; refreshed by the save path. The fallback if the log can't be trusted.</td>
          </tr>
          <tr>
            <th scope="row">Op log</th>
            <td className="muted">
              <code>opLogs</code> chunks · <code>keyframes</code> as byte-exact PNG from the engine's own
              codec · an <code>oplogManifests</code> row with counts and the undo cursor
            </td>
            <td>
              <span className="fig">~2 s</span> after your last change, or at once when 25 ops pile up
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        The op log is the interesting one. The engine records every edit in arrival order;{" "}
        <code>oplogPersistence.ts</code> watches each flush, debounces, encodes everything <em>before</em>{" "}
        the transaction opens (IndexedDB auto-commits an idle transaction, so you cannot await inside
        one), then commits chunks, keyframes and manifest in a single <code>readwrite</code> — so the disk
        never holds half a save.
      </p>

      <pre className="post__code">
        <code>
          <span className="tok-c">{"// oplogPersistence.ts — encode first, then one transaction"}</span>
          {"\n"}
          <span className="tok-k">const</span>
          {" DEBOUNCE_MS = 2000;\n"}
          <span className="tok-k">const</span>
          {" OPS_PER_FORCED_SAVE = 25;\n\n"}
          <span className="tok-k">const</span>
          {" frames = "}
          <span className="tok-k">await</span>
          {" tool.oplog_encoded_ops(fromOp, len);\n"}
          <span className="tok-k">const</span>
          {" png    = "}
          <span className="tok-k">await</span>
          {" tool.oplog_keyframe_png(0);   "}
          <span className="tok-c">{"// engine codec, byte-exact"}</span>
          {"\n\n"}
          <span className="tok-k">await</span>
          {" db.transaction("}
          <span className="tok-s">"rw"</span>
          {", db.opLogs, db.keyframes, db.oplogManifests, "}
          <span className="tok-k">async</span>
          {" () => {\n  "}
          <span className="tok-k">if</span>
          {" (rewrite) { "}
          <span className="tok-k">await</span>
          {" db.opLogs.where("}
          <span className="tok-s">"photoId"</span>
          {").equals(photoId).delete(); "}
          <span className="tok-c">{"/* …keyframes too */"}</span>
          {" }\n  "}
          <span className="tok-k">await</span>
          {" db.opLogs.put(chunk);\n  "}
          <span className="tok-k">await</span>
          {" db.keyframes.bulkPut(dueKeyframes);\n  "}
          <span className="tok-k">await</span>
          {" db.oplogManifests.put({ photoId, opCount: len, cursor, stale: false, … });\n});"}
        </code>
      </pre>

      <p>
        Restore is the mirror image: manifest, chunks and the base keyframe come out, get validated
        against each other, and are handed to the engine's <code>oplog_restore</code>, which replays the
        ops and seeks the persisted cursor — so you come back with your undo history, not just your
        pixels. If any check fails, the answer is "none" rather than an exception, and the working copy —
        which never stopped writing — carries the resume. Two paths to the same document, neither of
        which involves a server.
      </p>

      <figure className="post__figure">
        <Scene kind="idb" controls />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 2</span>
          <span>
            <strong>Yours to drive</strong> — play, scrub, or jump to a beat. The round trip: ops
            accumulate in the worker, one transaction lands them in three IndexedDB stores, the tab
            dies, and the next open replays the log back into a fresh engine with the cursor where you
            left it.
          </span>
        </figcaption>
      </figure>

      <aside className="post__callout">
        <p className="post__callout-title">The bug that made this trustworthy</p>
        <p>
          A persisted log is only worth restoring if it still describes the document. Until{" "}
          <span className="fig">v8.36</span> an unrecorded edit — a clone stamp on a single-layer photo —
          left the log looking healthy, so a refresh replayed the document <em>without</em> the stamp. The
          fix counts instead of enumerating: every committed edit grows the undo stack, but only recorded
          edits advance the log's cursor, so <code>undo_count &gt; cursor</code> is arithmetic proof
          something is missing. The log is marked stale and the working copy takes the resume. The error
          direction of every other imbalance is a false invalidation — which costs an optimization, never
          data.
        </p>
      </aside>

      <h2 id="hospital">Why this is the shape a hospital needs</h2>

      <p>
        Hospitals are the hardest network environment most software will ever meet, and not because the
        network is bad. It is deliberately segmented, aggressively filtered, full of Faraday cages by
        design, and it goes down for maintenance at 3 a.m. because that is when the fewest people are on
        it. A tool that treats connectivity as a precondition for editing fails in all of those places at
        once. Take them one at a time:
      </p>

      <table className="spec">
        <caption className="spec__caption">The failure, and what the architecture does about it.</caption>
        <thead>
          <tr>
            <th scope="col">Where</th>
            <th scope="col">What breaks</th>
            <th scope="col">What holds</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Imaging suite</th>
            <td className="muted">Shielded room. Wi-Fi stops at the door; the tablet came in with the patient.</td>
            <td>Engine in the tab. Annotate, crop, blur, export — all local. Sync resumes in the hallway.</td>
          </tr>
          <tr>
            <th scope="row">Rounds</th>
            <td className="muted">
              Roaming between access points; the device is locked and unlocked forty times a shift.
            </td>
            <td>
              Op log in IndexedDB within <span className="fig">~2 s</span> of every change. A dead
              battery costs at most the last two seconds.
            </td>
          </tr>
          <tr>
            <th scope="row">Operating room</th>
            <td className="muted">Locked-down network: third-party origins blocked at the firewall, no exceptions.</td>
            <td>
              The measured case above: same shell, sign-in gone, everything else present. Nothing in the
              edit path needs a domain on an allow-list.
            </td>
          </tr>
          <tr>
            <th scope="row">Two screens, one bay</th>
            <td className="muted">
              The same photo open on the wall display and the handheld; both need to agree on settings.
            </td>
            <td>
              Cross-tab sync rides a <code>BroadcastChannel</code> — on-device, instant, no account, works
              offline.
            </td>
          </tr>
          <tr>
            <th scope="row">Patient privacy</th>
            <td className="muted">A photo with a face, a wristband and GPS coordinates in its EXIF.</td>
            <td>
              Pixels never leave the tab unless you sign in and ask. Metadata scrub runs on every export
              path before bytes leave the device.
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        The same column of answers applies to a field researcher on a boat, a court clerk in a basement,
        an inspector in a plant that jams its own radio. The hospital is the sharpest version because the
        cost of "please reconnect to continue" is measured in someone else's time.
      </p>

      <p>
        Here's where offline tools usually cheat. When the
        wire comes back, a signed-in user's device does not simply overwrite the cloud. Sync is a
        compare-and-set on the revision the change was based on, so a mutation Convex queued while
        offline <em>cannot land on top of newer work</em> from another device. Photo edits are
        deliberately outside that layer for now (
        <a href={repoFile("docs/adr/061-sync-is-a-document-layer-and-the-archive-is-not-in-it.md")} {...external}>
          ADR-061
        </a>
        ) — replicating an op log is a different problem, and it is written down as one rather than
        half-solved.
      </p>

      <h2 id="last-mile">The last mile: the shell itself</h2>

      <p>
        Everything above holds once the tab is open. The remaining gap is the boot: today a fresh
        navigation still fetches the app shell — <span className="fig">~3.6&nbsp;MB across 9 assets</span>,
        the engine among them — from the origin. Close the tab in the shielded room and you can't reopen
        it until you're back in range, even though every byte of your work is sitting in IndexedDB.
      </p>

      <p>
        The answer is a precache-only service worker, and it is built:{" "}
        <a href={repoFile("docs/adr/019-opt-in-precache-service-worker.md")} {...external}>
          ADR-019
        </a>{" "}
        decided its shape in July, the code is in the tree, and five end-to-end tests exercise
        registration, precache contents, offline reload and the build-skew guard. It ships dark for now
        — activation is gated on running those tests in CI and rehearsing the rollback path, per{" "}
        <a href={repoFile("docs/adr/049-the-service-worker-is-blocked-on-eviction-reach-not-the-precache.md")} {...external}>
          ADR-049
        </a>{" "}
        — because a wrong service worker is the worst bug class a web app can ship: it strands users on a
        stale build invisibly. The design is worth walking through because most of it is about{" "}
        <em>not</em> caching things.
      </p>

      <table className="spec">
        <caption className="spec__caption">What the precache does, and refuses to do.</caption>
        <thead>
          <tr>
            <th scope="col">Property</th>
            <th scope="col">Setting</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Strategy</th>
            <td>
              <code>precache only · zero runtimeCaching</code>
            </td>
            <td className="muted">
              Build-hashed immutable assets are the only cache with a correctness proof. Clerk, Convex and
              share URLs pass straight through — stale auth or a stale document is worse than no cache.
            </td>
          </tr>
          <tr>
            <th scope="row">Update</th>
            <td>
              <code>registerType: "prompt" · no skipWaiting</code>
            </td>
            <td className="muted">
              A new build waits for an explicit Reload. Swapping code under an active editing session is
              the exact failure this app cannot have.
            </td>
          </tr>
          <tr>
            <th scope="row">Skew guard</th>
            <td>
              <code>version.json · never cached · no-store</code>
            </td>
            <td className="muted">
              Compared against the bundle's own hash at boot <em>and at engine init</em> — where stale
              WASM would start work. A cached copy can never agree with cached JS by construction.
            </td>
          </tr>
          <tr>
            <th scope="row">Long sessions</th>
            <td>
              <code>registration.update() hourly</code>
            </td>
            <td className="muted">
              Browsers only check for a new worker on navigation, and an editing session never navigates.
            </td>
          </tr>
          <tr>
            <th scope="row">Escape hatch</th>
            <td>
              <code>VITE_ENABLE_SW=kill</code>
            </td>
            <td className="muted">
              A self-destructing <code>sw.js</code> that wipes caches, unregisters and reloads. The only
              correct way off once "on" has shipped — never unsetting the flag.
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        With it on, a repeat load serves the shell and the engine from Cache Storage and asks the network
        for exactly one small file. With the network gone, it asks for nothing and boots anyway.
      </p>

      <blockquote className="post__quote post__quote--pull">
        <p>
          The work is on the device, the engine is on the device, and the program that runs the engine
          is on the device too.
        </p>
      </blockquote>

      <figure className="post__figure">
        <Scene kind="cache" controls />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 3</span>
          <span>
            <strong>Yours to drive.</strong> First visit fills Cache Storage from the origin. Repeat loads
            come from the cache, with <code>version.json</code> the one thing still fetched live. Offline,
            the origin goes dark and the tab boots from the cache alone. Built and tested; dark until
            ADR-049's gates are done.
          </span>
        </figcaption>
      </figure>

      <h2 id="see-it">See it yourself</h2>

      <p>
        Open the editor, drop in a photo, and then cut the cord: DevTools → Network → <strong>Offline</strong>,
        or airplane mode. Keep working — paint, blur, add text, undo. Then watch the persistence land:
      </p>

      <pre className="post__code">
        <code>
          <span className="tok-c">{"// DevTools → Application → IndexedDB, or from the console:"}</span>
          {"\n"}
          <span className="tok-k">const</span>
          {" req = indexedDB.open("}
          <span className="tok-s">"image-horse"</span>
          {");\nreq.onsuccess = () => console.log([...req.result.objectStoreNames]);\n"}
          <span className="tok-c">
            {"// → opLogs, keyframes, oplogManifests, originals, … — written with the network off"}
          </span>
        </code>
      </pre>

      <p>
        Reconnect, refresh, and the document comes back with its undo stack. (Refreshing <em>while</em>{" "}
        offline is the one thing that still needs the wire today — that is the shell fetch the precache
        exists to remove.) To watch the engine specifically, <code>ih_engine_worker=0</code> in
        localStorage puts it back on the main thread on next load; the work stays local either way —
        slower under load, never wrong.
      </p>

      <p className="post__actions">
        <a className="cta cta--fill" href="https://edit.imagehorse.app" {...external}>
          Open the beta
        </a>
        <a className="cta" href={repoFile("app/src/lib/oplogPersistence.ts")} {...external}>
          Read oplogPersistence.ts
        </a>
      </p>

      <p className="post__sources">
        Sources:{" "}
        <a href={repoFile("docs/Architecture.md")} {...external}>
          Architecture.md
        </a>{" "}
        ·{" "}
        <a href={repoFile("app/src/lib/oplogPersistence.ts")} {...external}>
          oplogPersistence.ts
        </a>{" "}
        ·{" "}
        <a href={repoFile("docs/adr/024-engine-in-a-worker.md")} {...external}>
          ADR-024
        </a>{" "}
        ·{" "}
        <a href={repoFile("docs/adr/019-opt-in-precache-service-worker.md")} {...external}>
          ADR-019
        </a>{" "}
        ·{" "}
        <a href={repoFile("docs/adr/049-the-service-worker-is-blocked-on-eviction-reach-not-the-precache.md")} {...external}>
          ADR-049
        </a>{" "}
        ·{" "}
        <a href={repoFile("docs/adr/061-sync-is-a-document-layer-and-the-archive-is-not-in-it.md")} {...external}>
          ADR-061
        </a>{" "}
        ·{" "}
        <a href={repoFile("app/src/lib/pwa/swBoot.ts")} {...external}>
          swBoot.ts
        </a>{" "}
        ·{" "}
        <a
          href="https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Offline_and_background_operation"
          {...external}
        >
          MDN, Offline and background operation
        </a>
      </p>

      <p className="post__kicker">The wire carries the extras. The work never needed it.</p>
    </>
  );
}

/* The header banner. FIG 1's scene, full-bleed and unlabeled, behind the
 * headline the shell renders. Wired up in registry.tsx. */
export function Topper() {
  return <Scene kind="cut" backdrop />;
}
