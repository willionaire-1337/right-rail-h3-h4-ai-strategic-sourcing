"use client";

import { monogram } from "@/components/supplier-card";
import type { Supplier } from "@/lib/suppliers";

type SelectSuppliersRailProps = {
  /** Suppliers queued for engagement — top-ranked picks plus card additions. */
  suppliers: Supplier[];
  /** Takes one supplier back off the rail (the chip's ✕). */
  onRemove: (supplier: Supplier) => void;
  onAddToShortlist: () => void;
  onSendRfi: () => void;
  /** Drafted RFI headline, synthesized from the logged answers. */
  draftTitle: string;
  /** How many requirements the draft was written from. */
  requirementCount: number;
  /** A couple of requirement values echoed on the draft card. */
  requirementPreview: string[];
};

/**
 * Engage column beside the results list: saved supplier chips, the drafted
 * RFI card, and the send / shortlist / auto-contact actions below.
 */
export function SelectSuppliersRail({
  suppliers,
  onRemove,
  onAddToShortlist,
  onSendRfi,
  draftTitle,
  requirementCount,
  requirementPreview,
}: SelectSuppliersRailProps) {
  return (
    <aside className="select-rail" aria-label="Shortlist and contact suppliers">
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

      <ul className="select-rail-list">
        {suppliers.map((supplier) => (
          <li key={supplier.id}>
            <span className="rail-logo" aria-hidden="true">
              {monogram(supplier.name)}
            </span>
            <span className="rail-entry-name" title={supplier.name}>
              {supplier.name}
            </span>
            <button
              type="button"
              className="rail-remove"
              aria-label={`Remove ${supplier.name} from selected suppliers`}
              onClick={() => onRemove(supplier)}
            >
              <l-icon name="xmark" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ul>

      <div className="rail-rfi-card">
        <span className="rail-rfi-flag">RFI drafted for you</span>
        <h5 className="rail-rfi-title">{draftTitle}</h5>
        <p className="rail-rfi-note mar-0">
          {requirementCount === 0
            ? "Written from your search"
            : `Written from your ${requirementCount} logged requirement${
                requirementCount === 1 ? "" : "s"
              }${requirementPreview.map((entry) => ` · ${entry}`).join("")}`}
        </p>
        <button type="button" className="rail-rfi-preview" onClick={onSendRfi}>
          Preview RFI →
        </button>
      </div>

      <div className="select-rail-actions">
        <button
          type="button"
          kind="primary"
          disabled={suppliers.length === 0}
          onClick={onSendRfi}
        >
          Send to {suppliers.length} Supplier{suppliers.length === 1 ? "" : "s"}
        </button>
        <div className="rail-sub-row">
          <button type="button" className="rail-sub" onClick={onAddToShortlist}>
            + Add to shortlist
          </button>
          <button type="button" className="rail-sub">
            Visit Website(s) <l-icon name="arrow-up-right-from-square" aria-hidden="true" />
          </button>
        </div>
      </div>
    </aside>
  );
}
