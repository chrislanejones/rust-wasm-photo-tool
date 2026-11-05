// What the gallery's add-photos funnel (`useImageSession.handleAddPhotos`)
// reports back, one outcome per file it was handed, in the same order.
//
// Most callers ignore it: a drop or Browse Files has nothing to do after the
// import beyond the toasts the funnel already shows. The Transfer inbox
// (features/transfer) is the caller that needs it: a photo leaves the inbox
// ONLY when its own import landed, so it must know which ones did.

export type AddPhotoOutcome =
  /** In the gallery, with this entry id. */
  | { status: "added"; photoId: string }
  /** The import threw (decode, too large, storage). `message` is the toast's. */
  | { status: "failed"; message: string }
  /** Not attempted: the gallery's photo limit (tier) was already reached. */
  | { status: "over-limit" };

export interface AddPhotosResult {
  outcomes: AddPhotoOutcome[];
}
