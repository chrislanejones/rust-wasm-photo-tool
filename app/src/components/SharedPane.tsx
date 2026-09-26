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
//   • DELETE — what "revoke" was: link and image gone, with a confirm. The
//     confirm is `overModal`: Settings is a modal, and a plain dialog opens
//     underneath it, so Delete looked dead.
//
// ONE LIST, LIKE THE OTHER PANES. It was a stack of bordered cards, each with
// its fields always open, under three stat tiles: nothing else in Settings
// looks like that. Now it is a summary line and one list, a row per link with
// the dense-row actions every other list uses (RowAction); the limits fold
// open under their row. Chris, 09-25-2026: "doesn't match any UI".
//
// NO CHART. There was a thirty-day bar row here; with views on one or two
// days it drew a lone block at the right edge that read as a stray box, not a
// chart. The view count and "last opened" beside the thumbnail say it.
import { useEffect, useState } from "react";
import { useConvexAuth, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { ImageOff, Link2, Pause, Play, Timer, Trash2 } from "lucide-react";
import { api } from "../../../convex/_generated/api";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { NumberField } from "@/components/ui/number-field";
import { PaneHeading } from "@/components/ui/pane-heading";
import { RowAction } from "@/components/ui/row-actions";
import { ErrorNote } from "@/components/ui/status-note";
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
  // Limits are the rarely-used control, so they fold away under the row like
  // any other list's detail, and the pane reads as a list of links.
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

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
  const hasImage = link.imageUrl !== null && !imageFailed;

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-3">
        {/* The owner's own image, through the same signed URL the viewer
            gets. When there is none (the file is gone, or the URL failed) the
            box says so with an icon; an empty box read as a stray square. */}
        <div
          className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-md bg-bg-primary"
          title={hasImage ? undefined : "Preview unavailable"}
        >
          {hasImage ? (
            <img
              src={link.imageUrl!}
              alt=""
              className="size-full object-cover"
              loading="lazy"
              onError={() => setImageFailed(true)}
            />
          ) : (
            <ImageOff aria-hidden className="size-4 text-text-muted" />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-2">
            <p className="min-w-0 truncate text-xs font-semibold text-text-primary">{title}</p>
            <StatusBadge status={link.status} />
          </div>
          <p className="truncate text-2xs text-text-muted">
            <span className="font-semibold tabular-nums text-text-secondary">
              {link.views.toLocaleString("en-US")}
            </span>
            {link.maxViews !== null && ` of ${link.maxViews.toLocaleString("en-US")}`}{" "}
            {link.views === 1 && link.maxViews === null ? "view" : "views"}
            {link.lastViewedAt !== null && ` · last opened ${agoText(link.lastViewedAt, now)}`}
            {link.expiresAt !== null &&
              ` · ${link.status === "expired" ? "expired" : "stops"} ${formatDate(link.expiresAt)}`}
            {` · made ${formatDate(link.createdAt)}`}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <RowAction icon={Link2} label={`Copy link to ${title}`} onClick={() => void copy()} />
          <RowAction
            icon={paused ? Play : Pause}
            label={paused ? `Resume ${title}` : `Pause ${title}`}
            disabled={busy !== null}
            onClick={() =>
              void run(
                "pause",
                () => (paused ? resume({ token: link.token }) : pause({ token: link.token })),
                paused ? "Link is live again" : "Link paused",
              )
            }
          />
          <RowAction
            icon={Timer}
            label={`Limits for ${title}`}
            pressed={limitsOpen}
            onClick={() => setLimitsOpen((o) => !o)}
          />
          <RowAction
            icon={Trash2}
            label={`Delete ${title}`}
            disabled={busy !== null}
            onClick={() => setConfirmDelete(true)}
          />
        </div>
      </div>

      {limitsOpen && (
        <div className="mt-2.5 space-y-1.5 border-t border-border pt-2.5">
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
          {!draftValid && <ErrorNote>The view limit has to be a whole number, 1 or more.</ErrorNote>}
          <p className="text-2xs text-text-muted">
            Reaching either limit pauses the link. Raise it and the link works again.
          </p>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="Delete this share link?"
        cancelLabel="Cancel"
        confirmLabel="Delete"
        confirmIcon={Trash2}
        tone="destructive"
        overModal
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
          <p className="text-xs text-text-muted">
            {links.length.toLocaleString("en-US")} {links.length === 1 ? "link" : "links"} ·{" "}
            {totalViews.toLocaleString("en-US")} {totalViews === 1 ? "view" : "views"} in all
            {mostViewed && mostViewed.views > 0 && links.length > 1 && (
              <> · most opened: {mostViewed.title ?? "Untitled"}</>
            )}
          </p>
          <ul className="divide-y divide-border rounded-lg border border-border bg-bg-elevated">
            {links.map((l) => (
              <LinkCard key={l.token} link={l} now={now} />
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
