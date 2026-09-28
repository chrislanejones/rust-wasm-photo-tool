/* "We spent a month taking the file apart. It got 556 lines longer."
 *
 * Body only — the headline, the deck, the dateline and the footer belong to
 * the shell (pages/BlogPost.tsx). This file starts at the first paragraph and
 * ends with `Topper`, the scene behind the shell's headline.
 *
 * EVERY NUMBER HERE IS MEASURED, and each one can be checked against the
 * repository at the commit named beside it:
 *
 *   3,250  AppShell.tsx at d3366c33 (27 July 2026)
 *   3,806  AppShell.tsx at eac21532 (27 August) — the commit that pinned caps
 *   3,564  AppShell.tsx on master today — 242 under the peak, and still
 *          314 OVER the July figure, which the closing section says plainly
 *
 * The two endpoints are exactly a month apart and each is a real commit, which
 * is why they are these two. eslint.config.mjs's own header says "3,314 ->
 * 3,806"; no commit in that window has 3,314 lines, so the post uses the
 * measured pair rather than repeating a figure that cannot be checked.
 *   the five pinned caps, their 27-August values and today's: eslint.config.mjs
 *   the retired Rust ratchet and its reason: scripts/guardrails.sh
 *
 * The design this was drawn from carried two figures that did not survive
 * checking, and both are corrected here rather than quietly dropped:
 *
 *  1. It listed AppShell's pinned cap as 3,718 and CanvasArea's as 2,909.
 *     The commit that pinned them says 3,806 and 2,959; 3,718 and 2,909 were
 *     later values on the way down.
 *  2. Its closing figure animated the `librs-lines` ratchet on src/lib.rs as
 *     the mechanism that worked. That ratchet was RETIRED on 25 September,
 *     and guardrails.sh says why. Leaving it in would have been the post
 *     arguing for a thing this repo had already decided against, which is a
 *     worse failure than an out-of-date number.
 *
 * Three figures, all WebGL, in entropy.figures.tsx. three.js is loaded lazily
 * and only on this page.
 */

import { external, repoFile } from "../config";
import { Scene } from "./entropy.figures";

