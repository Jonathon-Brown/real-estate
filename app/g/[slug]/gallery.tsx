"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

type Photo = { src: string; alt: string };

export function Gallery({ photos }: { photos: Photo[] }) {
  // Index of the photo open in the lightbox, or null when closed.
  const [open, setOpen] = useState<number | null>(null);

  useEffect(() => {
    if (open === null) return;

    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(null);
      if (e.key === "ArrowRight")
        setOpen((i) => (i === null ? null : (i + 1) % photos.length));
      if (e.key === "ArrowLeft")
        setOpen((i) =>
          i === null ? null : (i - 1 + photos.length) % photos.length,
        );
    }

    window.addEventListener("keydown", onKey);
    // Stop the page behind the lightbox from scrolling.
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, photos.length]);

  return (
    <>
      <div className="columns-1 gap-2 sm:columns-2 lg:columns-3">
        {photos.map((photo, i) => (
          <button
            key={photo.src}
            type="button"
            onClick={() => setOpen(i)}
            className="mb-2 block w-full break-inside-avoid cursor-zoom-in"
          >
            <Image
              src={photo.src}
              alt={photo.alt}
              width={1200}
              height={800}
              sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
              className="h-auto w-full"
            />
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={photos[open].alt}
          className="fixed inset-0 z-50 flex flex-col bg-black"
          onClick={() => setOpen(null)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-sm text-neutral-400">
            <span>
              {open + 1} / {photos.length}
            </span>
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Close"
              className="px-2 py-1 text-neutral-400 hover:text-white"
            >
              ✕
            </button>
          </div>

          <div
            className="relative min-h-0 flex-1"
            onClick={(e) => e.stopPropagation()}
          >
            <Image
              src={photos[open].src}
              alt={photos[open].alt}
              fill
              sizes="100vw"
              className="object-contain"
              priority
            />
          </div>

          <div className="flex justify-between px-2 py-2">
            <button
              type="button"
              aria-label="Previous photo"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((open - 1 + photos.length) % photos.length);
              }}
              className="px-5 py-2 text-lg text-neutral-400 hover:text-white"
            >
              ←
            </button>
            <button
              type="button"
              aria-label="Next photo"
              onClick={(e) => {
                e.stopPropagation();
                setOpen((open + 1) % photos.length);
              }}
              className="px-5 py-2 text-lg text-neutral-400 hover:text-white"
            >
              →
            </button>
          </div>
        </div>
      )}
    </>
  );
}
