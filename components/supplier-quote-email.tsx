"use client";

import { useState } from "react";
import Image from "next/image";
import { GmailMessageFrame, GmailShell, useQuoteEmailPayload } from "@/components/gmail-shell";
import {
  MOCK_BUYER,
  formatFileSize,
  type QuoteEmailPayload,
} from "@/components/contact-supplier-modal";
import { RequirementDescription } from "@/components/requirement-description";
import { BASE_PATH } from "@/lib/base-path";

export type SupplierEmailVariant = "original" | "reminder" | "final-notice";

/** Icon, label, and accent color for the stage indicator next to the logo —
    lets a supplier see where this email sits in the sequence without reading
    the subject line. */
const STAGE_META = {
  original: { icon: "paper-plane", label: "New quote request", className: "contact-email-stage-new" },
  reminder: { icon: "bell", label: "Reminder", className: "contact-email-stage-reminder" },
  "final-notice": { icon: "alarm-clock", label: "Final notice", className: "contact-email-stage-final" },
} as const;

/** Plausible inbox for the supplier receiving the quote request. */
function supplierInbox(name: string): string {
  const domain = name.toLowerCase().replace(/[^a-z0-9]+/g, "").slice(0, 24) || "supplier";
  return `quotes@${domain}.com`;
}

/** "2026-09-15" -> "September 15, 2026" for the email body. */
function formatNeedBy(value: string): string {
  const date = new Date(`${value}T00:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

/** Shift a stored ISO timestamp by whole days for the follow-up send dates. */
function shiftDays(iso: string, days: number): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime()) || days === 0) return iso;
  date.setDate(date.getDate() + days);
  return date.toISOString();
}

const VARIANT = {
  original: {
    inboxCount: 1,
    dayOffset: 0,
    subject: (projectName: string) => `New quote request: ${projectName}`,
  },
  reminder: {
    inboxCount: 2,
    dayOffset: 1,
    subject: (projectName: string) => `Reminder: quote request for ${projectName}`,
  },
  "final-notice": {
    inboxCount: 3,
    dayOffset: 2,
    subject: (projectName: string) =>
      `Final notice: ${projectName} will be sent to other suppliers`,
  },
} as const;

type SupplierQuoteEmailProps = {
  variant: SupplierEmailVariant;
};

/** Thomas wordmark + a stage label, so a supplier sees where this email sits
    in the sequence without reading the subject line. */
function EmailHeader({ variant }: { variant: SupplierEmailVariant }) {
  const stage = STAGE_META[variant];
  return (
    <div className="contact-email-header mar-0">
      <Image
        src={`${BASE_PATH}/thomas-wordmark.png`}
        width={80}
        height={16}
        alt="Thomas"
        className="contact-email-logo"
      />
      <span className={`contact-email-stage ${stage.className}`}>
        <l-icon name={stage.icon} aria-hidden="true" />
        {stage.label}
      </span>
    </div>
  );
}

/**
 * Supplier-facing quote email. Three beats share this body: the original
 * request, a next-day reminder if they haven't replied, and a final notice
 * that the RFI will go to other suppliers.
 */
export function SupplierQuoteEmail({ variant }: SupplierQuoteEmailProps) {
  const { loaded, payload } = useQuoteEmailPayload();
  const [declined, setDeclined] = useState(false);
  const inbox = payload ? supplierInbox(payload.supplierName) : "";
  const meta = VARIANT[variant];

  const decline = () => {
    setDeclined(true);
    window.open(`${BASE_PATH}/buyer-email`, "_blank");
  };

  return (
    <GmailShell
      accountInitial={payload ? payload.supplierName.charAt(0).toUpperCase() : "S"}
      inboxCount={meta.inboxCount}
    >
      {loaded && !payload && (
        <div className="gm-empty">
          <p className="mar-0">
            No quote request yet — send one from the sourcing prototype and it lands here.
          </p>
        </div>
      )}

      {payload && (
        <GmailMessageFrame
          subject={meta.subject(payload.projectName)}
          toLine={`to ${inbox} · reply-to ${MOCK_BUYER.email}`}
          sentAt={shiftDays(payload.sentAt, meta.dayOffset)}
        >
          <EmailHeader variant={variant} />
          <Opening variant={variant} payload={payload} />
          <ProjectRecap payload={payload} />
          {declined ? (
            <div className="contact-email-declined">
              <p className="mar-0">
                Thanks — we'll let {MOCK_BUYER.name} at {MOCK_BUYER.company} know you aren't
                interested.
              </p>
              <p className="mar-0 txt-smaller">Preview the notification they'll receive:</p>
              <div className="contact-email-ctas">
                <a
                  className="contact-email-cta-ghost"
                  href={`${BASE_PATH}/buyer-email`}
                  target="_blank"
                  rel="noreferrer"
                >
                  Buyer notification
                </a>
                <a
                  className="contact-email-cta-primary"
                  href={`${BASE_PATH}/buyer-email-matches`}
                  target="_blank"
                  rel="noreferrer"
                >
                  With suggested suppliers
                </a>
              </div>
            </div>
          ) : (
            <div className="contact-email-ctas">
              <button type="button" className="contact-email-cta-ghost" onClick={decline}>
                Not interested
              </button>
              <a
                className="contact-email-cta-primary"
                href={`${BASE_PATH}/lead/`}
                target="_blank"
                rel="noreferrer"
              >
                View contact details
              </a>
            </div>
          )}
          <p className="contact-email-reply mar-0">
            <l-icon name="paper-plane" aria-hidden="true" />
            You can reply to this email directly — your reply goes straight to{" "}
            {MOCK_BUYER.firstName} at {MOCK_BUYER.company}.
          </p>
          <Footer variant={variant} />
        </GmailMessageFrame>
      )}
    </GmailShell>
  );
}

function Opening({
  variant,
  payload,
}: {
  variant: SupplierEmailVariant;
  payload: QuoteEmailPayload;
}) {
  if (variant === "reminder") {
    return (
      <>
        <p className="mar-0">Hi {payload.supplierName} team,</p>
        <p className="mar-0">
          We&apos;re following up on a quote request from <strong>{MOCK_BUYER.name}</strong> at{" "}
          <strong>{MOCK_BUYER.company}</strong>{" "}
          that we sent yesterday. We haven&apos;t heard
          back yet — the project is still open.
        </p>
        <p className="mar-0">Here&apos;s a recap of the request:</p>
      </>
    );
  }

  if (variant === "final-notice") {
    return (
      <>
        <p className="mar-0">Hi {payload.supplierName} team,</p>
        <p className="mar-0">
          This is a final notice. <strong>{MOCK_BUYER.name}</strong> at{" "}
          <strong>{MOCK_BUYER.company}</strong>{" "}
          still hasn&apos;t received a response to their
          quote request for <strong>{payload.projectName}</strong>.
        </p>
        <l-alert kind="warning" class="contact-email-alert-note mar-0">
          <l-icon name="triangle-exclamation" aria-hidden="true" />
          If we don&apos;t hear from you, we&apos;ll send this RFI to other suppliers on Thomas
          who can take the work.
        </l-alert>
        <p className="mar-0">Here&apos;s the request again:</p>
      </>
    );
  }

  return (
    <>
      <p className="mar-0">Hi {payload.supplierName} team,</p>
      <p className="mar-0">
        <strong>{MOCK_BUYER.name}</strong> at <strong>{MOCK_BUYER.company}</strong> sent you a
        quote request through Thomas. Here are the project details:
      </p>
    </>
  );
}

function ProjectRecap({ payload }: { payload: QuoteEmailPayload }) {
  // Every logged smart-search answer, plus the response deadline — as a table
  // rather than a bulleted list, since a request can carry up to 13 answers
  // and a list of tiles stops working well past two or three.
  const rows = [
    ...payload.requirements.map((requirement) => ({
      label: requirement.label,
      value: requirement.value,
    })),
    ...(payload.needBy ? [{ label: "Response needed by", value: formatNeedBy(payload.needBy) }] : []),
  ];

  return (
    <>
      {payload.description && (
        <blockquote className="contact-email-desc mar-0">
          <RequirementDescription className="mar-0" text={payload.description} />
        </blockquote>
      )}
      {rows.length > 0 && (
        <div className="contact-email-req-table mar-0">
          <table>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <th scope="row">{row.label}</th>
                  <td>{row.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {payload.attachments && payload.attachments.length > 0 && (
        <div className="contact-email-attachments mar-0">
          {payload.attachments.map((file) => (
            <l-filepreview key={`${file.name}-${file.size}`}>
              <span slot="name">{file.name}</span>
              <span slot="size">{formatFileSize(file.size)}</span>
            </l-filepreview>
          ))}
        </div>
      )}
    </>
  );
}

function Footer({ variant }: { variant: SupplierEmailVariant }) {
  if (variant === "final-notice") {
    return (
      <p className="contact-email-foot mar-0">
        Sent via Thomas on behalf of {MOCK_BUYER.company}. Unanswered requests are offered to
        other matching suppliers.
      </p>
    );
  }

  return (
    <p className="contact-email-foot mar-0">
      Sent via Thomas on behalf of {MOCK_BUYER.company}. Most buyers expect a response within
      1–2 business days.
    </p>
  );
}
