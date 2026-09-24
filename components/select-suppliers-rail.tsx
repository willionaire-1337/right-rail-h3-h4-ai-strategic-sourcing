"use client";

import { useState } from "react";
import { SupplierLogo } from "@/components/supplier-logo";
import {
  RAIL_LIMIT,
  UNCONTACTABLE_NOTE,
  contactableOnly,
  isUncontactable,
  type Supplier,
} from "@/lib/suppliers";

type SelectSuppliersRailProps = {
  /** Suppliers queued for engagement — auto-queued top matches plus card additions. */
  suppliers: Supplier[];
  onRemove: (supplierId: string) => void;
  /** Scroll the results list to this supplier's card. */
  onReveal: (supplierId: string) => void;
  onAddToShortlist: () => void;
  onSendRfi: () => void;
  /** Drafted RFI headline, synthesized from the logged answers. */
  draftTitle: string;
  /** How many requirements the draft was written from. */
  requirementCount: number;
  /** The logged spec, one "Label: Value" line per answer, stacked on the
      draft card. */
  requirementPreview: { label: string; value: string }[];
  /** How many chips at the head of the list the buyer added by hand; the
      rest are recommendations, re-ranked as answers land. */
  addedCount: number;
  /** Takes every recommendation off the rail at once. */
  onClearRecommended: () => void;
  /** EXPLORATION: reopens the Smart Filter questionnaire (same action as the
      floating "Open Smart Filters" button) — offered from the empty RFI
      card so there's a path back in without hunting for that button. */
  onAnswerQuestions?: () => void;
};

/**
 * Engage column beside the results list: saved supplier chips, the drafted
 * RFI card, and the send / shortlist / auto-contact actions below.
 */
