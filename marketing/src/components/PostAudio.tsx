import { useLocation, useParams } from "react-router";
import { postFor } from "../data/posts";
import { PlayIcon, VolumeControl, clock, useNarration } from "./Narration";

/**
 * The narrated version of a blog post (Chris, 10-06-2026), under the receipts
 * line. Built from the site's tokens rather than the browser's own <audio
 * controls>, which draw a different grey widget in every browser and match
 * nothing here.
 *
 * It owns no <audio> of its own: it is a remote for the site-wide player in
 * Narration.tsx, so the narration keeps playing when you follow a link, and the
 * mini player picks it up on the next page (10-15-2026).
 *
 * Nothing loads until Play is pressed. The duration shown before that comes
 * from `minutes`, so the label is honest from the first paint (and from the
 * prerendered HTML).
 */
export default function PostAudio({ src, minutes }: { src: string; minutes: number }) {
  const { track, playing, t, dur, toggle, seek } = useNarration();
  const { pathname } = useLocation();
  const { slug = "" } = useParams();
  const current = track?.src === src;
  const shownT = current ? t : 0;
  const shownDur = current && dur > 0 ? dur : minutes * 60;
  const pct = shownDur > 0 ? (shownT / shownDur) * 100 : 0;
  const isPlaying = current && playing;
  const self = { src, minutes, href: pathname, title: postFor(slug)?.title ?? "Narration" };

  return (
    <div className="post-audio" role="group" aria-label="Listen to this post">
      <button
        type="button"
        className="post-audio__play"
        onClick={() => toggle(self)}
        aria-label={isPlaying ? "Pause the narration" : "Play the narration"}
      >
        <PlayIcon playing={isPlaying} />
      </button>
      <div className="post-audio__body">
        <p className="post-audio__label">
          Listen <span aria-hidden="true">·</span> narrated <span aria-hidden="true">·</span> {minutes} min
        </p>
        <div className="post-audio__track">
          <span className="post-audio__time">{clock(shownT)}</span>
          <input
            type="range"
            className="narration-range"
            min={0}
            max={shownDur}
            step={1}
            value={shownT}
            // Seeking a post that isn't loaded yet would move a slider over
            // nothing; start it first.
            onChange={(e) => (current ? seek(Number(e.target.value)) : toggle(self))}
            aria-label="Seek"
            aria-valuetext={`${clock(shownT)} of ${clock(shownDur)}`}
            style={{ "--narration-fill": `${pct}%` } as React.CSSProperties}
          />
          <span className="post-audio__time">{clock(shownDur)}</span>
        </div>
      </div>
      <VolumeControl className="post-audio__volume" />
    </div>
  );
}
