import { useState } from "react";
import { closerPhoto } from "@/lib/dashboard-data";

/**
 * Round closer avatar. Tries to load `public/closers/<slug>.png`; if the file
 * is missing it falls back to the closer's initials. Drop photos in that folder
 * named after the closer's first name, e.g. `public/closers/thiago.png`.
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
  const [failed, setFailed] = useState(false);
  const initials = name.slice(0, 2).toUpperCase();

  return (
    <div
      className={`relative grid place-items-center overflow-hidden rounded-full font-display font-bold ${className}`}
      style={{ background: "var(--gradient-blue)", boxShadow: "var(--shadow-glow)", ...style }}
    >
      {!failed ? (
        <img
          src={closerPhoto(name)}
          alt={name}
          className="absolute inset-0 h-full w-full object-cover"
          onError={() => setFailed(true)}
          loading="lazy"
        />
      ) : (
        <span>{initials}</span>
      )}
    </div>
  );
}
