"use client";

import { useState } from "react";
import { MOCK_BUYER } from "@/components/contact-supplier-modal";
import { RequirementDescription } from "@/components/requirement-description";
import { useQuoteEmailPayload } from "@/components/gmail-shell";
import { SupplierLogo } from "@/components/supplier-logo";
import { BASE_PATH } from "@/lib/base-path";
import { SUPPLIERS } from "@/lib/suppliers";

const noop = (event: React.MouseEvent) => event.preventDefault();

const NAV = [
  { id: "leads", label: "Leads", icon: "envelope" },
  { id: "analytics", label: "Analytics", icon: "sliders" },
  { id: "listings", label: "Performance Listings", icon: "list-ul" },
  { id: "ads", label: "Display Ads", icon: "image" },
  { id: "webtrax", label: "WebTrax", icon: "globe" },
  { id: "videos", label: "Videos", icon: "video" },
  { id: "profile", label: "Company Profile Manager", icon: "industry" },
  { id: "catalog", label: "Catalog Manager", icon: "book" },
  { id: "subscription", label: "Subscription", icon: "credit-card" },
  { id: "integrations", label: "Integrations", icon: "link" },
  { id: "teams", label: "Teams", icon: "users" },
] as const;

const RATINGS = [
  { value: 1, label: "Unqualified" },
  { value: 2, label: "Poor" },
  { value: 3, label: "Ok" },
  { value: 4, label: "Good" },
  { value: 5, label: "Great" },
] as const;

/** Shown when the supplier opens /lead without sending a quote first. */
const DEMO = {
  supplierName: "Principal Manufacturing Corporation",
  supplierId: "principal-manufacturing-corporation",
  projectName: "Aluminum Progressive Die Brackets",
  description:
    "We are looking to manufacture brackets using progressive die stamping in aluminum. Please send a quote at your earliest convenience.",
  needBy: "",
  sentAt: new Date().toISOString(),
};

