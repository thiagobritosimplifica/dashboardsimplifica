import { useState } from "react";
import { personSlug } from "@/lib/dashboard-data";

// Extensions tried, in order, when looking for a person's photo.
const EXTS = ["jpeg", "jpg", "png", "webp"] as const;

/**
 * Round avatar for a closer or SDR. Tries to load
 * `public/closers/<slug>.<ext>` for each supported extension; if none load it
 * falls back to the person's initials. Drop photos in that folder named after
 * the full name (lowercase, no spaces), e.g. `public/closers/anaclara.jpeg`.
 */
export function PersonAvatar({
  name,
  initials,
  className = "",
  style,
}: {
  name: string;
  initials?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [extIndex, setExtIndex] = useState(0);
  const fallback = initials ?? name.slice(0, 2).toUpperCase();
  const slug = personSlug(name);
  const exhausted = extIndex >= EXTS.length;

  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-full font-display font-bold ${className}`}
      style={{ background: "var(--gradient-blue)", boxShadow: "var(--shadow-glow)", ...style }}
    >
      {!exhausted ? (
        <img
          key={EXTS[extIndex]}
          src={`/closers/${slug}.${EXTS[extIndex]}`}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setExtIndex((i) => i + 1)}
          loading="lazy"
        />
      ) : (
        <span>{fallback}</span>
      )}
    </div>
  );
}
