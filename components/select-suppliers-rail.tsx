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
}: SelectSuppliersRailProps) {
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
              ? "No suppliers selected yet"
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

      {/* Draft-status module: white/grey with no answers, blue once drafted. */}
      <div
        className={`rail-rfi-card ${
          requirementCount === 0 ? "rail-rfi-empty" : "rail-rfi-drafted"
        }`}
      >
        <div className="rail-rfi-bar">
          {requirementCount === 0 ? "No RFI drafted yet" : "RFI drafted for you"}
        </div>
        <div className="rail-rfi-body">
          {requirementCount === 0 ? (
            <p className="rail-rfi-note mar-0">
              Answer the smart filter questions and we&apos;ll draft an RFI from
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
