import React, { useEffect, useRef } from "react";

export interface PhotoEntry {
  id: string;
  url: string;
  name: string;
  file: File;
}

interface Props {
  photos: PhotoEntry[];
  activeId: string | null;
  onSelect: (entry: PhotoEntry) => void;
  onRemove: (id: string) => void;
}

export const PhotoStrip: React.FC<Props> = ({
  photos,
  activeId,
  onSelect,
  onRemove,
}) => {
  const stripRef = useRef<HTMLDivElement>(null);

  // Scroll newly added photo into view
  useEffect(() => {
    if (!activeId || !stripRef.current) return;
    const el = stripRef.current.querySelector<HTMLElement>(
      `[data-id="${activeId}"]`,
    );
    el?.scrollIntoView({
      behavior: "smooth",
      inline: "nearest",
      block: "nearest",
    });
  }, [activeId, photos.length]);

  if (photos.length === 0) return null;

  return (
    <div className="photo-strip">
      <div className="photo-strip-inner" ref={stripRef}>
        {photos.map((entry) => (
          <div
            key={entry.id}
            data-id={entry.id}
            className={`photo-thumb ${entry.id === activeId ? "active" : ""}`}
            onClick={() => onSelect(entry)}
            title={entry.name}
          >
            <img src={entry.url} alt={entry.name} draggable={false} />
            <button
              className="photo-thumb-remove"
              title="Remove"
              onClick={(e) => {
                e.stopPropagation();
                onRemove(entry.id);
              }}
            >
              <svg
                viewBox="0 0 10 10"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
              >
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" />
              </svg>
            </button>
            <span className="photo-thumb-label">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
