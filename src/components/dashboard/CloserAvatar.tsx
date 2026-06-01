import { useState } from "react";
import { closerSlug } from "@/lib/dashboard-data";

// Extensions tried, in order, when looking for a closer photo.
const EXTS = ["jpeg", "jpg", "png", "webp"] as const;

/**
 * Round closer avatar. Tries to load `public/closers/<slug>.<ext>` for each
 * supported extension; if none load it falls back to the closer's initials.
 * Drop photos in that folder named after the closer's first name (lowercase),
 * e.g. `public/closers/thiago.jpeg`.
 */
export function CloserAvatar({
  name,
  className = "",
  style,
}: {
  name: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const [extIndex, setExtIndex] = useState(0);
  const initials = name.slice(0, 2).toUpperCase();
  const slug = closerSlug(name);
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
        <span>{initials}</span>
      )}
    </div>
  );
}
