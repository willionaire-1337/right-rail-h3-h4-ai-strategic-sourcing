"use client";

import Image from "next/image";
import { useState } from "react";
import {
  ContactSupplierModal,
  type ContactRequirement,
} from "@/components/contact-supplier-modal";
import { CapabilityRow, MediaTile, noop } from "@/components/supplier-card";
import { SupplierLogo } from "@/components/supplier-logo";
import { BASE_PATH } from "@/lib/base-path";
import type { Supplier } from "@/lib/suppliers";

type SupplierTileProps = {
  supplier: Supplier;
  saved: boolean;
  selected: boolean;
  /** Set once the quote request is full, so only deselection stays open. */
  selectDisabled?: boolean;
  /** Logged left-rail answers, echoed on the contact modal's quote form. */
  requirements?: ContactRequirement[];
  onToggleSave: () => void;
  onToggleSelect: () => void;
};

/**
 * Supplier result for the two-up layout: identity and CTA stacked over a
 * labelled firmographics strip, with the description dropped since the
 * half-width column has no room for it.
 */
export function SupplierTile({
  supplier,
  saved,
  selected,
  selectDisabled,
  requirements,
  onToggleSave,
  onToggleSelect,
}: SupplierTileProps) {
  const [contactOpen, setContactOpen] = useState(false);
  const stats = [
    { label: "Established", value: supplier.founded?.toString() },
    { label: "Revenue", value: supplier.revenue },
    { label: "Employees", value: supplier.employees },
  ].filter((stat) => stat.value);

  return (
    <l-panel class="supplier-tile">
      <div className="flex gap-3 align-items-start">
        <div className="supplier-logo" aria-hidden="true">
          <SupplierLogo name={supplier.name} size={40} />
        </div>
        <div className="flex-1">
          <div className="flex align-items-center gap-2">
            <a href="#" className="card-title" onClick={noop}>
              {supplier.name}
            </a>
            {supplier.verified && (
              <Image
                src={`${BASE_PATH}/verified-badge.png`}
                width={18}
                height={18}
                alt="Verified supplier"
                title="Verified supplier"
              />
            )}
          </div>
          {supplier.sponsored ? (
            <span className="tile-sponsored">Sponsored</span>
          ) : (
            <a href="#" className="card-profile-link" onClick={noop}>
              View Profile
            </a>
          )}
        </div>
        <div className="flex align-items-center gap-2 flex-shrink-0">
          <button kind="neutral-text" scale="small" aria-pressed={saved} onClick={onToggleSave}>
            <l-icon name="bookmark" fill={saved || undefined} /> {saved ? "Saved" : "Save"}
          </button>
          <button
            kind="neutral-text"
            scale="small"
            aria-pressed={selected}
            disabled={selectDisabled}
            title={selectDisabled ? "Quote requests go to at most 5 suppliers" : undefined}
            onClick={onToggleSelect}
          >
            <l-icon name={selected ? "circle-check" : "circle-plus"} />{" "}
            {selected ? "Selected" : "Select"}
          </button>
        </div>
      </div>

      <div className="tile-facts">
        <span>
          <l-icon name="location-dot" />
          <a href="#" onClick={noop}>
            {supplier.city}, {supplier.state} {supplier.zip}
          </a>
        </span>
        {supplier.companyTypes.length > 0 && (
          <span>
            <l-icon name="industry" />
            {supplier.companyTypes.join(", ")}
          </span>
        )}
      </div>

      {stats.length > 0 && (
        <dl className="tile-stats">
          {stats.map((stat) => (
            <div key={stat.label}>
              <dt>{stat.label}</dt>
              <dd>{stat.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {supplier.capabilities.length > 0 && <CapabilityRow capabilities={supplier.capabilities} />}

      {supplier.media.length > 0 && (
        <div className="tile-media">
          {supplier.media.slice(0, 2).map((kind) => (
            <MediaTile key={kind} kind={kind} label={`${supplier.name} ${kind}`} />
          ))}
        </div>
      )}

      <div className="tile-cta-row">
        <button kind="neutral" className="card-contact" onClick={() => setContactOpen(true)}>
          <l-icon name="envelope" fill /> Contact Supplier
        </button>
        <button kind="primary" onClick={noop}>
          Visit Website <l-icon name="arrow-up-right-from-square" />
        </button>
      </div>

      <ContactSupplierModal
        suppliers={[supplier]}
        open={contactOpen}
        onClose={() => setContactOpen(false)}
        requirements={requirements}
      />
    </l-panel>
  );
}
