// The Create AI Image panel — step 2 of the New / Upload menu, in the same
// frame as New Canvas.
//
// ⚠️ ITS OWN FILE BECAUSE `NewActions.tsx` IS AT THE RATCHET. That file sat at
// 899 lines against the 900-line `max-lines` warning (eslint.config.mjs: "any
// file NOT on this list that trips 900 is a new AppShell being born"), so the
// model picker could not be added in place — the panel came out instead of the
// limit going up. The split is also the honest one: everything here is about
// ONE request being drafted (prompt, references, model, ratio, consent), while
// what is left behind is about picking a way to start.
//
// ⚠️ BUILT FROM THE TOOL-PANEL PARTS, NOT FROM ITS OWN (Chris, 2026-09-20).
// Every control used to be hand-rolled: `text-xs text-text-secondary` labels
// where the sidebar uses `SectionHeader`/`FieldLabel`, and an aspect-ratio row
// of bespoke `rounded-lg border px-3 py-1.5` buttons that re-implemented
// `ToolButtonGroup` with its own idea of the selected color. The dialog and
// the sidebar are the same app and a user crosses between them in one session,
// so the second vocabulary was pure cost. It is now the same components, the
// same tokens and the same field classes (`@/lib/styles`) the sidebar ships.
import { useEffect, useRef, useState, useCallback } from "react";
import { ChevronLeft, Plus, Sparkles, X } from "lucide-react";
import { toast } from "@/components/ui/sonner";
import { Button } from "@/components/ui/button";
import { FieldLabel } from "@/components/ui/field-label";
import { InfoTooltip } from "@/components/ui/info-tooltip";
import { SectionHeader } from "@/components/ui/section-header";
import { ToolButton } from "@/components/ui/tool-button";
import { ToolButtonGroup } from "@/components/ui/tool-button-group";
import { FIELD_TEXTAREA } from "@/lib/styles";
import {
  ASPECT_RATIOS,
  ATTACHMENT_LONGEST_EDGE,
  IMAGE_MODELS,
  MAX_ATTACHMENTS,
  attachmentsSent,
  consentSentence,
  modelById,
  rejectReason,
} from "./aiImageDraft";
import { SelectField } from "@/components/ui/select-field";

/**
 * ⚠️ GENERATE IS NOT WIRED, AND SAYING SO BEFORE THE CLICK IS THE POINT.
 *
 * There is no text-to-image job type in the backend — `convex/aiJobs.ts`
 * accepts rembg | upscale | inpaint | ocr | alt and nothing else. Wiring a
 * network path to a job type that does not exist would fail at the far end
 * with something unhelpful.
 *
 * So Generate is DISABLED and this reason renders next to it, rather than the
 * button being enabled with a toast on click. A toast arrives after someone
 * has already written a prompt; a disabled button with a visible reason costs
 * them nothing. The button is the one control in this panel that cannot do
 * its job, and it should be the one control that looks like it.
 *
 * Everything above it is real: the model picker, the prompt, the references,
 * the downscale limits and the consent sentence all work and are testable.
 * That is the increment. When the job type lands, delete this and wire
 * `onClick` — passing `model` as a CHOICE for the server to validate against
 * its own registry, never as a version to POST (see IMAGE_MODELS).
 */
const GENERATE_BLOCKED_REASON =
  "Image generation isn't connected yet — there's no text-to-image job type " +
  "in the backend, so nothing is sent.";

interface Props {
  /** The chosen Replicate model, OWNED BY THE PARENT on purpose: the prompt
   *  and the references are a draft that Back throws away, but which model you
   *  like is a PREFERENCE, and it would not feel like it took if stepping back
   *  to the tile grid reset it to Schnell. */
  model: string;
  onModelChange: (id: string) => void;
  /** Return to the tile grid. The draft dies with this component. */
  onBack: () => void;
}

