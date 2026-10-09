import { useRef, type ReactNode } from "react";
import { useInView } from "framer-motion";
import { ImageOff } from "lucide-react";
import { useThumbImage } from "@/features/gallery/useThumbImage";
import { Skeleton } from "./skeleton";

interface DecodedImageProps {
  source: Blob | string;
  alt: string;
  /** The containing surface owns dimensions; every branch fills that box. */
  className?: string;
  fallback?: ReactNode;
  /** Continue a placeholder already shown while fetching resource metadata. */
  loadingShown?: boolean;
  loading?: "lazy" | "eager";
}

/** Presentation only. The gallery's existing loader owns decode, grace,
 * timeout and last-good pixels. Key by resource identity when identity changes. */
export function DecodedImage({ loading, ...props }: DecodedImageProps) {
  return loading === "lazy" ? <LazyImage {...props} /> : <ImageContent {...props} />;
}

function LazyImage(props: Omit<DecodedImageProps, "loading">) {
  const ref = useRef<HTMLSpanElement>(null);
  const visible = useInView(ref, { once: true, margin: "200px" });
  return <span ref={ref} className="block size-full">{visible && <ImageContent {...props} />}</span>;
}

function ImageContent({ source, alt, className = "size-full object-cover", fallback, loadingShown = false }: Omit<DecodedImageProps, "loading">) {
  const view = useThumbImage(source);
  if (view.src) return <img src={view.src} alt={alt} draggable={false} className={className} />;
  if (view.failed) return fallback ?? <span role="img" aria-label={`${alt || "Image"} could not be displayed`}><ImageOff aria-hidden className="size-4 text-text-muted" /></span>;
  return view.showSkeleton || loadingShown ? <Skeleton className="size-full" aria-label={`Loading ${alt || "image preview"}`} /> : null;
}
