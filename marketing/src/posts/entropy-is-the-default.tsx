/* "We spent a month taking the file apart. It got 556 lines longer."
 *
 * Body only — the headline, the deck, the dateline and the footer belong to
 * the shell (pages/BlogPost.tsx). This file starts at the first paragraph and
 * ends with `Topper`, the scene behind the shell's headline.
 *
 * REWRITTEN 10-13-2026 at Chris's request, for a reader who is not deep in the
 * stack: a tech manager, or someone two years in whose first year was React
 * list tutorials. Same facts and same figures, plainer words. The narration
 * mp3 was re-recorded from the new text the same day (Ava, edge-tts 7.3.1).
 *
 * EVERY NUMBER HERE IS MEASURED, and each one can be checked against the
 * repository at the commit named beside it:
 *
 *   3,250  AppShell.tsx at d3366c33 (27 July 2026)
 *   3,806  AppShell.tsx at eac21532 (27 August) — the commit that pinned caps
 *   3,564  AppShell.tsx on master at publication — 242 under the peak, and
 *          still 314 OVER the July figure, which the closing section says
 *
 * The two endpoints are exactly a month apart and each is a real commit, which
 * is why they are these two. eslint.config.mjs's own header says "3,314 ->
 * 3,806"; no commit in that window has 3,314 lines, so the post uses the
 * measured pair rather than repeating a figure that cannot be checked.
 *   the five pinned caps, their 27-August values and today's: eslint.config.mjs
 *   the retired Rust ratchet and its reason: scripts/guardrails.sh
 *
 * The lib.rs ratchet was RETIRED on 25 September; the post says so rather than
 * presenting it as the mechanism that worked.
 *
 * Three figures, all WebGL, in entropy.figures.tsx. three.js is loaded lazily
 * and only on this page.
 */

import { external, repoFile } from "../config";
import { Scene } from "./entropy.figures";
import PostAudio from "../components/PostAudio";

