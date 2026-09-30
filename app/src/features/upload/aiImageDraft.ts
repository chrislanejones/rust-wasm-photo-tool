// The Create AI Image dialog's non-visual half: attachment limits, in-tab
// downscaling, and the consent sentence.
//
// SEPARATE FROM THE COMPONENT because the consent sentence is the part that has
// to be right the first time. "Nothing leaves your tab by accident" survives a
// text-to-image feature — a user typing a prompt and pressing Generate is not an
// accident — but only if the leaving is legible BEFORE the click. That makes the
// sentence a testable function of what is attached, not a string in JSX.

/** Attachment ceiling. Three is the model's practical limit and also as many as
 *  fit the dialog without it becoming a file manager. */
export const MAX_ATTACHMENTS = 3;

/** Per-file ceiling BEFORE downscaling. Not exported: `rejectReason` is the
 *  only reader, and the message it produces already states the limit, so a
 *  caller never needs the number itself. */
/** Per-file ceiling BEFORE downscaling — a guard against a 60 MP raw, not a
 *  transfer budget. What actually goes over the wire is the 1024px version. */
const MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024;

/** Longest edge after downscaling, in px.
 *
 *  ⚠️ DOWNSCALED IN THE TAB, BEFORE SEND, and that is a privacy decision as much
 *  as a bandwidth one. The model wants roughly this size anyway, so shrinking
 *  costs nothing — and it makes the consent sentence specific ("resized to
 *  1024px") instead of vague. A promise you can measure beats a promise you
 *  cannot. */
export const ATTACHMENT_LONGEST_EDGE = 1024;

export interface AspectRatio {
  id: string;
  label: string;
  w: number;
  h: number;
}

/**
 * ⚠️ PROVISIONAL, AND DELIBERATELY NOT LOAD-BEARING YET.
 *
 * There is no text-to-image job type in the backend — `convex/aiJobs.ts`
 * accepts rembg | upscale | inpaint | ocr | alt and nothing else. A model can
 * now be PICKED (see IMAGE_MODELS below), but the authoritative size list is
 * per-model and lives on the far end of a route that does not exist yet, so
 * this stays a placeholder rather than becoming a per-model table guessed from
 * documentation.
 *
 * Generating at one ratio and resizing to another throws away quality and
 * nobody would know why, so when the job type lands this list must be replaced
 * with whatever the backend actually returns for the SELECTED model rather
 * than kept because it looks reasonable. Until then Generate is inert, which
 * is what keeps this honest.
 */
export const ASPECT_RATIOS: readonly AspectRatio[] = [
  { id: "1:1", label: "1:1", w: 1, h: 1 },
  { id: "16:9", label: "16:9", w: 16, h: 9 },
  { id: "9:16", label: "9:16", w: 9, h: 16 },
  { id: "4:3", label: "4:3", w: 4, h: 3 },
  { id: "3:2", label: "3:2", w: 3, h: 2 },
];

/* ─────────────────────────────────────────────────────────────────────────────
   REPLICATE MODEL PICKER

   ⚠️ THE MODEL IS A USER CHOICE, NOT A CONSTANT, because the models differ in
   ways a user can feel and cannot guess: Schnell is cents and seconds, 1.1 Pro
   is neither, Ideogram is the one that renders legible text, Kontext is the
   only one in the list that actually looks at a reference image. Picking one
   for them and hiding the rest would make every one of those a surprise.

   ⚠️ THE ID IS A SLUG, NOT A PINNED VERSION, and that split is deliberate.
   `convex/ai.ts` pins a version HASH per job type, server-side, because a
   client that names its own version can point the account's Replicate key at
   any model on the platform. So when the text-to-image job type lands, this id
   travels as a CHOICE to be validated against a server-side registry — it is
   never the thing that gets POSTed.
   ────────────────────────────────────────────────────────────────────────── */

export interface ImageModel {
  /** Replicate slug — `owner/name`, the stable half of a model reference. */
  id: string;
  /** Menu text. Short: the select is ~260px wide in the dialog. */
  label: string;
  /** One line under the select saying what this model is FOR. The menu can
   *  only carry a name, and a name does not tell anyone that Schnell is the
   *  cheap one or that Ideogram is the one that can spell. */
  blurb: string;
  /**
   * Whether this model takes reference images at all.
   *
   * ⚠️ LOAD-BEARING, NOT DECORATION. The consent sentence promises exactly
   * what leaves the tab, so a model that ignores attachments must not have
   * them counted — and the attach control must not invite files that would be
   * dropped on the floor. `attachmentsSent` below is the one place that
   * decision is made.
   */
  supportsReferences: boolean;
}

