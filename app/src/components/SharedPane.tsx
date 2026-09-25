// Settings → Shared. Every share link the signed-in person has made: what it
// is, how often it has been opened, and the three things they can do about it.
//
// WHY. `shares.listMine` sat unused since the table was made ("for a future
// My links pane"), so a link, once copied, was a thing you could never see
// again: not how many people opened it, not whether it was still out there,
// and the only way to stop it was to find the token. Chris, 09-22-2026: "do
// something cool with shared files + views … someone might wanna revoke it
// after a certain amount of shares".
//
// THREE CONTROLS, PER LINK, ALL IMMEDIATE (none is a Settings preference):
//   • LIMITS — "stop after N views" and "stop on a date". Reaching either
//     PAUSES the link; nothing is deleted, and raising the limit un-stops it.
//     The server derives that from the numbers every time (`availability` in
//     convex/shares.ts), so the pane never has to flip a flag.
//   • PAUSE / RESUME — the owner's own switch, kept as its own field so a
//     manual pause and a limit hit are told apart in the status.
//   • DELETE — what "revoke" was: link and image gone, with a confirm.
//
// THE CHART is a row of thirty bars, one per day, from the `share_views`
// timestamps (a timestamp is all a view stores — no IP, no browser; the
// privacy policy says so). It is decorative: the numbers a screen reader
// needs are in the text beside it.
import { useEffect, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Link2, Pause, Play, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NumberField } from "@/components/ui/number-field";
import { PaneHeading } from "@/components/ui/pane-heading";
import { Spinner } from "@/components/ui/spinner";
import { toast } from "@/components/ui/sonner";
import { shareUrlFor } from "@/hooks/useShare";
import { FIELD_NUMERIC } from "@/lib/styles";
import { cn } from "@/lib/utils";

type SharedLink = FunctionReturnType<typeof api.shares.listMine>[number];
type Status = SharedLink["status"];

/** Dates a person reads are MM-DD-YYYY (house rule). */
const dateFmt = new Intl.DateTimeFormat("en-US", { month: "2-digit", day: "2-digit", year: "numeric" });
const formatDate = (ms: number) => dateFmt.format(new Date(ms));

