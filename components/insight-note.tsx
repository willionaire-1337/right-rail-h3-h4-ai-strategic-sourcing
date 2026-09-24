/**
 * EXPLORATION (trust-messaging): a quiet, single-line explanatory aside —
 * icon + text, no colored panel. The reusable way to add a small "here's
 * why" or "here's how this works" line anywhere in the prototype, without
 * it reading as a warning or error (which l-alert always implies).
 */
export function InsightNote({
  icon,
  children,
  className,
}: {
  /** Defaults to a hand-drawn lightbulb — Tailoft's icon set has no bulb.
      Pass `false` explicitly to render no icon at all. */
  icon?: React.ReactNode | false;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <p className={`insight-note mar-0${className ? ` ${className}` : ""}`}>
      {icon ?? <LightbulbIcon />}
      <span>{children}</span>
    </p>
  );
}

/**
 * EXPLORATION (trust-messaging): shield-with-keyhole for the privacy note —
 * the exact outline of Tailoft's own shield-check (extracted from its real
 * font file, fa-regular-400.woff2, glyph U+F2F7 — the outline is built from
 * two nested shield boundaries, not a stroke, which is why it has to be
 * reused as-is rather than approximated). Only the checkmark is swapped for
 * a solid keyhole (circle + tapered stem), sitting where the checkmark used to.
 */
export function ShieldLockIcon() {
  return (
    <svg
      className="insight-note-icon"
      viewBox="0 0 512 516"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        fill="currentColor"
        d="M269,3 Q263,0 256,0 Q249,0 243,3 L54,83 Q37,90 27,105 Q16,120 16,140 Q15,191 33,260 Q51,329 98,394 Q144,460 230,503 Q256,515 282,503 Q368,460 414,394 Q461,329 479,260 Q497,191 496,140 Q496,120 485,105 Q475,90 458,83 L269,3 Z
           M256,49 L439,127 Q448,132 448,140 Q448,187 432,248 Q416,308 376,366 Q335,423 262,460 Q256,462 250,460 Q177,423 136,366 Q96,308 80,248 Q64,187 64,140 Q64,132 73,127 Z"
      />
      <circle cx="256" cy="205" r="52" fill="currentColor" />
      <path d="M236,205 L276,205 L276,348 Q276,360 264,360 L248,360 Q236,360 236,348 Z" fill="currentColor" />
    </svg>
  );
}

function LightbulbIcon() {
  return (
    <svg
      className="insight-note-icon"
      viewBox="0 0 16 16"
      width="16"
      height="16"
      aria-hidden="true"
    >
      <path
        d="M8 1.5a4.5 4.5 0 0 0-2.5 8.24c.2.14.32.36.32.6v1.16c0 .28.22.5.5.5h3.36c.28 0 .5-.22.5-.5v-1.16c0-.24.13-.46.32-.6A4.5 4.5 0 0 0 8 1.5Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.1"
        strokeLinejoin="round"
      />
      <path d="M6.4 14.25h3.2" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round" />
    </svg>
  );
}