export function CreateAIImagePanel({ model, onModelChange, onBack }: Props) {
  const [prompt, setPrompt] = useState("");
  const [ratio, setRatio] = useState<string>(ASPECT_RATIOS[0].id);
  const [refs, setRefs] = useState<{ name: string; url: string }[]>([]);
  const refInputRef = useRef<HTMLInputElement>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const modelInfo = modelById(model);
  /** Whether attaching a reference image does anything at all for the chosen
   *  model. Drives the add tile, the thumbnails' dimming, and (through
   *  `attachmentsSent`) what the consent sentence claims is sent. */
  const modelTakesRefs = modelInfo.supportsReferences;

  // The prompt is the only thing anyone opens this panel to type, so the
  // caret starts in it. Mount-only: re-focusing on any later render would
  // yank the caret back while someone is choosing a model.
  useEffect(() => {
    promptRef.current?.focus();
  }, []);

  const removeRef = useCallback((index: number) => {
    setRefs((prev) => {
      const gone = prev[index];
      if (gone) URL.revokeObjectURL(gone.url);
      return prev.filter((_, i) => i !== index);
    });
  }, []);

  /** Accept files up to the cap, refusing each with a REASON rather than
   *  silently dropping it — a picker that ignores half your selection with no
   *  explanation is worse than one that says why. */
  const addRefs = useCallback((list: FileList | null) => {
    if (!list) return;
    setRefs((prev) => {
      const next = [...prev];
      for (const f of Array.from(list)) {
        const reason = rejectReason(f, next.length);
        if (reason) {
          toast.error(reason);
          continue;
        }
        next.push({ name: f.name, url: URL.createObjectURL(f) });
      }
      return next;
    });
    if (refInputRef.current) refInputRef.current.value = "";
  }, []);

  /** Revoke every preview URL, then hand control back.
   *
   *  ⚠️ ON THE BACK CLICK, NOT IN AN UNMOUNT EFFECT, and that is deliberate:
   *  StrictMode mounts, unmounts and REMOUNTS with the same state, so a
   *  cleanup that revoked here would free URLs the remounted thumbnails still
   *  point at — the exact dev-only broken-image bug the object-URL rule in
   *  this repo exists to prevent. Created and revoked in the same place. */
  const back = useCallback(() => {
    setRefs((prev) => {
      for (const r of prev) URL.revokeObjectURL(r.url);
      return [];
    });
    onBack();
  }, [onBack]);

  return (
    <>
      {/* Step 2 of THAT menu, in the same frame as New Canvas — same width,
          same footer geometry, same swap animation. The left button is Back,
          not Cancel, because it returns there. Esc dismisses the whole flow,
          which the surrounding dialog already handles. */}
      <SectionHeader
        title="Create AI Image"
        info="Describe the image you want, pick the model that suits the job, and generate it. The prompt — and any reference images you attach — are sent to Replicate; the photos already open in this tab are not."
      />

      {/* ── Model ────────────────────────────────────────────────
          WHY A PICKER AND NOT A CONSTANT: see IMAGE_MODELS. The
          models differ in price, speed, and whether they can read a
          reference image at all, and none of that is guessable from
          a name — so the choice is the user's and the blurb below
          says what they are choosing. Same select spelling as
          Text › Font Family and Resize › Method (SelectField). */}
      <div className="space-y-2">
        <FieldLabel
          title="Model"
          info="Which Replicate model draws the image. Schnell is the cheap, fast default; 1.1 Pro looks best and costs most; Ideogram is the one that renders readable text; Kontext and SD 3.5 are the two that actually look at a reference image."
        />
        <SelectField
          value={model}
          onChange={(e) => onModelChange(e.target.value)}
          title="Which Replicate model draws the image"
        >
          {IMAGE_MODELS.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </SelectField>
        {/* The menu can only carry a name, and a name does not say
            which one is the cheap one. */}
        <p className="text-2xs leading-relaxed text-theme-muted-foreground">
          {modelInfo.blurb}
        </p>
      </div>

      {/* ── Prompt ───────────────────────────────────────────────*/}
      <div className="space-y-2">
        <FieldLabel
          title="Prompt"
          info="Say what the picture is of, then how it should look — subject first, then lighting, lens, medium, mood. Specific beats long."
        />
        <textarea
          ref={promptRef}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={4}
          // A real example rather than "Describe your image…". The
          // placeholder is the only instruction most people read, so
          // it should show the shape of a good prompt, not restate
          // the label.
          placeholder="A rain-slicked Tokyo side street at dusk, neon signs reflected in the puddles, shot on 35mm"
          className={FIELD_TEXTAREA}
        />
      </div>

      {/* ── Reference images ─────────────────────────────────────
          File picker now. Picking from the gallery is a different
          path entirely (those pixels are already decoded in
          IndexedDB and need no re-upload) and is queued rather than
          half-built here.

          ⚠️ GATED ON THE MODEL. Three of the six models in the list
          cannot read a reference image, and a picker that accepts
          files the model will ignore is a lie told in advance — so
          the add tile disables and says why. Files ALREADY attached
          are kept, not binned: changing model must not silently
          destroy someone's picks, and the consent sentence stops
          counting them (attachmentsSent) so nothing is claimed that
          will not happen. */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <span className="text-2xs text-theme-muted-foreground">
            Reference Images{" "}
            <span className="text-text-muted">(optional)</span>
          </span>
          <div className="flex items-center gap-1.5">
            <span className="text-2xs tabular-nums text-theme-muted-foreground">
              {refs.length} / {MAX_ATTACHMENTS}
            </span>
            <InfoTooltip
              label="Reference Images"
              info={`Up to ${MAX_ATTACHMENTS} images the model draws from. They are resized to ${ATTACHMENT_LONGEST_EDGE}px in this tab before anything is sent. Only models that read reference images can use them — Flux Kontext Pro, Stable Diffusion 3.5 and Ideogram v3 in this list.`}
            />
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {refs.map((r, i) => (
            <div
              key={r.url}
              className={`relative h-16 w-16 overflow-hidden rounded-md border border-border ${
                // Dimmed, not removed, when the chosen model cannot
                // read it — the file is still yours, it just is not
                // going anywhere this run.
                modelTakesRefs ? "" : "opacity-40"
              }`}
            >
              <img src={r.url} alt={r.name} className="h-full w-full object-cover" />
              <button
                type="button"
                aria-label={`Remove ${r.name}`}
                onClick={() => removeRef(i)}
                className="absolute right-0.5 top-0.5 rounded bg-bg-secondary/80 p-0.5 text-text-primary hover:bg-bg-secondary"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
          {refs.length < MAX_ATTACHMENTS && (
            // The sidebar's tile, at tile size — same border, same
            // hover ring, same disabled treatment as every other
            // ToolButton in the app.
            <ToolButton
              stacked
              className="h-16 w-16 p-0"
              disabled={!modelTakesRefs}
              onClick={() => refInputRef.current?.click()}
              aria-label="Add a reference image"
              title={
                modelTakesRefs
                  ? "Add a reference image"
                  : `${modelInfo.label} doesn't read reference images — pick Flux Kontext Pro, Stable Diffusion 3.5 or Ideogram v3 to attach one.`
              }
            >
              <Plus />
            </ToolButton>
          )}
        </div>
        {!modelTakesRefs && refs.length > 0 && (
          <p className="text-2xs leading-relaxed text-warning">
            {modelInfo.label} doesn&apos;t read reference images, so{" "}
            {refs.length === 1
              ? "that one stays in this tab. Switch model to use it."
              : `those ${refs.length} stay in this tab. Switch model to use them.`}
          </p>
        )}
        <input
          ref={refInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => addRefs(e.target.files)}
        />
      </div>

      {/* Aspect ratio. ⚠️ PROVISIONAL — see ASPECT_RATIOS. The
          supported list is per-model and comes from the backend,
          which has no text-to-image job type yet, so this is still a
          placeholder — now rendered by the same ToolButtonGroup the
          Crop ratios use rather than a private copy of it. */}
      <ToolButtonGroup<string>
        aria-label="Aspect ratio"
        columns={5}
        label={
          <>
            Aspect Ratio
            <InfoTooltip
              label="Aspect Ratio"
              info="The shape of the generated frame. Provisional: each model publishes its own list of sizes, and this one is replaced by the model's real list when generation is wired up."
            />
          </>
        }
        value={ratio}
        onChange={setRatio}
        options={ASPECT_RATIOS.map((r) => ({
          id: r.id,
          label: r.label,
          title: `${r.w} × ${r.h}`,
        }))}
      />

      {/* THE CONSENT LINE. This is the first feature where data
          leaves the tab, and the claim "nothing leaves your tab by
          accident" survives it — a user typing a prompt and pressing
          Generate is not an accident. It survives only if the
          leaving is legible BEFORE the click, so the sentence is
          here, and it is DYNAMIC because attachments change what is
          true — and so does the model, which is why the count runs
          through `attachmentsSent` rather than off `refs.length`. */}
      <p className="rounded-lg border border-theme-border bg-theme-muted/40 px-3 py-2 text-2xs leading-relaxed text-text-secondary">
        {consentSentence(attachmentsSent(model, refs.length))}
      </p>

      {/* WHY GENERATE CANNOT FIRE, SAID BEFORE THE CLICK rather
          than in a toast after it. See GENERATE_BLOCKED_REASON. The
          button below is really `disabled`, so this line is the only
          thing explaining it — it is not decoration. */}
      <p className="text-2xs leading-relaxed text-text-secondary">
        {GENERATE_BLOCKED_REASON}
      </p>

      <div className="grid grid-cols-2 gap-3">
        <Button size="large" onClick={back} className="w-full">
          <ChevronLeft className="h-4 w-4" />
          Back
        </Button>
        <Button
          size="large"
          disabled
          title={GENERATE_BLOCKED_REASON}
          className="w-full"
        >
          <Sparkles className="h-4 w-4" />
          Generate Image
        </Button>
      </div>
    </>
  );
}
