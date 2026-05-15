import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Upload, Clipboard, FolderOpen, Heart } from "lucide-react";
import { shakeAnimation } from "@/lib/animations";

interface Props {
  onFiles: (files: File[]) => void;
}

export function UploadDropZone({ onFiles }: Props) {
  const [dragging, setDragging] = useState(false);
  const [shaking, setShaking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const shake = () => {
    setShaking(true);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);

    const files = Array.from(e.dataTransfer.files).filter((f) =>
      f.type.startsWith("image/"),
    );

    if (files.length) onFiles(files);
    else shake();
  };

  const handlePaste = (e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files = Array.from(items)
      .filter((item) => item.type.startsWith("image/"))
      .map((item) => item.getAsFile())
      .filter((f): f is File => f !== null);

    if (files.length) {
      e.preventDefault();
      onFiles(files);
    } else {
      shake();
    }
  };

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    el.addEventListener("paste", handlePaste);
    return () => el.removeEventListener("paste", handlePaste);
  }, []);

  return (
    <motion.div
      ref={containerRef}
      tabIndex={0}
      onDrop={handleDrop}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      animate={shaking ? shakeAnimation.animate : { x: 0 }}
      transition={shakeAnimation.transition}
      onAnimationComplete={() => setShaking(false)}
      className={`border-2 border-dashed rounded-xl p-12 text-center transition-all focus:outline-none ${
        dragging
          ? "border-theme-primary bg-theme-primary/10"
          : "border-theme-border bg-theme-muted/30"
      }`}
    >
      <div className="flex flex-col items-center gap-4">
        <div className="w-16 h-16 rounded-full bg-theme-muted flex items-center justify-center">
          <Upload className="h-8 w-8 text-theme-muted-foreground" />
        </div>

        <div className="flex gap-4 flex-wrap justify-center">
          <button
            onClick={() => inputRef.current?.click()}
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium bg-theme-primary text-theme-secondary hover:ring-2 hover:ring-theme-primary/50 hover:ring-offset-2 hover:ring-offset-theme-background transition-all"
          >
            <FolderOpen className="h-5 w-5" />
            Browse Files
          </button>

          <div className="flex items-center gap-2 px-6 py-3 rounded-lg bg-theme-secondary text-theme-secondary-foreground">
            <Clipboard className="h-5 w-5" />
            Paste (Ctrl+V)
          </div>
        </div>

        <p className="text-sm text-theme-muted-foreground">
          or drag and drop images here
        </p>

        <p className="text-xs text-theme-muted-foreground opacity-60">
          Supports PNG, JPG, GIF, WebP, AVIF
        </p>

        {/* Special Thanks Badge */}
        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full bg-theme-secondary/60 border border-theme-border backdrop-blur-sm">
          <Heart className="h-3 w-3 text-theme-primary" />
          <span className="text-[11px] font-medium text-theme-primary tracking-wide">
            Special thanks to the open-source community
          </span>
          <Heart className="h-3 w-3 text-theme-primary" />
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*"
        hidden
        onChange={(e) => onFiles(Array.from(e.target.files ?? []))}
      />
    </motion.div>
  );
}
