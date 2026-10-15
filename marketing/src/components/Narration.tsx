import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Volume1, Volume2, VolumeX, X } from "lucide-react";

/**
 * One narration player for the whole site (Chris, 10-15-2026: "make it so that
 * the audio from blogs keeps playing if I change pages").
 *
 * Each post used to own its <audio>, so following any link unmounted the page
 * and the narration stopped mid-sentence. The element now lives here, above the
 * routes, and never unmounts. A post's PostAudio is a remote for it, and the
 * MiniPlayer docks at the bottom of every other page while a narration is
 * loaded, with a link back to the post it belongs to.
 *
 * Only client-side navigations keep it alive. A plain <a href="/…"> is a full
 * page load and takes the audio with it, so internal links must be <Link>.
 */

export interface Track {
  src: string;
  /** Short name for the mini player (the post's <title>, not its headline). */
  title: string;
  /** The post's own path; the mini player links back to it. */
  href: string;
  minutes: number;
}

interface Narration {
  track: Track | null;
  playing: boolean;
  t: number;
  dur: number;
  volume: number;
  muted: boolean;
  /** Load `track` if it isn't the current one, then play or pause. */
  toggle: (track: Track) => void;
  seek: (v: number) => void;
  setVolume: (v: number) => void;
  toggleMute: () => void;
  /** Stop and unload: the mini player's close button. */
  close: () => void;
}

const NarrationContext = createContext<Narration | null>(null);

export function useNarration(): Narration {
  const n = useContext(NarrationContext);
  if (!n) throw new Error("useNarration needs a <NarrationProvider>");
  return n;
}

const VOLUME_KEY = "ih-narration-volume";

function savedVolume(): number {
  try {
    const v = Number(localStorage.getItem(VOLUME_KEY));
    return localStorage.getItem(VOLUME_KEY) !== null && v >= 0 && v <= 1 ? v : 1;
  } catch {
    return 1;
  }
}

export function NarrationProvider({ children }: { children: ReactNode }) {
  const audio = useRef<HTMLAudioElement>(null);
  const [track, setTrack] = useState<Track | null>(null);
  const [playing, setPlaying] = useState(false);
  const [t, setT] = useState(0);
  const [dur, setDur] = useState(0);
  // 1 on the server and on the first client render, so hydration matches; the
  // saved level is applied in an effect.
  const [volume, setVolumeState] = useState(1);
  const [muted, setMuted] = useState(false);

  useEffect(() => {
    const v = savedVolume();
    setVolumeState(v);
    if (audio.current) audio.current.volume = v;
  }, []);

  useEffect(() => {
    const a = audio.current;
    if (!a) return;
    const time = () => setT(a.currentTime);
    const meta = () => Number.isFinite(a.duration) && setDur(a.duration);
    const play = () => setPlaying(true);
    const pause = () => setPlaying(false);
    const vol = () => {
      setVolumeState(a.volume);
      setMuted(a.muted);
    };
    a.addEventListener("timeupdate", time);
    a.addEventListener("loadedmetadata", meta);
    a.addEventListener("play", play);
    a.addEventListener("pause", pause);
    a.addEventListener("ended", pause);
    a.addEventListener("volumechange", vol);
    return () => {
      a.removeEventListener("timeupdate", time);
      a.removeEventListener("loadedmetadata", meta);
      a.removeEventListener("play", play);
      a.removeEventListener("pause", pause);
      a.removeEventListener("ended", pause);
      a.removeEventListener("volumechange", vol);
    };
  }, []);

  const toggle = useCallback(
    (next: Track) => {
      const a = audio.current;
      if (!a) return;
      if (track?.src !== next.src) {
        a.src = next.src;
        setTrack(next);
        setT(0);
        setDur(next.minutes * 60);
        void a.play();
        return;
      }
      if (a.paused) void a.play();
      else a.pause();
    },
    [track],
  );

  const seek = useCallback((v: number) => {
    const a = audio.current;
    if (!a) return;
    a.currentTime = v;
    setT(v);
  }, []);

  const setVolume = useCallback((v: number) => {
    const a = audio.current;
    if (!a) return;
    a.volume = v;
    // Dragging up from zero should be heard.
    if (v > 0 && a.muted) a.muted = false;
    try {
      localStorage.setItem(VOLUME_KEY, String(v));
    } catch {
      /* private window: the level just isn't remembered */
    }
  }, []);

  const toggleMute = useCallback(() => {
    const a = audio.current;
    if (a) a.muted = !a.muted;
  }, []);

  const close = useCallback(() => {
    const a = audio.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    setTrack(null);
    setPlaying(false);
    setT(0);
  }, []);

  // The phone's lock screen and the OS media keys drive the same player.
  useEffect(() => {
    if (!track || !("mediaSession" in navigator)) return;
    const ms = navigator.mediaSession;
    ms.metadata = new MediaMetadata({ title: track.title, artist: "Image Horse blog" });
    const a = audio.current;
    const set = (action: MediaSessionAction, fn: MediaSessionActionHandler | null) => {
      try {
        ms.setActionHandler(action, fn);
      } catch {
        /* an action this browser doesn't support */
      }
    };
    set("play", () => void a?.play());
    set("pause", () => a?.pause());
    set("seekbackward", () => a && (a.currentTime = Math.max(0, a.currentTime - 15)));
    set("seekforward", () => a && (a.currentTime = Math.min(a.duration || 0, a.currentTime + 15)));
    return () => {
      for (const action of ["play", "pause", "seekbackward", "seekforward"] as const) set(action, null);
    };
  }, [track]);

  const value = useMemo(
    () => ({ track, playing, t, dur, volume, muted, toggle, seek, setVolume, toggleMute, close }),
    [track, playing, t, dur, volume, muted, toggle, seek, setVolume, toggleMute, close],
  );

  return (
    <NarrationContext.Provider value={value}>
      {children}
      {/* preload="none": a narration is 5–6 MB and is fetched only on Play. */}
      <audio ref={audio} preload="none" />
    </NarrationContext.Provider>
  );
}