/** Coarse, like SyncPane's — "3m ago" is the reassurance. */
function agoText(at: number, now: number): string {
  const ms = Math.max(0, now - at);
  if (ms < 60_000) return "just now";
  const mins = Math.floor(ms / 60_000);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

/** `<input type="date">` speaks ISO (a spec date); this turns a local ms into
 *  that, and back into the local MIDNIGHT that starts the chosen day. */
function toDateInput(ms: number | null): string {
  if (ms === null) return "";
  const d = new Date(ms);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fromDateInput(value: string): number | null {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).getTime();
}

const STATUS: Record<Status, { label: string; className: string }> = {
  live: { label: "Live", className: "border-success/20 bg-success/10 text-success" },
  paused: { label: "Paused", className: "border-border bg-bg-elevated text-text-muted" },
  views: { label: "Hit its view limit", className: "border-warning/20 bg-warning/10 text-warning" },
  expired: { label: "Expired", className: "border-warning/20 bg-warning/10 text-warning" },
};

function StatusBadge({ status }: { status: Status }) {
  const s = STATUS[status];
  return (
    <span className={cn("rounded-full border px-2 py-0.5 text-2xs font-semibold", s.className)}>
      {s.label}
    </span>
  );
}

/** Thirty bars, one per day, newest on the right. */
function ViewsChart({ daily, total }: { daily: number[]; total: number }) {
  const peak = Math.max(1, ...daily);
  const busiest = Math.max(...daily);
  const last30 = daily.reduce((a, b) => a + b, 0);
  return (
    <div
      role="img"
      aria-label={`${last30} of ${total} views were in the last 30 days; the busiest day had ${busiest}.`}
      className="flex h-8 items-end gap-px"
    >
      {daily.map((n, i) => (
        <span
          key={i}
          className={cn("min-w-0 flex-1 rounded-[1px]", n > 0 ? "bg-theme-accent" : "bg-theme-muted")}
          style={{ height: n > 0 ? `${Math.max(12, (n / peak) * 100)}%` : "2px" }}
        />
      ))}
    </div>
  );
}

function LinkCard({ link, now }: { link: SharedLink; now: number }) {
  const setLimits = useMutation(api.shares.setLimits);
  const pause = useMutation(api.shares.pause);
  const resume = useMutation(api.shares.resume);
  const remove = useMutation(api.shares.remove);

  // The limits are a small draft: typing a number should not fire a mutation
  // per keystroke, and Save is what tells the person it stuck.
  const [maxViews, setMaxViews] = useState(link.maxViews === null ? "" : String(link.maxViews));
  const [expires, setExpires] = useState(toDateInput(link.expiresAt));
  useEffect(() => {
    setMaxViews(link.maxViews === null ? "" : String(link.maxViews));
    setExpires(toDateInput(link.expiresAt));
  }, [link.maxViews, link.expiresAt]);
  const draftMax = maxViews.trim() === "" ? null : Number(maxViews);
  const draftExpires = fromDateInput(expires);
  const draftValid = draftMax === null || (Number.isInteger(draftMax) && draftMax >= 1);
  const limitsDirty = draftMax !== link.maxViews || draftExpires !== link.expiresAt;

  const [busy, setBusy] = useState<"limits" | "pause" | "delete" | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const run = async (what: NonNullable<typeof busy>, fn: () => Promise<unknown>, done?: string) => {
    setBusy(what);
    try {
      await fn();
      if (done) toast.success(done);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(null);
    }
  };

  const copy = async () => {
    const url = shareUrlFor(link.token);
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Share link copied to clipboard");
    } catch {
      toast.info(url);
    }
  };

  const title = link.title ?? "Untitled";
  const paused = link.pausedAt !== null;

  return (
    <li className="space-y-3 rounded-lg border border-border bg-bg-elevated p-3">
      <div className="flex gap-3">
        {/* The owner's own image, through the same signed URL the viewer
            gets. `aspect-ratio` from the stored size, so the card does not
            jump when the bytes arrive. */}
        <div
          className="w-20 shrink-0 overflow-hidden rounded-md border border-border bg-bg-primary"
          style={{ aspectRatio: `${link.canvasW} / ${link.canvasH}` }}
        >
          {link.imageUrl && (
            <img src={link.imageUrl} alt="" className="size-full object-cover" loading="lazy" />
          )}
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="min-w-0 truncate text-xs font-semibold text-text-primary">{title}</p>
            <StatusBadge status={link.status} />
          </div>
          <p className="text-2xs text-text-muted">
            {link.canvasW}×{link.canvasH} · made {formatDate(link.createdAt)}
          </p>
          <p className="text-xs text-text-primary">
            <span className="font-semibold tabular-nums">{link.views.toLocaleString("en-US")}</span>{" "}
            {link.views === 1 ? "view" : "views"}
            {link.maxViews !== null && (
              <span className="text-text-muted"> of {link.maxViews.toLocaleString("en-US")}</span>
            )}
            {link.lastViewedAt !== null && (
              <span className="text-text-muted"> · last opened {agoText(link.lastViewedAt, now)}</span>
            )}
            {link.expiresAt !== null && (
              <span className="text-text-muted">
                {" "}· {link.status === "expired" ? "expired" : "stops"} {formatDate(link.expiresAt)}
              </span>
            )}
          </p>
        </div>
      </div>

      <ViewsChart daily={link.daily} total={link.views} />

      <div className="flex flex-wrap items-end gap-2">
        <NumberField
          label="Stop after views"
          min={1}
          step={1}
          placeholder="No limit"
          value={maxViews}
          onChange={(e) => setMaxViews(e.target.value)}
          className="max-w-[9rem]"
        />
        <label className="flex flex-1 flex-col gap-0.5">
          <span className="text-xs text-text-secondary">Stop on</span>
          <input
            type="date"
            className={FIELD_NUMERIC}
            value={expires}
            onChange={(e) => setExpires(e.target.value)}
          />
        </label>
        <Button
          size="large"
          disabled={!limitsDirty || !draftValid || busy !== null}
          onClick={() =>
            void run(
              "limits",
              () => setLimits({ token: link.token, maxViews: draftMax, expiresAt: draftExpires }),
              "Limits saved",
            )
          }
        >
          {busy === "limits" ? "Saving…" : "Save limits"}
        </Button>
      </div>
      {!draftValid && (
        <p className="text-2xs text-destructive">The view limit has to be a whole number, 1 or more.</p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button onClick={() => void copy()}>
          <Link2 aria-hidden />
          Copy link
        </Button>
        <Button
          disabled={busy !== null}
          onClick={() =>
            void run(
              "pause",
              () => (paused ? resume({ token: link.token }) : pause({ token: link.token })),
              paused ? "Link is live again" : "Link paused",
            )
          }
        >
          {paused ? <Play aria-hidden /> : <Pause aria-hidden />}
          {busy === "pause" ? "…" : paused ? "Resume" : "Pause"}
        </Button>
        <Button
          className="text-destructive-strong"
          disabled={busy !== null}
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 aria-hidden />
          Delete
        </Button>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this share link?"
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmIcon={Trash2}
        tone="destructive"
        onConfirm={() => {
          setConfirmDelete(false);
          void run("delete", () => remove({ token: link.token }), "Share link deleted");
        }}
      >
        The link stops working for everyone and the shared image is deleted. Your own copy in the
        editor is not touched. This cannot be undone.
      </ConfirmDialog>
    </li>
  );
}

export function SharedPane() {
  const { isAuthenticated, isLoading } = useConvexAuth();
  const links = useQuery(api.shares.listMine, isAuthenticated ? {} : "skip");

  // One clock for every "last opened" line, in state (ADR-020: no Date.now()
  // in render). A minute is the formatter's finest unit.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  const totalViews = links?.reduce((a, l) => a + l.views, 0) ?? 0;
  const mostViewed = links?.reduce<SharedLink | null>(
    (best, l) => (best === null || l.views > best.views ? l : best),
    null,
  );

  return (
    <div className="space-y-4">
      <PaneHeading title="Shared">
        Every share link you have made, and how often each has been opened. A link can stop by
        itself after a number of views or on a date. Stopping keeps the image, so you can turn the
        link back on. Deleting does not.
      </PaneHeading>

      {!isAuthenticated ? (
        <p className="text-xs text-text-muted">
          {isLoading ? "Connecting to your account…" : "Sign in to see your share links."}
        </p>
      ) : links === undefined ? (
        <div className="flex justify-center py-6">
          <Spinner className="size-6" aria-label="Loading your share links" />
        </div>
      ) : links.length === 0 ? (
        <p className="text-xs text-text-muted">
          No share links yet. Export › Share link makes one and copies it.
        </p>
      ) : (
        <>
          <dl className="grid grid-cols-3 gap-2 text-center">
            {[
              ["Links", links.length.toLocaleString("en-US")],
              ["Views", totalViews.toLocaleString("en-US")],
              ["Most opened", mostViewed ? `${mostViewed.views.toLocaleString("en-US")}` : "—"],
            ].map(([k, v]) => (
              <div key={k} className="rounded-lg border border-border bg-bg-elevated px-2 py-2">
                <dt className="text-2xs text-text-muted">{k}</dt>
                <dd className="text-sm font-semibold tabular-nums text-text-primary">{v}</dd>
              </div>
            ))}
          </dl>
          <ul className="space-y-3">
            {links.map((l) => (
              <LinkCard key={l.token} link={l} now={now} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
