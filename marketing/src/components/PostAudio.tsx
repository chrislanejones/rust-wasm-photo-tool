import { useEffect, useRef, useState } from "react";

/**
 * The narrated version of a blog post (Chris, 10-06-2026), under the receipts
 * line. Built from the site's tokens rather than the browser's own <audio
 * controls>, which draw a different grey widget in every browser and match
 * nothing here.
 *
 * `preload="none"`: a narration is 5–6 MB, and nobody should pay for it just
 * by opening the post. The file is fetched when Play is pressed. The duration
 * shown before that comes from `minutes`, so the label is honest from the
 * first paint (and from the prerendered HTML).
 */
export default function PostAudio({ src, minutes }: { src: string; minutes: number }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(minutes * 60);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const time = () => setT(a.currentTime);
    const meta = () => Number.isFinite(a.duration) && setDur(a.duration);
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    a.addEventListener("timeupdate", time);
    a.addEventListener("loadedmetadata", meta);
    a.addEventListener("play", play);
    a.addEventListener("pause", pause);
    a.addEventListener("ended", pause);
    return () => {
      a.removeEventListener("timeupdate", time);
      a.removeEventListener("loadedmetadata", meta);
      a.removeEventListener("play", play);
      a.removeEventListener("pause", pause);
      a.removeEventListener("ended", pause);
    };
  }, []);

  const toggle = () => {
    const a = audio.current;
    if (!a) return;
    if (a.paused) void a.play();
    else a.pause();
  };

  const seek = (v: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = v;
    setT(v);
  };

  const pct = dur > 0 ? (t / dur) * 100 : 0;

  return (
    <div className="post-audio" role="group" aria-label="Listen to this post">
      <audio ref={audio} src={src} preload="none" />
      <button
        type="button"
        className="post-audio__play"
        onClick={toggle}
        aria-label={playing ? "Pause the narration" : "Play the narration"}
      >
        {playing ? (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <rect x="6" y="5" width="4" height="14" rx="1" />
            <rect x="14" y="5" width="4" height="14" rx="1" />
          </svg>
        ) : (
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
          </svg>
        )}
      </button>
      <div className="post-audio__body">
        <p className="post-audio__label">
          Listen <span aria-hidden="true">·</span> narrated <span aria-hidden="true">·</span> {minutes} min
        </p>
        <div className="post-audio__track">
          <span className="post-audio__time">{clock(t)}</span>
          <input
            type="range"
            className="post-audio__seek"
            min={0}
            max={dur || 0}
            step={1}
            value={t}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            aria-valuetext={`${clock(t)} of ${clock(dur)}`}
            style={{ "--post-audio-fill": `${pct}%` } as React.CSSProperties}
          />
          <span className="post-audio__time">{clock(dur)}</span>
        </div>
      </div>
    </div>
  );
}

function clock(s: number): string {
  const v = Math.max(0, Math.floor(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}
