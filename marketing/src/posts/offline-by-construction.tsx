/* "The hotel Wi-Fi died. The editor kept running."
 *
 * Body only — the headline, the deck, the dateline and the footer are the
 * shell's (pages/BlogPost.tsx). This file starts at the first paragraph. The
 * one thing it adds above that is `Topper`, the scene behind the shell's
 * headline, at the bottom of this file.
 *
 * REWRITTEN 10-13-2026 at Chris's request, for a reader who is not deep in the
 * stack. Same facts, same figures and tables, plainer words. Two framing
 * changes, both his: the hospital is a "could use this" example, not the
 * product's target, and the clinical detail is gone. The narration mp3 still
 * was re-recorded from the new text the same day (Emma, widened stereo, edge-tts 7.3.1).
 *
 * Originally ported from Chris's Claude Design export (project "Image Horse
 * Web Worker Blog", file "Blog - Offline by Construction.dc.html"). The
 * figures are offline-by-construction.figures.tsx / .scenes.ts, ported from
 * the same export's offline-diagrams.js.
 */

import { Link } from "react-router";

import { external, repoFile } from "../config";
import { Scene } from "./offline-by-construction.figures";
import PostAudio from "../components/PostAudio";

export default function OfflineByConstruction() {
  return (
    <>
      <p className="post__sourcenote">
        Describes what ships in v8.85. Everything below is read out of the repository:{" "}
        <a href={repoFile("docs/Architecture.md")} {...external}>
          Architecture.md
        </a>
        , the code that saves your work, and the decision records it cites.
      </p>
      <PostAudio src="/audio/offline-by-construction.mp3" minutes={12} />

      <p>
        I was editing a photo in a hotel room, the kind of hotel where the Wi-Fi password is on a laminated
        card and the card is lying. Halfway through blurring a license plate the little Wi-Fi icon went
        gray. In most web tools that's the moment the spinner shows up and the last two minutes of your
        work turn into a question.
      </p>

      <p>
        In Image Horse, nothing happened. Not "it coped." Nothing happened, because nothing in the editing
        path was ever using the internet in the first place. The engine that does the pixel work is a
        program running inside the browser tab, in its own back room. Your photos and every edit you make
        to them are stored in the browser's own filing cabinet. The internet was only ever carrying
        sign-in, cloud sync and the optional AI jobs, and those go dark on their own without taking the
        photo with them.
      </p>

      <p>
        Here's my Azerbaijan fact for this post, and you're getting it whether you asked or not: the
        Caspian Sea, which Azerbaijan sits on, is legally a lake. It was always a lake. We called it a sea
        for so long that the name stuck. "Offline mode" is the same kind of name. There's no mode. The
        editor was never online.
      </p>

      <blockquote className="post__quote post__quote--pull">
        <p>Motel 5GHz: We'll keep the WAP on.</p>
      </blockquote>

      <h2 id="wire">What the internet was ever for</h2>

      <p>
        The honest way to talk about offline is to list what needs a connection and what doesn't, so I
        measured it instead of arguing it. I served the real production build with every outside server
        blocked, and it booted to the same screen: <span className="fig">the same 166 characters of UI
        text</span>, canvas present, nine buttons down to eight. The missing one was sign-in (
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
            <td>The engine: every tool, every filter, every layer, undo and redo</td>
            <td className="muted">Sign-in</td>
          </tr>
          <tr>
            <td>Open a file, paste, new canvas, the gallery</td>
            <td className="muted">Sync to your other devices</td>
          </tr>
          <tr>
            <td>Your originals, edits and history, saved in the browser and surviving a reload</td>
            <td className="muted">The AI jobs that run on a server (background removal, restore)</td>
          </tr>
          <tr>
            <td>Export: PNG, WebP, JPEG, and stripping the location data out of a photo</td>
            <td className="muted">
              Sample Images (they live on <code>ufs.sh</code>)
            </td>
          </tr>
          <tr>
            <td>AI Rename with the on-device model, once its 21.8 MB has loaded one time</td>
            <td className="muted">Google Fonts (the system font steps in)</td>
          </tr>
        </tbody>
      </table>

      <p>
        The right-hand column is short because logged-out was never a lesser version of the app. The
        account and sync pieces are optional even at build time; with no keys set, the whole thing runs
        on your device, and the docs say in so many words that this is <em>a supported path and not a
        degraded one</em>. Offline Image Horse is that path with the sign-in button missing.
      </p>

      <figure className="post__figure">
        <Scene kind="cut" />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 1</span>
          <span>
            The cable goes mid-stroke. Strokes still reach the engine, the picture still reaches the
            screen, saves still reach the filing cabinet; none of those ever left the tab. Sync stops,
            sign-in stops, and the far side dims. When the cable comes back, the held-up sync goes out.
          </span>
        </figcaption>
      </figure>

      <h2 id="in-the-tab">The engine lives in the tab</h2>

      <p>
        Since <span className="fig">v8.32</span> the engine, <code>stamp_tool</code>, 814,432 bytes of
        Rust compiled to WebAssembly, has run in a Web Worker. If that phrase means nothing to you: a
        browser tab normally has one employee, and that one employee answers every click, draws every
        pixel and does every calculation. A Web Worker is a second employee in a back room who can do the
        heavy lifting while the first one keeps the counter open.{" "}
        <Link to="/blog/engine-in-a-worker">The last post</Link> was about how the engine got into the
        back room. The part that matters here is simpler: the back room has its own memory and draws
        straight onto the screen through a window that was handed to it once. No server anywhere in the
        chain.
      </p>

      <p>
        That matters for the network for the same reason it mattered for the back room. A single HD
        frame of a photo is <span className="fig">7.9&nbsp;MiB</span>. Any editor that does its work on a
        server has to ship something like that, squashed down, every time you change something, and on
        two bars of hotel signal that <em>is</em> the whole product. Here the pixels don't travel. A
        stroke goes in, a picture comes out, and the longest trip anything takes is from one side of the
        tab to the other, in <span className="fig">0.100&nbsp;ms</span>.
      </p>

      <aside className="post__callout">
        <p className="post__callout-title">The privacy half of the same fact</p>
        <p>
          Because the engine is in the tab, the photo is in the tab. It doesn't go to a rendering server,
          a thumbnail service or an AI model unless you sign in and ask for the thing that needs one. And
          when you export, the editor can strip the hidden metadata (camera, date, GPS) before the file
          leaves your device, including a mode that removes just the coordinates. "Works offline" and
          "the photo never left the room" turn out to be the same sentence.
        </p>
      </aside>

      <h2 id="truth">The original plus the receipts</h2>

      <p>
        An engine that keeps running is half of it. Laptops get closed, tablets get locked and put down,
        batteries die. Offline only counts if the work is still there afterward, and that's a storage
        question, not a speed question.
      </p>

      <p>
        Image Horse is <strong>local-first</strong> in the literal sense. Three things go into the
        browser's filing cabinet, IndexedDB, and all three land there without a network:
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
            <td className="muted">The exact bytes you imported, filed under their own fingerprint</td>
            <td>On import. Never changed after.</td>
          </tr>
          <tr>
            <th scope="row">Working copy</th>
            <td className="muted">The version the engine actually edits (2048 px on the long side)</td>
            <td>On import; refreshed on save. The fallback if the history can't be trusted.</td>
          </tr>
          <tr>
            <th scope="row">Op log</th>
            <td className="muted">
              Every edit, in order, plus a snapshot to replay them against, plus a note of where your undo
              cursor is
            </td>
            <td>
              <span className="fig">~2 s</span> after your last change, or at once when 25 edits pile up
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        The op log is the interesting one, and the easiest way to think about it is a bank statement.
        The statement doesn't store your balance. It stores the opening balance and every transaction
        since, and the balance falls out of that. The Dutch figured this out in the 1600s, when the
        Amsterdam exchange was trading shares of ships that were still at sea: what you trust isn't the
        cargo, it's the ledger. Image Horse keeps the ledger. The engine records every edit as it arrives;
        the save code waits for a two-second lull, packs everything up <em>before</em> it opens the file
        drawer (the browser slams that drawer shut if you pause with it open), and then writes the edits,
        the snapshot and the cursor note in one motion, so the disk never holds half a save.
      </p>

      <pre className="post__code">
        <code>
          <span className="tok-c">{"// oplogPersistence.ts: pack first, then one write"}</span>
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
          {" tool.oplog_keyframe_png(0);\n\n"}
          <span className="tok-k">await</span>
          {" db.transaction("}
          <span className="tok-s">"rw"</span>
          {", db.opLogs, db.keyframes, db.oplogManifests, "}
          <span className="tok-k">async</span>
          {" () => {\n  "}
          <span className="tok-k">await</span>
          {" db.opLogs.put(chunk);\n  "}
          <span className="tok-k">await</span>
          {" db.keyframes.bulkPut(dueKeyframes);\n  "}
          <span className="tok-k">await</span>
          {" db.oplogManifests.put({ photoId, opCount: len, cursor, stale: false, … });\n});"}
        </code>
      </pre>

      <p>
        Opening the photo again is the same thing in reverse: the note, the edits and the snapshot come
        out, get checked against each other, and the engine replays the edits and parks the undo cursor
        where you left it. You come back with your undo history, not just your pixels. If any check
        fails, the answer is "no history" rather than a crash, and the working copy, which never stopped
        saving, carries you through. Two roads to the same photo, and neither one goes through a server.
      </p>

      <figure className="post__figure">
        <Scene kind="idb" controls />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 2</span>
          <span>
            <strong>Yours to drive</strong>: play, scrub, or jump to a beat. Edits pile up in the back
            room, one write lands them in three drawers, the tab dies, and the next open replays the
            ledger into a fresh engine with the cursor where you left it.
          </span>
        </figcaption>
      </figure>

      <aside className="post__callout">
        <p className="post__callout-title">The bug that made this trustworthy</p>
        <p>
          A ledger is only worth replaying if it's complete. Until <span className="fig">v8.36</span>,
          one kind of edit (a clone stamp on a single-layer photo) wasn't being recorded, so the ledger
          looked healthy and a refresh brought the photo back <em>without</em> the stamp. The fix counts
          instead of trusting: every edit grows the undo stack, but only recorded edits move the ledger's
          cursor, so if the undo stack is longer than the cursor, something's missing, full stop. The
          ledger gets marked stale and the working copy takes over. Every other way the two numbers could
          disagree errs toward throwing out a good ledger, which costs a shortcut, never your work.
        </p>
      </aside>

      <h2 id="hospital">The hardest building to be online in</h2>

      <p>
        I'm not planning to sell Image Horse to hospitals. But I keep coming back to them as the test
        case, because a hospital is the hardest network most software will ever meet, and not because the
        network is bad. It's split into zones on purpose, filtered hard, full of rooms that are shielded
        by design, and it goes down for maintenance at 3 a.m. because that's when the fewest people are
        on it. A tool that needs a connection in order to edit fails in every one of those places at
        once. This is what the back room and the ledger buy you there, and this part is really about
        every job where the signal is unreliable, which is a lot of jobs:
      </p>

      <table className="spec">
        <caption className="spec__caption">The failure, and what holds.</caption>
        <thead>
          <tr>
            <th scope="col">Where</th>
            <th scope="col">What breaks</th>
            <th scope="col">What holds</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">Shielded room</th>
            <td className="muted">Wi-Fi stops at the door; the tablet came in anyway.</td>
            <td>Engine in the tab. Crop, blur, mark up, export, all local. Sync resumes in the hallway.</td>
          </tr>
          <tr>
            <th scope="row">Walking the floor</th>
            <td className="muted">Hopping between access points; the device gets locked and unlocked forty times a shift.</td>
            <td>
              Ledger saved within <span className="fig">~2 s</span> of every change. A dead battery costs
              you two seconds, tops.
            </td>
          </tr>
          <tr>
            <th scope="row">Locked-down network</th>
            <td className="muted">Outside servers blocked at the firewall, no exceptions.</td>
            <td>
              The measured case above: same screen, sign-in gone, everything else there. Nothing in the
              edit path needs a domain on an allow-list.
            </td>
          </tr>
          <tr>
            <th scope="row">Two screens, one room</th>
            <td className="muted">The same photo open on the wall display and the handheld.</td>
            <td>The two tabs talk to each other on the device, instantly, with no account and no signal.</td>
          </tr>
          <tr>
            <th scope="row">Privacy</th>
            <td className="muted">A photo with a face in it and GPS coordinates hidden inside the file.</td>
            <td>
              Pixels never leave the tab unless you sign in and ask. Metadata gets stripped on every export
              before the bytes leave the device.
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        The same column of answers works for a researcher on a boat, a clerk in a basement, an inspector
        in a plant that jams its own radio, and me in that hotel. The hospital is just the sharpest
        version, because there "please reconnect to continue" costs someone else's time.
      </p>

      <p>
        Here's where offline tools usually cheat. When the connection comes back, a signed-in device
        doesn't just overwrite the cloud with whatever it has. Every sync change says which version it was
        based on, so a change you made offline <em>can't land on top of newer work</em> from your other
        laptop. Photo edits themselves stay out of that layer for now (
        <a href={repoFile("docs/adr/061-sync-is-a-document-layer-and-the-archive-is-not-in-it.md")} {...external}>
          ADR-061
        </a>
        ); syncing a ledger between two devices is a different problem, and it's written down as one
        instead of half-solved.
      </p>

      <h2 id="last-mile">The last mile: the app itself</h2>

      <p>
        Everything above holds once the tab is open. The gap that's left is the open: today a fresh visit
        still downloads the app, <span className="fig">~3.6&nbsp;MB across 9 files</span>, engine
        included, from the server. Close the tab in the shielded room and you can't reopen it until
        you're back in range, even though every byte of your work is sitting right there on the device.
        It's like owning the whole toolbox and still needing the power company to open the garage door.
      </p>

      <p>
        The answer is a service worker that keeps a copy of the app on the device, and it's built:{" "}
        <a href={repoFile("docs/adr/019-opt-in-precache-service-worker.md")} {...external}>
          ADR-019
        </a>{" "}
        decided its shape in July, the code is in the tree, and five end-to-end tests cover it. It's
        shipping switched off for now, until those tests run in CI and the rollback has been rehearsed (
        <a href={repoFile("docs/adr/049-the-service-worker-is-blocked-on-eviction-reach-not-the-precache.md")} {...external}>
          ADR-049
        </a>
        ), because a wrong service worker is the worst bug a web app can ship: it leaves people stuck on
        an old version and nobody can tell. Most of the design is about what it <em>refuses</em> to cache.
      </p>

      <table className="spec">
        <caption className="spec__caption">What the cached copy does, and refuses to do.</caption>
        <thead>
          <tr>
            <th scope="col">Property</th>
            <th scope="col">Setting</th>
            <th scope="col">Why</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <th scope="row">What it caches</th>
            <td>
              <code>precache only · zero runtimeCaching</code>
            </td>
            <td className="muted">
              Only the app's own files, which carry a fingerprint in their name and never change. Sign-in,
              sync and share links go straight to the network; a stale login or a stale document is worse
              than no cache.
            </td>
          </tr>
          <tr>
            <th scope="row">Updates</th>
            <td>
              <code>registerType: "prompt" · no skipWaiting</code>
            </td>
            <td className="muted">
              A new version waits for you to click Reload. Swapping the app out from under you mid-edit is
              the exact failure this app can't have.
            </td>
          </tr>
          <tr>
            <th scope="row">Mismatch guard</th>
            <td>
              <code>version.json · never cached · no-store</code>
            </td>
            <td className="muted">
              One tiny file is always fetched live and compared against the app's own version, at boot and
              again when the engine starts. A cached copy can never agree with cached code by accident.
            </td>
          </tr>
          <tr>
            <th scope="row">Long sessions</th>
            <td>
              <code>registration.update() hourly</code>
            </td>
            <td className="muted">
              Browsers only look for a new version when you navigate, and an editing session never
              navigates.
            </td>
          </tr>
          <tr>
            <th scope="row">Escape hatch</th>
            <td>
              <code>VITE_ENABLE_SW=kill</code>
            </td>
            <td className="muted">
              A self-destruct version that wipes the cache, unregisters itself and reloads. The only safe
              way back off once "on" has shipped. Just turning the flag off isn't.
            </td>
          </tr>
        </tbody>
      </table>

      <p>
        With it on, a repeat visit loads the app and the engine from the device and asks the network for
        exactly one small file. With no network, it asks for nothing and opens anyway.
      </p>

      <blockquote className="post__quote post__quote--pull">
        <p>
          The work is on the device, the engine is on the device, and the program that runs the engine is
          on the device too.
        </p>
      </blockquote>

      <figure className="post__figure">
        <Scene kind="cache" controls />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 3</span>
          <span>
            <strong>Yours to drive.</strong> First visit fills the cache from the server. Repeat visits
            come from the cache, with <code>version.json</code> the one thing still fetched live. Offline,
            the server goes dark and the tab opens from the cache alone. Built and tested; off until
            ADR-049's gates are done.
          </span>
        </figcaption>
      </figure>

      <h2 id="see-it">See it yourself</h2>

      <p>
        Open the editor, drop in a photo, then cut the cord: DevTools → Network → <strong>Offline</strong>,
        or airplane mode. Keep working: paint, blur, add text, undo. Then watch the save land:
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
            {"// → opLogs, keyframes, oplogManifests, originals, … all written with the network off"}
          </span>
        </code>
      </pre>

      <p>
        Reconnect, refresh, and the photo comes back with its undo history. (Refreshing <em>while</em>{" "}
        offline is the one thing that still needs a signal today; that's the download the cached copy
        exists to remove.) If you want to watch the back room specifically, set{" "}
        <code>ih_engine_worker=0</code> in localStorage and the engine moves back to the front counter on
        the next load. The work stays on your device either way: slower under load, never wrong.
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

      <p className="post__kicker">The internet carries the extras. The work never needed it.</p>
    </>
  );
}

/* The header banner. FIG 1's scene, full-bleed and unlabeled, behind the
 * headline the shell renders. Wired up in registry.tsx. */
export function Topper() {
  return <Scene kind="cut" backdrop />;
}
