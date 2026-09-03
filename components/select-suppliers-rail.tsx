"use client";

import { useState } from "react";
import { SupplierLogo } from "@/components/supplier-logo";
import type { Supplier } from "@/lib/suppliers";

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
}: SelectSuppliersRailProps) {
  const [rfiCollapsed, setRfiCollapsed] = useState(false);

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
              : `${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"} saved`}
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
          {suppliers.map((supplier) => (
            <li key={supplier.id}>
              <button
                type="button"
                className="rail-chip-open"
                title={`Show ${supplier.name} in results`}
                aria-label={`Show ${supplier.name} in results`}
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
          ))}
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
            <p className="rail-rfi-note mar-0">
              Answer smart filter questions and we&apos;ll draft an RFI from
              your requirements.
            </p>
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
          disabled={suppliers.length === 0}
          onClick={onSendRfi}
        >
          Contact {suppliers.length} Supplier{suppliers.length === 1 ? "" : "s"}
        </button>
        <button type="button" className="rail-sub" onClick={onAddToShortlist}>
          + Add to shortlist
        </button>
      </div>
    </aside>
  );
}
