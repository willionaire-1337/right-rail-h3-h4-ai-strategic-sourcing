"use client";

import { monogram } from "@/components/supplier-card";
import type { Supplier } from "@/lib/suppliers";

type SelectSuppliersRailProps = {
  /** Suppliers queued for engagement — top-ranked picks plus card additions.
      Managed from the cards' Add/Added toggle; the chips just reflect it. */
  suppliers: Supplier[];
  onAddToShortlist: () => void;
  onSendRfi: () => void;
  /** Drafted RFI headline, synthesized from the logged answers. */
  draftTitle: string;
  /** How many requirements the draft was written from. */
  requirementCount: number;
  /** The logged spec, one "Label: Value" line per answer, stacked on the
      draft card. */
  requirementPreview: { label: string; value: string }[];
  /** True until the buyer engages (adds a supplier or logs a smart-filter
      answer); the desktop rail stays hidden while dormant. */
  dormant: boolean;
};

/**
 * Engage column beside the results list: saved supplier chips, the drafted
 * RFI card, and the send / shortlist / auto-contact actions below.
 */
export function SelectSuppliersRail({
  suppliers,
  onAddToShortlist,
  onSendRfi,
  draftTitle,
  requirementCount,
  requirementPreview,
  dormant,
}: SelectSuppliersRailProps) {
  return (
    <aside
      className={`select-rail${dormant ? " select-rail-dormant" : ""}`}
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
              ? "No suppliers saved yet"
              : `${suppliers.length} supplier${suppliers.length === 1 ? "" : "s"} saved`}
          </p>
        </div>
      </div>

      {suppliers.length === 0 ? (
        <div className="rail-placeholder">
            <span className="rail-placeholder-icon" aria-hidden="true">
              <l-icon name="industry" />
            </span>
          <p className="mar-0">Add suppliers to contact or shortlist</p>
        </div>
      ) : (
        <ul className="select-rail-list">
          {suppliers.map((supplier) => (
            <li key={supplier.id}>
              <span className="rail-logo" aria-hidden="true">
                {monogram(supplier.name)}
              </span>
              <span className="rail-entry-name" title={supplier.name}>
                {supplier.name}
              </span>
            </li>
          ))}
        </ul>
      )}

      {requirementCount === 0 ? (
        // Placeholder until smart-filter answers exist to draft an RFI from.
        <div className="rail-rfi-card">
          <span className="rail-rfi-flag rail-rfi-flag-empty">No RFI drafted yet</span>
          <p className="rail-rfi-note mar-0">
            Answer the smart filter questions and we&apos;ll draft an RFI from
            your requirements.
          </p>
        </div>
      ) : (
        <div className="rail-rfi-card">
          <span className="rail-rfi-flag">RFI drafted for you</span>
          <h5 className="rail-rfi-title">{draftTitle}</h5>
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
        </div>
      )}

      {/* Response-guarantee card wrapping the primary actions; the shield
          badge sits astride the card's top border. */}
      <div className="rail-guarantee">
        <span className="rail-guarantee-badge" aria-hidden="true">
          <l-icon name="shield-check" />
        </span>
        <h5 className="rail-guarantee-title mar-0">Supplier Response Guaranteed</h5>
        <p className="rail-guarantee-note mar-0">
          Get a response within 2 days or we&apos;ll make it right.
        </p>
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