export default function EntropyIsTheDefault() {
  return (
    <>
      <p className="post__sourcenote">
        Every number below comes out of two files in the repo,{" "}
        <a href={repoFile("eslint.config.mjs")} {...external}>
          eslint.config.mjs
        </a>{" "}
        and{" "}
        <a href={repoFile("scripts/guardrails.sh")} {...external}>
          scripts/guardrails.sh
        </a>
        . None of it is rounded to make a better story.
      </p>
      <PostAudio src="/audio/entropy-is-the-default.mp3" minutes={8} />

      <p>
        Every app has a junk drawer. In Image Horse it's a file called <code>AppShell.tsx</code>, and
        over time it became the place where the upload button, the gallery, the canvas, the tools,
        undo, export, every pop-up dialog and the zoom controls all ended up living together. Nobody
        planned that. Once one drawer has the scissors and the tape in it, that's where the next thing
        goes.
      </p>

      <p>
        On July 27th that file was <span className="fig">3,250</span> lines long. Then I spent a month
        cleaning it out on purpose, moving chunks of it into their own homes, and on August 27th it was{" "}
        <span className="fig">3,806</span> lines long. A month of taking things out of the drawer, and
        the drawer got <span className="fig">556</span> lines fuller.
      </p>

      <p>
        If you've followed the Jaguars for any length of time, you know this feeling. You trade the
        veterans, you draft the young guys, the coach stands at a podium and announces a new era, and
        by the next September the record looks strangely familiar. Nobody did anything wrong in the
        offseason. The rebuild was real. The other teams just kept playing too.
      </p>

      <p>
        That's what people mean by code entropy. There wasn't a bad commit. The file wasn't neglected;
        it was the most worked-on file in the app. New features simply arrived faster than old ones
        left, and nothing in the build said a word about it.
      </p>

      <figure className="post__figure">
        <Scene kind="giants" />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 1</span>
          <span>
            The five files over 900 lines, next to the 31 small shared pieces in{" "}
            <code>components/ui/</code> for scale. The tall one grows to 3,250, keeps growing to 3,806{" "}
            <em>during</em> the month it was being taken apart, and only comes down to 3,564 once going
            over its limit became an error.
          </span>
        </figcaption>
      </figure>

      <h2 id="gravity">Big files pull things in</h2>

      <p>
        My house works the same way. Nobody decides to own eleven throw pillows. One pillow comes home
        from HomeGoods because the couch looked bare, and then the couch is clearly the pillow place, so
        the next one goes there too, and the one after that was on clearance so it barely counts, and by
        spring there's a decorative pillow guarding the other decorative pillows and I'm sitting on the
        floor. Every single purchase made sense on the day. The total is a couch nobody can sit on.
      </p>

      <p>
        A big file is that couch. It already has the data and the buttons wired up, so the cheapest
        place to add the next feature is right there. Each choice is the right one that afternoon, and
        the sum of a hundred right choices is a file no one can hold in their head.
      </p>

      <p>
        The same thing happens to how the app looks. There's one shared button design. Nine screens need
        it. Three of them use the shared one; six copy and paste it, because pasting was faster that day.
        Months later the copies disagree by six pixels in three places, and no single change did it. Fix
        the shared button and three screens get the fix. The six copies are like relatives who
        photocopied grandma's recipe card before she corrected it. They're going to keep making it the
        old way.
      </p>

      <figure className="post__figure">
        <Scene kind="drift" controls />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 2</span>
          <span>
            A sketch, not a head count. The screens are real; the number is the shape of the problem.
            Watch the last step: a fix lands in the shared piece and reaches the three screens that use
            it. The six that copied it won't get the next fix either.
          </span>
        </figcaption>
      </figure>

      <h2 id="ratchet">The fix was a number, not a rule</h2>

      <p>
        "Keep files small" sounds like a rule, but it isn't one. It's like "work out more." I like
        exercise, and even I know "more" isn't a number. You can't break a rule that has no line in it,
        so nobody ever does, and bringing it up in a code review just sounds like an opinion.
      </p>

      <p>
        What worked was smaller and more boring. On August 27th, every file already over 900 lines got
        pinned at <em>its exact size that day</em>, not a nice round number, and the new rule was that
        the number can only go down. That's a ratchet, like the strap on a truck tie-down: it clicks
        tighter, and it doesn't click back. When someone shrinks a file, they lower its limit to the new
        size in the same change. The limit follows the file down and never drifts back up.
      </p>

      <p>
        I made those limits warnings at first. That was the mistake. A warning is a message in the group
        chat that came through as a green bubble: technically delivered, and nobody reads it. I'm the
        only Android in my group chat, so I know. For a month, three of the five files sat over their
        limits and the build stayed green. On September 26th the warnings became errors, and all three
        files went back under in that same change.
      </p>

      <figure className="post__figure">
        <Scene kind="ratchet" controls />
        <figcaption className="post__caption post__caption--numbered">
          <span className="post__fignum">FIG 3</span>
          <span>
            The five files, from their pinned sizes on August 27th to today. Four came down. One went up,
            and it's drawn going up.
          </span>
        </figcaption>
      </figure>

      <h2 id="up">The one that went up</h2>

      <p>
        One test file went from <span className="fig">1,015</span> to <span className="fig">1,027</span>{" "}
        lines. Two pieces of work had both been adding to it, and when they were joined together the
        result was bigger than either one meant it to be. Up by twelve.
      </p>

      <p>
        The raise is written into the config with the reason right beside it, and that's the whole
        point. A ratchet doesn't fail when a number goes up. It fails when a number goes up{" "}
        <em>quietly</em>. The question to ask isn't "has the number ever moved the wrong way?" It's
        "when it did, did somebody have to explain why?"
      </p>

      <h2 id="retired">And the one I took out</h2>

      <p>
        There was a second ratchet, on <code>src/lib.rs</code>, the front door of the engine that does
        the actual photo work. It did its job: 5,213 lines down to 4,771 over August and September. On
        September 25th I removed it anyway. The reason is in{" "}
        <a href={repoFile("scripts/guardrails.sh")} {...external}>
          guardrails.sh
        </a>
        : <em>lib.rs is refactored often enough that a blocking line count cost more than it caught</em>
        .
      </p>

      <p>
        Think of a speed limit on a road that's being repaved every week. You aren't catching speeders,
        you're writing tickets to the paving crew. A ratchet earns its keep on a file that only ever
        grows, because there the line count and the problem are the same thing. On a file that's
        constantly being split up and rearranged, the count stops measuring the problem and starts
        charging a toll on the people fixing it. Both were true in this repo within a month of each
        other. The rule didn't change. The file did.
      </p>

      <h2 id="stays">What made the cleanup stick</h2>

      <p>
        Two things kept this from being a reshuffle that looks busy and changes nothing. First, the new
        shared storage accepts the same thing React's <code>useState</code> setter does. If you've ever
        written <code>setCount(c =&gt; c + 1)</code>, you know the shape. Because of that, about thirty
        places in the code moved over without being rewritten. A move that forces you to rewrite every
        caller is a move that gets half finished.
      </p>

      <p>
        Second, every setting got a yes or no on whether it should survive a page reload. The panel you
        left open? Remember it. A pop-up that happened to be showing when the tab closed? Forget it,
        because bringing it back would pop a dialog up over a photo you haven't even opened yet. That got
        decided once per setting and written down, instead of being a default nobody ever chose.
      </p>

      <h2 id="net">The scoreboard</h2>

      <p>
        The ratchet stopped the growth. It didn't undo it. AppShell is <span className="fig">3,564</span>{" "}
        lines now. That's <span className="fig">242</span> below its peak, and still{" "}
        <span className="fig">314</span> above where it was the day I started taking it apart.
      </p>

      <p>
        That's not the ratchet failing. New features showed up the whole time, and they have to land
        somewhere. The file that holds the whole app together will keep picking up lines for as long as
        the app keeps growing. Entropy is whack-a-mole, and you don't win whack-a-mole. You just get
        faster at it.
      </p>

      <p>
        I only have time for NFL recaps, not full games, and that's the best way I can describe what the
        ratchet bought. It didn't make the file small. It's a recap that shows up every single day
        instead of once at the end of a bad season, so I stopped finding out a month late.
      </p>

      <h2 id="see">See it yourself</h2>

      <p>
        Every number here is one file away. <code>eslint.config.mjs</code> has the five limits with the
        reasoning next to each one, and <code>guardrails.sh</code> has the counts that are only allowed to
        fall, plus the note on the one that was retired. If a number in this post disagrees with the
        file, believe the file.
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
