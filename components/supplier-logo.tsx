"use client";

import { useState } from "react";
import { monogram, placeholderMarkSrc } from "@/lib/logo";

type SupplierLogoProps = {
  name: string;
  /** CSS pixel size of the tile. */
  size: number;
};

/**
 * Local placeholder company mark, with initials if the image fails to load.
 */
export function SupplierLogo({ name, size }: SupplierLogoProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return monogram(name);
  }

  return (
    // Static export: serve the vendored SVG as-is.
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={placeholderMarkSrc(name)}
      alt=""
      width={size}
      height={size}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
