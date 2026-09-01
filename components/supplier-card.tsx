"use client";

import Image from "next/image";
import { useLayoutEffect, useRef, useState } from "react";
import { SupplierLogo } from "@/components/supplier-logo";
import { BASE_PATH } from "@/lib/base-path";
import type { Supplier } from "@/lib/suppliers";

type SupplierCardProps = {
  supplier: Supplier;
  /** Whether the supplier is on the Select Suppliers rail list. */
  added: boolean;
  onToggleAdd: () => void;
  /** Generic capability labels (max 5) derived from the search and answers. */
  matchPills: string[];
};

/** Category keywords bolded inside descriptions, as on the reference SRP card. */
function emphasize(text: string): React.ReactNode[] {
  return text.split(/(stampings?|services?)/i).map((part, index) =>
    /^(stampings?|services?)$/i.test(part) ? <strong key={index}>{part}</strong> : part,
  );
}

export const noop = (event: React.MouseEvent) => event.preventDefault();

/** Video or catalog thumbnail, captioned per its kind. */
export function MediaTile({ kind, label }: { kind: string; label: string }) {
  return (
    <div className="media-tile" role="img" aria-label={label}>
      {kind === "factoryTour" ? (
        <>
          <span className="corner">02:26</span>
          <l-icon name="circle-play" />
          <span className="caption">Factory Tour</span>
        </>
      ) : kind === "catalog" ? (
        <>
          <span className="corner">
            <l-icon name="tag" /> CATALOG
          </span>
          <span className="caption">View Products</span>
        </>
      ) : (
        <>
          <l-icon name="circle-play" />
          <span className="caption">Company Overview</span>
        </>
      )}
    </div>
  );
}

/**
 * Capability pills kept to a single line; pills that would wrap are hidden
 * and counted in a "+X" circle at the right. Re-measures when the resizable
 * panel changes width.
 */
export function CapabilityRow({ capabilities }: { capabilities: string[] }) {
  const rowRef = useRef<HTMLDivElement>(null);
  const [hiddenCount, setHiddenCount] = useState(0);

  useLayoutEffect(() => {
    const row = rowRef.current;
    if (!row) return;
    const measure = () => {
      const pills = Array.from(row.children) as HTMLElement[];
      if (pills.length === 0) return;
      const firstTop = pills[0].offsetTop;
      setHiddenCount(pills.filter((pill) => pill.offsetTop > firstTop).length);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(row);
    return () => observer.disconnect();
  }, [capabilities]);

  return (
    <div className="cap-row">
      <div className="cap-row-pills" ref={rowRef}>
        {capabilities.map((capability) => (
          <span className="cap-pill" key={capability}>
            <l-icon name="check" /> {capability}
          </span>
        ))}
      </div>
      {hiddenCount > 0 && (
        <span
          className="cap-more"
          title={capabilities.slice(capabilities.length - hiddenCount).join(", ")}
        >
          +{hiddenCount}
        </span>
      )}
    </div>
  );
}

/** One supplier result, matching the reference SRP card content and UX. */
export function SupplierCard({
  supplier,
  added,
  onToggleAdd,
  matchPills,
}: SupplierCardProps) {
  const [expanded, setExpanded] = useState(false);
  const clampable = supplier.description.length > 180;
  const media = supplier.media[0];

  return (
    <l-panel class="supplier-card">
      {/* Header row: identity + actions */}
      <div className="card-head flex gap-3 align-items-start">
        <div className="supplier-logo" aria-hidden="true">
          <SupplierLogo name={supplier.name} size={40} />
        </div>
        <div className="card-identity flex-1">
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
          <a href="#" className="card-profile-link" onClick={noop}>
            View Profile
          </a>
        </div>
        <div className="card-actions flex align-items-center gap-2 flex-shrink-0">
          <button
            kind="primary-outline"
            scale="small"
            className="card-add"
            aria-pressed={added}
            aria-label={added ? `${supplier.name} added to selected suppliers` : `Add ${supplier.name} to selected suppliers`}
            onClick={onToggleAdd}
          >
            <l-icon name={added ? "check" : "plus"} /> {added ? "Added to List" : "Add to List"}
          </button>
          <button kind="primary" scale="small" className="card-cta" onClick={noop}>
            Visit Website <l-icon name="arrow-up-right-from-square" />
          </button>
        </div>
      </div>

      {/* Fact row — quiet dot-joined line, per the reference card */}
      <div className="supplier-facts">
        <span>
          <l-icon name="location-dot" aria-hidden="true" />
          <a href="#" onClick={noop}>
            {supplier.city}, {supplier.state} {supplier.zip}
          </a>
        </span>
        {supplier.employees && (
          <span>
            <l-icon name="users" aria-hidden="true" />
            {supplier.employees} employees
          </span>
        )}
        {supplier.revenue && (
          <span>
            <l-icon name="landmark" aria-hidden="true" />
            {supplier.revenue}
          </span>
        )}
        {supplier.founded && (
          <span>
            <l-icon name="calendar" aria-hidden="true" />
            Est. {supplier.founded}
          </span>
        )}
      </div>

      {supplier.companyTypes.length > 0 && (
        <div className="card-types">
          <l-icon name="industry" aria-hidden="true" /> {supplier.companyTypes.join(" · ")}
        </div>
      )}

      {/* Description — clamped, "more+" inline at the end of the last line */}
      <div className="desc-wrap">
        <p className={`mar-0 txt-smaller${expanded || !clampable ? "" : " clamp-2"}`}>
          {emphasize(supplier.description)}
        </p>
        {!expanded && clampable && (
          <span className="desc-more">
            <a
              href="#"
              onClick={(event) => {
                event.preventDefault();
                setExpanded(true);
              }}
            >
              more+
            </a>
          </span>
        )}
      </div>

      {/* Foot row: grey-outline capability pills (max 5); on phones the
          website link takes the header primary's place on the right. */}
      <div className="card-foot">
        <div className="match-pills" aria-label="Matching capabilities">
          {matchPills.map((pill) => (
            <span className="cap-pill" key={pill}>
              <l-icon name="check" /> {pill}
            </span>
          ))}
        </div>
        <a href="#" className="card-foot-website" onClick={noop}>
          Visit Website <l-icon name="arrow-up-right-from-square" />
        </a>
      </div>

      {/* Media */}
      {media && <MediaTile kind={media} label={`${supplier.name} media`} />}
    </l-panel>
  );
}
