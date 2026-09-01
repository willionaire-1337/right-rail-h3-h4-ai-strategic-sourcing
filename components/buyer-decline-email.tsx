"use client";

import { GmailMessageFrame, GmailShell, useQuoteEmailPayload } from "@/components/gmail-shell";
import { MOCK_BUYER, type QuoteEmailPayload } from "@/components/contact-supplier-modal";
import { SupplierLogo } from "@/components/supplier-logo";
import { BASE_PATH } from "@/lib/base-path";
import { SUPPLIERS, type Supplier } from "@/lib/suppliers";

const SUGGESTED_COUNT = 5;

/** Other catalog suppliers the buyer could contact — skips anyone already messaged. */
function suggestedMatches(payload: QuoteEmailPayload): Supplier[] {
  const skip = new Set(payload.contactedIds ?? []);
  if (payload.supplierId) skip.add(payload.supplierId);
  return SUPPLIERS.filter((supplier) => {
    if (skip.has(supplier.id)) return false;
    if (supplier.name === payload.supplierName) return false;
    return true;
  }).slice(0, SUGGESTED_COUNT);
}

type BuyerDeclineEmailProps = {
  /** When true, append five other matching suppliers the buyer can contact. */
  showMatches: boolean;
};

/**
 * Buyer's Gmail: Thomas telling them a supplier declined. Two prototype
 * versions share this body — messaging only, or messaging plus suggestions.
 */
export function BuyerDeclineEmail({ showMatches }: BuyerDeclineEmailProps) {
  const { loaded, payload } = useQuoteEmailPayload();
  const matches = payload && showMatches ? suggestedMatches(payload) : [];

  return (
    <GmailShell accountInitial={MOCK_BUYER.name.charAt(0).toUpperCase()}>
      {loaded && !payload && (
        <div className="gm-empty">
          <p className="mar-0">
            No quote request yet — when a supplier clicks Not interested, the
            notification lands here.
          </p>
        </div>
      )}

      {payload && (
        <GmailMessageFrame
          subject={`${payload.supplierName} is not able to complete your contact request`}
          toLine={`to ${MOCK_BUYER.email}`}
          sentAt={payload.sentAt}
        >
          <p className="mar-0">Hi {MOCK_BUYER.firstName},</p>
          <p className="mar-0">
            <strong>{payload.supplierName}</strong> isn't able to take on your request for{" "}
            <strong>{payload.projectName}</strong> right now.
          </p>
          <p className="mar-0">
            That's a normal part of sourcing — and it doesn't slow you down. Your search is
            still open, and other matching suppliers are ready to hear from you.
          </p>
          <div className="contact-email-ctas">
            <a className="contact-email-cta-primary" href={`${BASE_PATH}/`}>
              Continue sourcing suppliers
            </a>
          </div>

          {showMatches && matches.length > 0 && (
            <div className="contact-email-alts">
              <p className="contact-email-alts-title mar-0">
                Here are {matches.length} other suppliers you can contact next:
              </p>
              <ul className="contact-email-alt-list">
                {matches.map((supplier) => (
                  <li className="contact-email-alt" key={supplier.id}>
                    <span className="contact-email-alt-logo" aria-hidden="true">
                      <SupplierLogo name={supplier.name} size={36} />
                    </span>
                    <div className="contact-email-alt-meta">
                      <p className="contact-email-alt-name mar-0">{supplier.name}</p>
                      <p className="contact-email-alt-facts mar-0">
                        {supplier.city}, {supplier.state}
                        {supplier.companyTypes[0] ? ` · ${supplier.companyTypes[0]}` : ""}
                      </p>
                    </div>
                    <button type="button" className="contact-email-alt-cta">
                      Contact
                    </button>
                  </li>
                ))}
              </ul>
              <p className="contact-email-alts-note mar-0">
                These suppliers met the same requirements as your original search. Reach
                out to any of them to keep your project moving.
              </p>
            </div>
          )}

          <p className="contact-email-foot mar-0">
            We recommend contacting 3 or more suppliers to get the best chance of receiving
            a fast response.
          </p>
        </GmailMessageFrame>
      )}
    </GmailShell>
  );
}