export function SelectSuppliersRail({
  suppliers,
  onRemove,
  onReveal,
  onAddToShortlist,
  onSendRfi,
  draftTitle,
  requirementCount,
  requirementPreview,
  addedCount,
  onClearRecommended,
  onAnswerQuestions,
}: SelectSuppliersRailProps) {
  const [rfiCollapsed, setRfiCollapsed] = useState(false);
  /** Saved suppliers a request can actually go to — the rest are shortlist only. */
  const contactable = contactableOnly(suppliers);

  /** One supplier chip; greyed with the reason on hover if it can't be contacted. */
  const chip = (supplier: Supplier) => {
    const blocked = isUncontactable(supplier);
    return (
      <li
        key={supplier.id}
        className={blocked ? "rail-entry-uncontactable" : undefined}
        data-tip={blocked ? UNCONTACTABLE_NOTE : undefined}
      >
        <button
          type="button"
          className="rail-chip-open"
          title={blocked ? UNCONTACTABLE_NOTE : `Show ${supplier.name} in results`}
          aria-label={
            blocked
              ? `${supplier.name} — ${UNCONTACTABLE_NOTE}`
              : `Show ${supplier.name} in results`
          }
          onClick={() => onReveal(supplier.id)}
        >
          <span className="rail-logo" aria-hidden="true">
            <SupplierLogo name={supplier.name} size={22} />
          </span>
          <span className="rail-entry-name" title={supplier.name}>
            {supplier.name}
          </span>
        </button>
        <button
          type="button"
          className="rail-chip-remove"
          aria-label={`Remove ${supplier.name}`}
          onClick={() => onRemove(supplier.id)}
        >
          <l-icon name="xmark" aria-hidden="true" />
        </button>
      </li>
    );
  };

  return (
    <aside
      className="select-rail"
      aria-label="Shortlist and contact suppliers"
    >
      <div className="rail-header">
        <span className="rail-badge" aria-hidden="true">
          <l-icon name="paper-plane" />
        </span>
        <div>
          <h4 className="mar-0">Shortlist &amp; contact suppliers</h4>
          <p className="mar-0">
            {suppliers.length === 0
              ? "Add suppliers to your list"
              : (
                  <>
                    <span className="rail-count">{suppliers.length}</span>/{RAIL_LIMIT} selected
                  </>
                )}
          </p>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="rail-placeholder">
            <span className="rail-placeholder-icon" aria-hidden="true">
              <l-icon name="industry" />
              {/* Drawn rather than set as a Font Awesome glyph: a "plus" small
                  enough to badge the mark would carry a much thinner stroke
                  than the factory it sits on. */}
              <span className="rail-placeholder-plus">
                <svg viewBox="0 0 11 11" width="11" height="11">
                  <path d="M5.5 1V10M1 5.5H10" />
                </svg>
              </span>
            </span>
          <p className="mar-0">Add suppliers to contact or shortlist</p>
        </div>
      ) : (
        <ul className="select-rail-list">
          {/* Headings are full-width rows in the same list, so both groups
              share one scrolling column of chips. The buyer's own picks lead. */}
          {addedCount > 0 && (
            <li className="rail-group-title">
              <h5 className="mar-0">Added by you</h5>
            </li>
          )}
          {suppliers.slice(0, addedCount).map(chip)}
          {suppliers.length > addedCount && (
            <li className="rail-group-title rail-group-title-recommended">
              <span className="rail-group-icon" aria-hidden="true">
                <l-icon name="sparkles" fill />
              </span>
              <div className="rail-group-copy">
                <div className="rail-group-heading-row">
                  <h5 className="mar-0">Recommended suppliers</h5>
                  <button type="button" className="rail-sub rail-group-action" onClick={onClearRecommended}>
                    Clear
                  </button>
                </div>
                {/* EXPLORATION (trust-messaging): only claim a requirements
                    match once the buyer has actually logged one — before
                    that, "recommended" is really just default/sponsored
                    ordering (contactableOnly(results).slice(0, N) with
                    nothing to rank on), and saying otherwise would be
                    misleading. No line at all in that state, rather than a
                    softened one. */}
                {requirementCount > 0 && (
                  <p className="rail-group-note mar-0">Based on your requirements.</p>
                )}
              </div>
            </li>
          )}
          {suppliers.slice(addedCount).map(chip)}
        </ul>
      )}

      {/* Draft-status module: white/grey with no answers, blue once drafted.
          Does not shrink when the chip list grows — chips scroll instead. */}
      <div
        className={`rail-rfi-card ${
          requirementCount === 0 ? "rail-rfi-empty" : "rail-rfi-drafted"
        }${rfiCollapsed ? " rail-rfi-collapsed" : ""}`}
      >
        <button
          type="button"
          className="rail-rfi-bar"
          aria-expanded={!rfiCollapsed}
          aria-controls="rail-rfi-body"
          onClick={() => setRfiCollapsed((collapsed) => !collapsed)}
        >
          <span>
            {requirementCount === 0 ? "No RFI drafted yet" : "RFI drafted for you"}
          </span>
          <l-icon name={rfiCollapsed ? "plus" : "minus"} aria-hidden="true" />
        </button>
        <div id="rail-rfi-body" className="rail-rfi-body">
          {requirementCount === 0 ? (
            <>
              <p className="rail-rfi-note mar-0">
                Answer smart filter questions and we&apos;ll draft an RFI from
                your requirements.
              </p>
              {onAnswerQuestions && (
                <button type="button" className="rail-rfi-preview" onClick={onAnswerQuestions}>
                  Answer questions
                </button>
              )}
            </>
          ) : (
            <>
              <h5 className="rail-rfi-title mar-0">{draftTitle}</h5>
              <ul className="rail-rfi-spec">
                {requirementPreview.map((entry) => (
                  <li key={entry.label}>
                    {entry.label}: <strong>{entry.value}</strong>
                  </li>
                ))}
              </ul>
              <button type="button" className="rail-rfi-preview" onClick={onSendRfi}>
                Preview RFI →
              </button>
            </>
          )}
        </div>
      </div>

      <div className="select-rail-actions">
        <button
          type="button"
          kind="primary"
          disabled={contactable.length === 0}
          onClick={onSendRfi}
        >
          Contact {contactable.length} Supplier{contactable.length === 1 ? "" : "s"}
        </button>
        <button type="button" className="rail-sub" onClick={onAddToShortlist}>
          + Add to shortlist
        </button>
      </div>
    </aside>
  );
}