function formatLeadDate(value: string): string {
  if (!value) return "-";
  const date = value.includes("T") ? new Date(value) : new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}/${date.getFullYear()}`;
}

/**
 * Thomas For Industry lead detail — the page a supplier lands on after
 * "View contact details" in the quote email. Chrome is static; rating is
 * local state only.
 */
export function LeadDetails() {
  const { loaded, payload } = useQuoteEmailPayload();
  const [rating, setRating] = useState<number | null>(null);

  const projectName = payload?.projectName || DEMO.projectName;
  const description = payload?.description || DEMO.description;
  const needBy = formatLeadDate(payload?.needBy || DEMO.needBy);
  const received = formatLeadDate(payload?.sentAt || DEMO.sentAt);
  const supplierName = payload?.supplierName || DEMO.supplierName;
  const supplier =
    SUPPLIERS.find((entry) => entry.id === payload?.supplierId) ||
    SUPPLIERS.find((entry) => entry.name === supplierName) ||
    SUPPLIERS.find((entry) => entry.id === DEMO.supplierId);
  const location = supplier ? `${supplier.city}, ${supplier.state}` : "";

  if (!loaded) return null;

  return (
    <div className="tfi-shell">
      <aside className="tfi-sidebar" aria-label="Thomas For Industry">
        <a className="tfi-logo" href={`${BASE_PATH}/`} aria-label="Thomas For Industry">
          <span className="tfi-logo-mark">THOMAS</span>
          <span className="tfi-logo-sub">For Industry.</span>
        </a>

        <div className="tfi-account-tabs" role="tablist" aria-label="Account scope">
          <button type="button" role="tab" aria-selected="true">
            Your Account
          </button>
          <button type="button" role="tab" aria-selected="false" onClick={noop}>
            Your Company
          </button>
        </div>

        <div className="tfi-company">
          <span className="tfi-company-logo" aria-hidden="true">
            <SupplierLogo name={supplierName} size={40} />
          </span>
          <div>
            <p className="tfi-company-name mar-0">{supplierName}</p>
            {location && <p className="tfi-company-loc mar-0">{location}</p>}
          </div>
          <span className="tfi-company-badge" aria-hidden="true">
            <l-icon name="award" />
          </span>
        </div>

        <nav className="tfi-nav" aria-label="Account">
          {NAV.map((item) => (
            <a
              key={item.id}
              href="#"
              aria-current={item.id === "leads" ? "page" : undefined}
              onClick={noop}
            >
              <l-icon name={item.icon} aria-hidden="true" />
              {item.label}
            </a>
          ))}
        </nav>
      </aside>

      <div className="tfi-main">
        <nav className="tfi-crumbs" aria-label="Breadcrumb">
          <a href={`${BASE_PATH}/`}>Home</a>
          <span aria-hidden="true">›</span>
          <a href="#" onClick={noop}>
            Your Account
          </a>
          <span aria-hidden="true">›</span>
          <a href="#" onClick={noop}>
            Leads
          </a>
          <span aria-hidden="true">›</span>
          <span>{projectName}</span>
        </nav>

        <article className="tfi-card">
          <header className="tfi-head">
            <a
              className="tfi-back"
              href={`${BASE_PATH}/supplier-email/`}
              aria-label="Back to email"
            >
              <l-icon name="angle-left" aria-hidden="true" />
            </a>
            <h1 className="tfi-title mar-0">{projectName}</h1>
            <span className="tfi-viewed">Viewed</span>
          </header>

          <div className="tfi-tabs" role="tablist">
            <button type="button" role="tab" aria-selected="true">
              Details
            </button>
          </div>

          <dl className="tfi-meta">
            <div>
              <dt>Buyer</dt>
              <dd>
                {MOCK_BUYER.name}, {MOCK_BUYER.company}
              </dd>
            </div>
            <div>
              <dt>Request ID</dt>
              <dd>-</dd>
            </div>
            <div>
              <dt>Type</dt>
              <dd>RFI Lead</dd>
            </div>
            <div>
              <dt>Date Received</dt>
              <dd>{received}</dd>
            </div>
            <div>
              <dt>Date Needed By</dt>
              <dd>{needBy}</dd>
            </div>
          </dl>

          <section className="tfi-section">
            <h2 className="tfi-section-title mar-0">Description</h2>
            <RequirementDescription className="tfi-section-body mar-0" text={description} />
          </section>

          <section className="tfi-section">
            <h2 className="tfi-section-title mar-0">Contact Details</h2>
            <dl className="tfi-contact">
              <div>
                <dt>Email</dt>
                <dd>
                  <a href={`mailto:${MOCK_BUYER.email}`}>{MOCK_BUYER.email}</a>
                </dd>
              </div>
              <div>
                <dt>Phone Number</dt>
                <dd>
                  <a href={`tel:${MOCK_BUYER.phone.replace(/\D/g, "")}`}>{MOCK_BUYER.phone}</a>
                </dd>
              </div>
            </dl>
          </section>

          <section className="tfi-section tfi-feedback">
            <h2 className="tfi-section-title mar-0">How would you rate this lead?</h2>
            <div className="tfi-ratings" role="group" aria-label="Lead rating">
              {RATINGS.map((entry) => (
                <button
                  key={entry.value}
                  type="button"
                  className="tfi-rating"
                  aria-pressed={rating === entry.value}
                  onClick={() => setRating(entry.value)}
                >
                  <span className="tfi-rating-n">{entry.value}</span>
                  <span className="tfi-rating-label">{entry.label}</span>
                </button>
              ))}
            </div>
            {rating !== null && (
              <p className="tfi-rating-thanks mar-0" role="status">
                Thanks — you rated this lead {rating} ({RATINGS[rating - 1]?.label}).
              </p>
            )}
          </section>
        </article>

        <footer className="tfi-foot">
          Copyright© 2026 Thomas Publishing Company. All Rights Reserved. See{" "}
          <a href="#" onClick={noop}>
            Terms and Conditions
          </a>
          ,{" "}
          <a href="#" onClick={noop}>
            Privacy Statement
          </a>{" "}
          and{" "}
          <a href="#" onClick={noop}>
            California Do Not Track Notice
          </a>
          .
        </footer>
      </div>
    </div>
  );
}
