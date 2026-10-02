// app/src/lib/mimeExt.ts
//
// Its own module so the phone's chunk can name a file without importing the
// export pipeline (codecs, encoders, the engine). Re-exported by exportImage.

/** Filename extension for a stored original's MIME type (used for verbatim copies). */
export function extFromMime(mime: string): string {
  switch (mime) {
    case "image/png": return ".png";
    case "image/jpeg": return ".jpg";
    case "image/webp": return ".webp";
    case "image/avif": return ".avif";
    case "image/gif": return ".gif";
    case "image/svg+xml": return ".svg";
    default: {
      const sub = mime.split("/")[1]?.replace(/\+.*$/, "");
      return sub ? `.${sub}` : "";
    }
  }
}