/**
 * The menu, cheapest-and-fastest first — the order is the recommendation.
 *
 * ⚠️ STILL AHEAD OF THE BACKEND. `convex/aiJobs.ts` accepts rembg | upscale |
 * inpaint | ocr | alt and nothing else, so no entry here can run yet and
 * Generate stays disabled (see GENERATE_BLOCKED_REASON in NewActions). What
 * changed is that "which model" is no longer the open question it was: the
 * list is real, the capability flags are real, and the job type is the only
 * missing piece.
 */
export const IMAGE_MODELS: readonly ImageModel[] = [
  {
    id: "black-forest-labs/flux-schnell",
    label: "Flux Schnell",
    blurb: "Fastest and cheapest — a few seconds a frame. Good for trying prompts out.",
    supportsReferences: false,
  },
  {
    id: "black-forest-labs/flux-dev",
    label: "Flux Dev",
    blurb: "Slower than Schnell, noticeably better at detail and prompt-following.",
    supportsReferences: false,
  },
  {
    id: "black-forest-labs/flux-1.1-pro",
    label: "Flux 1.1 Pro",
    blurb: "Best-looking output in this list, and the most expensive per image.",
    supportsReferences: false,
  },
  {
    id: "black-forest-labs/flux-kontext-pro",
    label: "Flux Kontext Pro",
    blurb: "Edits from a reference image — the one to pick when you attach something.",
    supportsReferences: true,
  },
  {
    id: "stability-ai/stable-diffusion-3.5-large",
    label: "Stable Diffusion 3.5 Large",
    blurb: "Open-weights workhorse; takes a reference image to work from.",
    supportsReferences: true,
  },
  {
    id: "ideogram-ai/ideogram-v3-turbo",
    label: "Ideogram v3 Turbo",
    blurb: "The one that renders readable text — signs, posters, packaging.",
    supportsReferences: true,
  },
];

/** What the picker opens on: the cheap, fast one. A first generation that
 *  costs cents and lands in seconds is the one that teaches someone whether
 *  their prompt is any good; defaulting to the premium model bills them for
 *  that lesson. */
export const DEFAULT_IMAGE_MODEL_ID = IMAGE_MODELS[0].id;

/** Look a model up by slug, falling back to the default rather than throwing
 *  — a stale persisted id should reopen the dialog, not break it. */
export function modelById(id: string): ImageModel {
  return IMAGE_MODELS.find((m) => m.id === id) ?? IMAGE_MODELS[0];
}

/**
 * How many attachments would ACTUALLY be sent for this model.
 *
 * Zero for a model that cannot read them, however many are attached. The
 * dialog keeps the files (switching model must not silently bin someone's
 * picks) but the consent sentence counts this, so the sentence never claims a
 * send that will not happen — which is the same rule in the other direction as
 * never hiding one that will.
 */
export function attachmentsSent(modelId: string, attachmentCount: number): number {
  return modelById(modelId).supportsReferences ? attachmentCount : 0;
}

/**
 * The consent line, as a function of what is attached.
 *
 * Dynamic because attachments change what is true, and a sentence that says
 * "and any images you attach" when none are attached is hedging — it trains
 * people to skim it. Specificity is the whole value here.
 */
export function consentSentence(attachmentCount: number): string {
  if (attachmentCount <= 0) {
    return "Your prompt is sent to generate this image. Your photos stay in this tab.";
  }
  const noun = attachmentCount === 1 ? "image" : "images";
  return (
    `Your prompt and the ${attachmentCount} ${noun} you attach are sent, ` +
    `resized to ${ATTACHMENT_LONGEST_EDGE}px. Nothing else leaves this tab.`
  );
}

/** Why a file was refused, or null when it is fine. */
export function rejectReason(file: File, currentCount: number): string | null {
  if (currentCount >= MAX_ATTACHMENTS) {
    return `Up to ${MAX_ATTACHMENTS} reference images.`;
  }
  if (!file.type.startsWith("image/")) {
    return `${file.name} is not an image.`;
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    const mb = Math.round(MAX_ATTACHMENT_BYTES / (1024 * 1024));
    return `${file.name} is larger than ${mb} MB.`;
  }
  return null;
}

/** Target dimensions for the in-tab downscale — never upscales. */
export function downscaledSize(
  width: number,
  height: number,
  longestEdge = ATTACHMENT_LONGEST_EDGE,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= longestEdge || longest === 0) return { width, height };
  const scale = longestEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}