/** Mute button plus a level slider. Shared by the post player and the mini
 *  player. iOS ignores `volume` (the hardware buttons own it), so there the
 *  slider moves and the level doesn't; mute still works everywhere. */
export function VolumeControl({ className = "" }: { className?: string }) {
  const { volume, muted, setVolume, toggleMute } = useNarration();
  const level = muted ? 0 : volume;
  const Icon = level === 0 ? VolumeX : level < 0.5 ? Volume1 : Volume2;
  return (
    <div className={`narration-volume ${className}`}>
      <button
        type="button"
        className="narration-icon-btn"
        onClick={toggleMute}
        aria-label={muted ? "Unmute" : "Mute"}
        aria-pressed={muted}
      >
        <Icon aria-hidden="true" />
      </button>
      <input
        type="range"
        className="narration-range narration-volume__slider"
        min={0}
        max={1}
        step={0.05}
        value={level}
        onChange={(e) => setVolume(Number(e.target.value))}
        aria-label="Volume"
        aria-valuetext={`${Math.round(level * 100)}%`}
        style={{ "--narration-fill": `${level * 100}%` } as React.CSSProperties}
      />
    </div>
  );
}

export function PlayIcon({ playing }: { playing: boolean }) {
  return playing ? (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" />
      <rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.86l10.5-6.5a1 1 0 0 0 0-1.72L9.5 4.64A1 1 0 0 0 8 5.5Z" />
    </svg>
  );
}

export function clock(s: number): string {
  const v = Math.max(0, Math.floor(s));
  return `${Math.floor(v / 60)}:${String(v % 60).padStart(2, "0")}`;
}

/** Docked at the bottom of every page except the narration's own post, where
 *  the full player under the receipts line already shows it. */
export function MiniPlayer() {
  const { track, playing, t, dur, toggle, seek, close } = useNarration();
  const { pathname } = useLocation();
  if (!track || pathname === track.href) return null;
  const pct = dur > 0 ? (t / dur) * 100 : 0;

  return (
    <section className="mini-player" aria-label="Now playing">
      <button
        type="button"
        className="post-audio__play mini-player__play"
        onClick={() => toggle(track)}
        aria-label={playing ? "Pause the narration" : "Play the narration"}
      >
        <PlayIcon playing={playing} />
      </button>
      <div className="mini-player__body">
        <Link className="mini-player__title" to={track.href}>
          {track.title}
        </Link>
        <div className="post-audio__track">
          <span className="post-audio__time">{clock(t)}</span>
          <input
            type="range"
            className="narration-range"
            min={0}
            max={dur || 0}
            step={1}
            value={t}
            onChange={(e) => seek(Number(e.target.value))}
            aria-label="Seek"
            aria-valuetext={`${clock(t)} of ${clock(dur)}`}
            style={{ "--narration-fill": `${pct}%` } as React.CSSProperties}
          />
          <span className="post-audio__time">{clock(dur)}</span>
        </div>
      </div>
      <VolumeControl className="mini-player__volume" />
      <button type="button" className="narration-icon-btn" onClick={close} aria-label="Stop and close the player">
        <X aria-hidden="true" />
      </button>
    </section>
  );
}
