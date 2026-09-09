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
 * accepts rembg | upscale | inpaint | ocr | alt and nothing else. So no model
 * has been chosen, and no model means no authoritative output-size list.
 *
 * Generating at one ratio and resizing to another throws away quality and
 * nobody would know why, so when the job type lands this list must be replaced
 * with whatever the backend actually returns rather than kept because it looks
 * reasonable. Until then Generate is inert, which is what keeps this honest.
 */
export const ASPECT_RATIOS: readonly AspectRatio[] = [
  { id: "1:1", label: "1:1", w: 1, h: 1 },
  { id: "16:9", label: "16:9", w: 16, h: 9 },
  { id: "9:16", label: "9:16", w: 9, h: 16 },
  { id: "4:3", label: "4:3", w: 4, h: 3 },
  { id: "3:2", label: "3:2", w: 3, h: 2 },
];

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
