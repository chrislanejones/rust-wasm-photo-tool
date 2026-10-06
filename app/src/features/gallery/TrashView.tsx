import * as React from "react";
import { RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { QuotaGauge } from "@/components/ui/quota-gauge";
import { removesIn } from "@/lib/trash";
import { formatStorage, type QuotaFigures } from "@/lib/quota";

export interface TrashItem {
  id: string;
  name: string;
  thumbnailUrl?: string;
  bytes: number;
  deletedAt: number;
}

/**
 * The Trash view (UI Night 6 §3).
 *
 *   • the quota gauge at the top — trash counts toward it, so the view that
 *     frees space shows the space;
 *   • each item: thumbnail, name, "Removes in 5 days", Restore, Delete now;
 *   • Empty trash at the top, behind a ConfirmDialog (Night 5).
 *
 * Free and paid are the same view; only the window differs (lib/trash.ts).
 *
 * UNWIRED (Night 6 §0): there is no trash on the server yet — no `deletedAt`,
 * no purge. Built and tested against fixtures; the callbacks are optional so
 * the view renders before there is anything to call.
 */
export function TrashView({
  items,
  paid,
  now,
  quota,
  signedIn,
  onRestore,
  onDeleteNow,
  onEmpty,
}: {
  items: readonly TrashItem[];
  paid: boolean;
  /** Injected so the relative times are testable. */
  now: number;
  quota: QuotaFigures;
  signedIn: boolean;
  onRestore?: (id: string) => void;
  onDeleteNow?: (id: string) => void;
  onEmpty?: () => void;
}) {
  const [confirmEmpty, setConfirmEmpty] = React.useState(false);
  const total = items.reduce((n, i) => n + i.bytes, 0);

  return (
    <section aria-labelledby="trash-heading" className="space-y-4">
      <QuotaGauge figures={quota} signedIn={signedIn} />

      <div className="flex items-center justify-between gap-2">
        <h2 id="trash-heading" className="text-sm font-semibold text-theme-foreground">
          Trash
        </h2>
        <Button

          size="default"
          disabled={items.length === 0 || !onEmpty}
          onClick={() => setConfirmEmpty(true)}
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          Empty trash
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-theme-muted-foreground">Trash is empty.</p>
      ) : (
        <ul className="space-y-2" aria-label="Items in the trash">
          {items.map((it) => (
            <li
              key={it.id}
              data-trash-item={it.id}
              className="flex items-center gap-3 rounded-md border border-border p-2"
            >
              <div className="h-12 w-12 shrink-0 overflow-hidden rounded-sm bg-bg-tertiary">
                {it.thumbnailUrl && (
                  <img src={it.thumbnailUrl} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs text-theme-foreground">{it.name}</p>
                <p className="text-2xs text-theme-muted-foreground">
                  {removesIn(it.deletedAt, paid, now)} · {formatStorage(it.bytes)}
                </p>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button

                  size="default"
                  disabled={!onRestore}
                  onClick={() => onRestore?.(it.id)}
                  aria-label={`Restore ${it.name}`}
                >
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                  Restore
                </Button>
                <Button

                  size="default"
                  disabled={!onDeleteNow}
                  onClick={() => onDeleteNow?.(it.id)}
                  aria-label={`Delete ${it.name} now`}
                >
                  Delete now
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        title="Empty the trash?"
        tone="destructive"
        confirmLabel="Empty trash"
        onConfirm={() => {
          onEmpty?.();
          setConfirmEmpty(false);
        }}
      >
        {items.length} {items.length === 1 ? "item" : "items"}, {formatStorage(total)}, removed for
        good. This cannot be undone.
      </ConfirmDialog>
    </section>
  );
}
