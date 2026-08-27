"use client";

import { useEffect, useState } from "react";

/** Facet sections with real options behind them, in the order they're shown. */
export type FilterGroup = {
  id: string;
  title: string;
  options: string[];
};

/** Sections the production filter rail carries that this data can't fill yet. */
const PLACEHOLDER_GROUPS = [
  "Industry",
  "Compliance & Registrations",
  "Brands",
  "Catalogs",
  "Ownership / Diversity",
];

type FilterDrawerProps = {
  open: boolean;
  onClose: () => void;
  /** Questionnaire answers applied to the results, shown as removable pills. */
  applied: { id: string; title: string; value: string }[];
  onRemoveApplied: (questionId: string) => void;
  groups: FilterGroup[];
  /** Selected options per group id. */
  picked: Record<string, string[]>;
  onTogglePicked: (groupId: string, option: string) => void;
  verifiedOnly: boolean;
  onVerifiedOnly: (next: boolean) => void;
  partnerOnly: boolean;
  onPartnerOnly: (next: boolean) => void;
  location: string;
  onLocation: (next: string) => void;
  selectedCount: number;
  onClearAll: () => void;
};

/** Facet rail, opened from "All Filters" — the classic filters beside the agent. */
export function FilterDrawer({
  open,
  onClose,
  applied,
  onRemoveApplied,
  groups,
  picked,
  onTogglePicked,
  verifiedOnly,
  onVerifiedOnly,
  partnerOnly,
  onPartnerOnly,
  location,
  onLocation,
  selectedCount,
  onClearAll,
}: FilterDrawerProps) {
  const [expanded, setExpanded] = useState<string[]>([]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const toggleSection = (id: string) =>
    setExpanded((ids) => (ids.includes(id) ? ids.filter((entry) => entry !== id) : [...ids, id]));

  return (
    <div className="drawer-scrim" role="presentation" onClick={onClose}>
      <aside
        className="filter-drawer"
        role="dialog"
        aria-modal="true"
        aria-label="All filters"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="drawer-head">
          <l-icon name="sliders" aria-hidden="true" />
          <h4 className="mar-0">All Filters</h4>
          <button type="button" className="drawer-close" aria-label="Close filters" onClick={onClose}>
            <l-icon name="xmark" />
          </button>
        </div>

        <div className="drawer-actions">
          <span className="font-semi">{selectedCount} Filters Selected</span>
          <button type="button" className="drawer-link" onClick={onClearAll}>
            Clear All
          </button>
          <button type="button" className="drawer-link drawer-link-primary">
            Save Search
          </button>
        </div>

        {applied.length > 0 && (
          <div className="answer-pill-row drawer-applied">
            {applied.map((facet) => (
              <span className="answer-pill" key={facet.id}>
                {facet.value}
                <button
                  type="button"
                  className="answer-pill-remove"
                  aria-label={`Remove ${facet.title}: ${facet.value}`}
                  onClick={() => onRemoveApplied(facet.id)}
                >
                  <l-icon name="xmark" aria-hidden="true" />
                </button>
              </span>
            ))}
          </div>
        )}

        <div className="drawer-body">
          <section className="drawer-section">
            <h5 className="drawer-section-title mar-0">Verified Suppliers</h5>
            <label className="drawer-switch">
              <input
                type="checkbox"
                checked={verifiedOnly}
                onChange={(event) => onVerifiedOnly(event.target.checked)}
              />
              <span className="switch-track" aria-hidden="true" />
              <l-icon name="shield-check" class="txt-yellow-100" aria-hidden="true" />
              Thomas Verified
            </label>
            <label className="drawer-switch">
              <input
                type="checkbox"
                checked={partnerOnly}
                onChange={(event) => onPartnerOnly(event.target.checked)}
              />
              <span className="switch-track" aria-hidden="true" />
              <l-icon name="xmark" class="txt-blue-100" aria-hidden="true" />
              Xometry Partner
            </label>
            <label className="location-search drawer-location">
              <l-icon name="location-dot" aria-hidden="true" />
              <input
                type="search"
                value={location}
                aria-label="Filter by location"
                placeholder="Location by City, State, or ZIP"
                onChange={(event) => onLocation(event.target.value)}
              />
            </label>
          </section>

          {groups.map((group) => {
            const isOpen = expanded.includes(group.id);
            const chosen = picked[group.id] ?? [];
            return (
              <section className="drawer-section drawer-accordion" key={group.id}>
                <button
                  type="button"
                  className="drawer-row"
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(group.id)}
                >
                  <span>
                    {group.title}
                    {chosen.length > 0 && <span className="drawer-count">{chosen.length}</span>}
                  </span>
                  <l-icon name={isOpen ? "minus" : "plus"} aria-hidden="true" />
                </button>
                {isOpen && (
                  <div className="drawer-options">
                    {group.options.map((option) => (
                      <label className="drawer-check" key={option}>
                        <input
                          type="checkbox"
                          checked={chosen.includes(option)}
                          onChange={() => onTogglePicked(group.id, option)}
                        />
                        {option}
                      </label>
                    ))}
                  </div>
                )}
              </section>
            );
          })}

          {PLACEHOLDER_GROUPS.map((title) => {
            const isOpen = expanded.includes(title);
            return (
              <section className="drawer-section drawer-accordion" key={title}>
                <button
                  type="button"
                  className="drawer-row"
                  aria-expanded={isOpen}
                  onClick={() => toggleSection(title)}
                >
                  <span>{title}</span>
                  <l-icon name={isOpen ? "minus" : "plus"} aria-hidden="true" />
                </button>
                {isOpen && (
                  <p className="drawer-empty mar-0">
                    This prototype&apos;s supplier data doesn&apos;t carry {title.toLowerCase()} yet.
                  </p>
                )}
              </section>
            );
          })}
        </div>
      </aside>
    </div>
  );
}