export default function EntropyIsTheDefault() {
  return (
    <>
      {/* The receipts before the argument, as the other posts do it. Every
          number below is in one of these two files. */}
      <p className="post__sourcenote">
        Every figure below is read out of a file that is in the tree — the caps and their history from{" "}
        <a href={repoFile("eslint.config.mjs")} {...external}>
          eslint.config.mjs
        </a>
        , the ratchet that was retired and the reason from{" "}
        <a href={repoFile("scripts/guardrails.sh")} {...external}>
          scripts/guardrails.sh
        </a>
        . Nothing here is estimated, and nothing is rounded to make a better point.
      </p>

      <p>
        On 27 July, <code>AppShell.tsx</code> was <span className="fig">3,250</span> lines. On 27 August
        it was <span className="fig">3,806</span>. In between, it was being taken apart on purpose:
        handlers moved into session hooks, flags moved into stores, whole domains left the file. The
        extraction was real and it was working. The file still grew by{" "}
        <span className="fig">556</span> lines.
      </p>

      <p>
        That is what code entropy actually looks like. Not a bad commit — there wasn't one. Not neglect
        — the file was being worked on constantly. Accretion simply outpaced extraction for a month,
        and nothing in the build said so out loud.
      </p>

      <figure className="post__figure">
        <Scene kind="giants" />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 1</span>
          <span>
            The five files past 900 lines, with the 31 primitives in{" "}
            <code>components/ui/</code> for scale — none of those has ever crossed it. The tall one
            moves: it grows to July's 3,250, keeps growing to 3,806 <em>through</em> the month it was
            being dismantled, and comes down to today's 3,564 only once the cap became an error.
          </span>
        </figcaption>
      </figure>

      <h2 id="gravity">A large file is a gravity well</h2>

      <p>
        Once one component owns the upload flow, the gallery, the canvas, the tools, history, export,
        dialogs and zoom, the cheapest place to put the next thing is that component. It already has
        the state. It already has the handlers. Every individual decision to add one more thing there
        is correct on the day, and the sum of those correct decisions is a file nobody can hold in
        their head.
      </p>

      <p>
        The same shape shows up in the interface, at pixel scale. A primitive exists in{" "}
        <code>components/ui/</code>. Nine surfaces need it. Some import it; some paste the markup,
        because pasting was faster that afternoon. Nothing then changes on purpose — one copy inherits
        a size from its neighbour, another picks up a different one to match a rail, a third swaps the
        shared tooltip for a <code>title</code> attribute. Months later the sizes disagree by six
        pixels in three places and no one commit did it.
      </p>

      <figure className="post__figure">
        <Scene kind="drift" controls />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 2</span>
          <span>
            Schematic, not a census: the surfaces are real, the count is the shape of the problem. The
            part that matters is the last beat — a fix lands in the primitive and reaches the three
            call sites that imported it. The six that pasted are exactly the places the next fix will
            not reach either.
          </span>
        </figcaption>
      </figure>

      <h2 id="ratchet">The fix had to be a number, not a rule</h2>

      <p>
        "Keep files small" is not enforceable. It has no threshold, so it is never violated, and a
        review that mentions it is a matter of taste. What worked was narrower and duller: on 27
        August every file already past 900 lines was pinned at <em>its exact size that day</em> — not
        a round number, its measured size — and the rule became that the number may only go down.
      </p>

      <p>
        The important half is the second sentence in{" "}
        <a href={repoFile("eslint.config.mjs")} {...external}>
          the config
        </a>
        : when an extraction lands, that file's number drops to its new size{" "}
        <em>in the same commit</em>. The cap follows the file down and never drifts back up. Raising
        one is not a fix; it is the ratchet being unbolted.
      </p>

      <p>
        We made them warnings first. That was the mistake. A warning is a number in a list nobody
        reads, and for a month three of the five files sat above their caps with a green build. They
        became errors on 26 September, and the three files went back under in the same change.
      </p>

      <figure className="post__figure">
        <Scene kind="ratchet" controls />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 3</span>
          <span>
            The five, from the sizes pinned on 27 August to today's. Four came down. One went up — and
            is drawn going up.
          </span>
        </figcaption>
      </figure>

      <h2 id="up">The one that went up</h2>

      <p>
        The async contract test is <span className="fig">1,015</span> → <span className="fig">1,027</span>
        . A branch that had lowered caps met a master that had added a feature and two interface passes
        to the same files, so the merged file was larger than either side intended. The number went up
        by twelve.
      </p>

      <p>
        It is written into the config as merge arithmetic, with the reasoning next to it, because the
        failure mode of a ratchet is not a cap that moves — it is a cap that moves <em>quietly</em>. A
        raise nobody can see is indistinguishable from the rule not existing. The test for whether a
        ratchet is working is not "has the number ever gone up", it is "when it went up, did anyone
        have to say why".
      </p>

      <h2 id="retired">And the one we took out</h2>

      <p>
        There was a second ratchet, on <code>src/lib.rs</code>, the engine's Rust entry point. It ran
        the same way and it worked the same way: 5,213 lines down to 4,771 over August and September.
        On 25 September it was removed. The reason is in{" "}
        <a href={repoFile("scripts/guardrails.sh")} {...external}>
          guardrails.sh
        </a>{" "}
        in the repo's own words — <em>lib.rs is refactored often enough that a blocking line count cost
        more than it caught</em>.
      </p>

      <p>
        That is the honest boundary of the idea, and it is worth more than the success story. A ratchet
        earns its place where a file only ever accretes, because there the count and the problem are
        the same thing. Where a file is genuinely being worked — split, rejoined, moved through — the
        count stops tracking the problem and starts being a toll on the work. Both of those were true
        in this repo within a month of each other, and the difference was not the rule. It was the
        file.
      </p>

      <h2 id="stays">What leaves a god file, and what stays</h2>

      <p>
        Two things made the AppShell work a real extraction rather than a relocation. First, every
        store setter accepts what React's <code>useState</code> setter accepts — a value or an updater
        — so the roughly thirty call sites moved without being rewritten. A migration that has to
        rewrite every caller is a migration that gets half-finished.
      </p>

      <p>
        Second, the stores draw a hard line about what survives a reload. Which panel you left open is
        worth remembering; whether a dialog was showing when the tab closed is not, and restoring it
        would open a dialog over a photo you had not opened yet. That is a decision per field, written
        down once, rather than a default nobody chose.
      </p>

      <p>
        What is left in AppShell after all of it is composition: the tree, and the wiring between
        pieces that now live elsewhere. The next reductions are not more handler extractions — they
        are structural, and they change what renders. The cap says so either way.
      </p>

      <h2 id="net">The part that would be easy to leave out</h2>

      <p>
        The ratchet stopped the growth. It did not undo it. AppShell is{" "}
        <span className="fig">3,564</span> lines today — <span className="fig">242</span> below its
        peak, and still <span className="fig">314</span> above where it was the day we started taking
        it apart.
      </p>

      <p>
        That is not the ratchet failing. Features kept arriving the whole time, and they have to land
        somewhere; a file that is the composition root of the app will take new lines for as long as
        the app grows. Entropy here is whack-a-mole, and the honest version is that you do not win it.
        What the number bought was not a smaller file. It was the end of finding out a month late.
      </p>

      <h2 id="see">See it yourself</h2>

      <p>
        Every number in this post is one command away. <code>eslint.config.mjs</code> holds the five
        caps and the reasoning beside each; <code>guardrails.sh</code> holds the counts that are only
        allowed to fall, and the note explaining the one that was retired. If a figure here disagrees
        with the file, the file is right.
      </p>
    </>
  );
}

/** The header banner: FIG 1's scene, framed to cover the header rather than to
 *  show the whole diagram. It is also what the social card is a still of —
 *  `pnpm gen:og --posts` screenshots this under `prefers-reduced-motion`, so
 *  the card is one frame of the same scene rather than a second drawing that
 *  could disagree with it. */
export function Topper() {
  return <Scene kind="giants" backdrop />;
}
