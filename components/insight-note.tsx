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
  /** Defaults to a hand-drawn lightbulb — Tailoft's icon set has no bulb. */
  icon?: React.ReactNode;
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

function LightbulbIcon() {
  return (
    <svg
      className="insight-note-icon"
      viewBox="0 0 16 16"
      width="14"
      height="14"
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
