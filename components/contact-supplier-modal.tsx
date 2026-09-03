"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DescriptionEditor } from "@/components/requirement-description";
import { SupplierLogo } from "@/components/supplier-logo";
import { BASE_PATH } from "@/lib/base-path";
import type { Supplier } from "@/lib/suppliers";

/** Drawing and spec formats suppliers expect with an RFQ. */
const QUOTE_FILE_TYPES = ".pdf, .step, .iges, .dxf, .dwg, .zip";


/** What the buyer is making — fixed for this prototype's bracket use case,
    unless they logged a Part type answer in the left rail. */
const DEFAULT_PART = "brackets";

/** Stand-in for the signed-in buyer — the prototype has no accounts, but the
    supplier-facing email needs a real-looking sender to reply to. */
export const MOCK_BUYER = {
  name: "Sarah Mitchell",
  firstName: "Sarah",
  company: "Meridian Dynamics",
  email: "s.mitchell@meridiandynamics.com",
  phone: "(312) 555-0184",
};

/** Where the submitted quote is stashed for the /supplier-email page — the
    prototype has no backend, so the "sent" email travels via localStorage. */
export const QUOTE_EMAIL_STORAGE_KEY = "supplier-email-preview";

/** Everything the supplier-inbox page needs to render the received email. */
export type QuoteEmailPayload = {
  supplierName: string;
  /** Optional on older stashed payloads from before this field existed. */
  supplierId?: string;
  /** Everyone this send went to — declined-supplier suggestions skip these. */
  contactedIds?: string[];
  supplierCount: number;
  projectName: string;
  description: string;
  quantity: string;
  needBy: string;
  requirements: ContactRequirement[];
  sentAt: string;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/**
 * Short editable project name seeded from the part and the strongest
 * selections (material + process) — e.g. "Aluminum Progressive Die Brackets".
 * Same rules-based approach as the description — no AI. Multi-value answers
 * keep only their first value so the name stays short.
 */
export function buildProjectName(requirements: ContactRequirement[]): string {
  const byLabel = new Map(
    requirements.map((requirement) => [requirement.label.toLowerCase(), requirement.value]),
  );
  const first = (label: string) => byLabel.get(label)?.split(",")[0]?.trim();

  const part = first("product") ?? first("part type") ?? DEFAULT_PART;
  // Title-style: "Aluminum Progressive Die Brackets", never "… brackets".
  const partName = part.charAt(0).toUpperCase() + part.slice(1);
  return [first("material"), first("process"), partName].filter(Boolean).join(" ");
}

/**
 * The description box is the buyer's own words now — the logged spec rides
 * alongside it as removable requirement chips, so seeding the box with the
 * same list would only duplicate it.
 */
export function buildProjectDescription(): string {
  return "";
}

/** A requirement the buyer logged in the left rail, e.g. Process: Progressive Die. */
export type ContactRequirement = {
  label: string;
  value: string;
};

type ContactSupplierModalProps = {
  /** Every supplier the message goes to — one from a card, several once selected. */
  suppliers: Supplier[];
  open: boolean;
  onClose: () => void;
  /** Logged left-rail answers — they seed the project description list. */
  requirements?: ContactRequirement[];
};

/**
 * Request Quote dialog opened from a supplier result. Prototype-only —
 * submitting flips to a confirmation instead of sending anything.
 */
export function ContactSupplierModal({
  suppliers,
  open,
  onClose,
  requirements = [],
}: ContactSupplierModalProps) {
  /** Flips the dialog to the sent confirmation once the email page opens. */
  const [sent, setSent] = useState(false);
  const [files, setFiles] = useState<File[]>([]);
  /** Requirement chips cleared before sending, by label. */
  const [droppedRequirements, setDroppedRequirements] = useState<string[]>([]);

  /** The "Sending to" scroller and how many chips sit off its right edge. */
  const recipientsRef = useRef<HTMLDivElement>(null);
  const [offscreenCount, setOffscreenCount] = useState(0);

  /** Counts the chips scrolled past the right edge, so "+N" tracks the scroll
      rather than a fixed preview length. */
  const measureRecipients = useCallback(() => {
    const scroller = recipientsRef.current;
    if (!scroller) return;
    // Measured against the scrollport's own edge, so scrolling to the end
    // always lands on zero and retires the chip.
    const edge = scroller.getBoundingClientRect().right;
    let hidden = 0;
    for (const chip of scroller.querySelectorAll(".contact-recipient-pill")) {
      if (chip.getBoundingClientRect().right > edge + 1) hidden += 1;
    }
    setOffscreenCount(hidden);
  }, []);

  // Measure once the strip is laid out, and again whenever the dialog is
  // resized — "+N" is a live count, not a fixed preview length.
  useEffect(() => {
    const scroller = recipientsRef.current;
    if (!scroller) return;
    measureRecipients();
    const observer = new ResizeObserver(measureRecipients);
    observer.observe(scroller);
    return () => observer.disconnect();
  }, [measureRecipients, open, sent, suppliers.length]);

  // Fresh form each time the dialog opens (state adjusted during render, per
  // react.dev "adjusting state when a prop changes").
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSent(false);
      setFiles([]);
      setOffscreenCount(0);
      setDroppedRequirements([]);
    }
  }

  const addFiles = (added: FileList | null | undefined) => {
    if (!added) return;
    setFiles((current) => {
      const next = [...current];
      for (const file of added) {
        if (!next.some((it) => it.name === file.name && it.size === file.size)) next.push(file);
      }
      return next;
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || suppliers.length === 0) return null;

  const single = suppliers.length === 1 ? suppliers[0] : null;
  /** The supplier whose copy of the email the preview is addressed to. */
  const previewSupplier = suppliers[0];
  /** What still ships with the request, after any chips the buyer cleared. */
  const keptRequirements = requirements.filter(
    (requirement) => !droppedRequirements.includes(requirement.label),
  );

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const field = (name: string) => (data.get(name) ?? "").toString().trim();
    const payload: QuoteEmailPayload = {
      supplierName: previewSupplier.name,
      supplierId: previewSupplier.id,
      contactedIds: suppliers.map((supplier) => supplier.id),
      supplierCount: suppliers.length,
      projectName: field("projectName"),
      description: field("description"),
      quantity: field("quantity"),
      needBy: field("needBy"),
      requirements: keptRequirements,
      sentAt: new Date().toISOString(),
    };
    localStorage.setItem(QUOTE_EMAIL_STORAGE_KEY, JSON.stringify(payload));
    // The supplier's inbox lives on its own page — open it beside the flow so
    // the sourcing session stays intact. Called inside the submit handler, so
    // popup blockers treat it as user-initiated.
    window.open(`${BASE_PATH}/supplier-email`, "_blank");
    setSent(true);
  };

  return (
    <div className="gate-scrim" role="presentation" onClick={onClose}>
      <div
        className="contact-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-supplier-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="gate-close" aria-label="Close" onClick={onClose}>
          <l-icon name="xmark" />
        </button>

        {sent ? (
          <div className="contact-sent">
            <div className="contact-sent-head">
              <l-icon name="circle-check" aria-hidden="true" />
              <div>
                <h2 className="contact-title mar-0">Quote request sent</h2>
                <p className="mar-0 txt-smaller txt-darkblue-75">
                  {single
                    ? `${single.name} has your request and can reply with a quote.`
                    : `All ${suppliers.length} suppliers have your request and can reply with a quote.`}
                </p>
              </div>
            </div>

            {/* What the buyer can expect, rather than links into the email
                previews — the chase runs on its own once the request is out. */}
            <ol className="contact-sent-next">
              <li>Quotes come back to your inbox, usually within two business days.</li>
              <li>No reply? Thomas sends a reminder the next day, then a final notice.</li>
              <li>Still nothing, and the RFI is offered to other matching suppliers.</li>
            </ol>

            <div className="contact-sent-actions">
              <button kind="primary" onClick={onClose}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <h2 id="contact-supplier-title" className="contact-title mar-0">
              Contact {single ? single.name : `${suppliers.length} Suppliers`}
            </h2>

            {!single && (
              <div
                className="contact-recipients"
                aria-label="Suppliers receiving this request"
              >
                <span className="contact-reqs-title">Sending to</span>
                {/* One line, scrolled sideways: the recipient list never
                    wraps into the form, and "+N" sticks to the right edge as a
                    live count of who's still off-screen. */}
                <div
                  className="contact-reqs-list contact-recipients-strip"
                  ref={recipientsRef}
                  onScroll={measureRecipients}
                >
                  {suppliers.map((recipient) => (
                    <span className="contact-recipient-pill" key={recipient.id}>
                      <span className="contact-recipient-logo" aria-hidden="true">
                        <SupplierLogo name={recipient.name} size={22} />
                      </span>
                      {recipient.name}
                    </span>
                  ))}
                  <button
                    type="button"
                    className="contact-recipient-more"
                    hidden={offscreenCount === 0}
                    aria-label={`Scroll to the other ${offscreenCount} suppliers`}
                    onClick={() => {
                      const scroller = recipientsRef.current;
                      if (!scroller) return;
                      scroller.scrollBy({
                        left: scroller.clientWidth * 0.8,
                        behavior: "smooth",
                      });
                    }}
                  >
                    +{offscreenCount}
                  </button>
                </div>
              </div>
            )}

            <form className="contact-form" onSubmit={submit}>
                <fieldset>
                  <label htmlFor="contact-quote-name">Project name</label>
                  <input
                    id="contact-quote-name"
                    name="projectName"
                    type="text"
                    required
                    defaultValue={buildProjectName(requirements)}
                    placeholder="e.g. Stainless mounting bracket — Rev B"
                  />
                </fieldset>
                <fieldset>
                  <label htmlFor="contact-quote-desc">Project description</label>
                  <DescriptionEditor
                    id="contact-quote-desc"
                    name="description"
                    initial={buildProjectDescription()}
                    placeholder="Add additional details about your request..."
                  />
                </fieldset>
                {/* The logged spec travels as structured requirements rather
                    than as text inside the description, so the buyer can clear
                    any single one before sending. */}
                {keptRequirements.length > 0 && (
                  <fieldset>
                    <label htmlFor="contact-quote-reqs">Requirements</label>
                    {/* Same element as the results header's facet pills:
                        caption over a blue pill with its own clear control,
                        wrapping onto new lines as the spec grows. */}
                    <div className="answer-pill-row" id="contact-quote-reqs">
                      {keptRequirements.map((requirement) => (
                        <div className="answer-pill-stack" key={requirement.label}>
                          <span className="answer-pill-label">{requirement.label}</span>
                          <span className="answer-pill">
                            {requirement.value}
                            <button
                              type="button"
                              className="answer-pill-remove"
                              aria-label={`Remove ${requirement.label}: ${requirement.value}`}
                              onClick={() =>
                                setDroppedRequirements((dropped) => [...dropped, requirement.label])
                              }
                            >
                              <l-icon name="xmark" aria-hidden="true" />
                            </button>
                          </span>
                        </div>
                      ))}
                    </div>
                  </fieldset>
                )}
                <fieldset>
                  <label htmlFor="contact-quote-files">Attachments</label>
                  <l-fileupload
                    ondragover={(event: DragEvent) => event.preventDefault()}
                    ondrop={(event: DragEvent) => {
                      event.preventDefault();
                      addFiles(event.dataTransfer?.files);
                    }}
                  >
                    <label htmlFor="contact-quote-files">
                      Drag &amp; drop or click to upload drawings and specs
                    </label>
                    <input
                      id="contact-quote-files"
                      type="file"
                      multiple
                      accept={QUOTE_FILE_TYPES}
                      onChange={(event) => {
                        addFiles(event.target.files);
                        event.target.value = "";
                      }}
                    />
                  </l-fileupload>
                  {files.map((file) => (
                    <l-filepreview key={`${file.name}-${file.size}`}>
                      <span slot="name">{file.name}</span>
                      <span slot="size">{formatFileSize(file.size)}</span>
                      <button
                        slot="remove"
                        type="button"
                        aria-label={`Remove ${file.name}`}
                        onClick={() =>
                          setFiles((current) => current.filter((it) => it !== file))
                        }
                      />
                    </l-filepreview>
                  ))}
                </fieldset>
                <div className="contact-form-row">
                  <fieldset>
                    <label htmlFor="contact-quote-qty">Estimated quantity</label>
                    <input
                      id="contact-quote-qty"
                      name="quantity"
                      type="text"
                      placeholder="e.g. 5,000 / year"
                    />
                  </fieldset>
                  <fieldset>
                    <label htmlFor="contact-quote-date">Response needed by</label>
                    <input id="contact-quote-date" name="needBy" type="date" />
                  </fieldset>
                </div>
                <div className="contact-actions">
                  <label className="contact-consent">
                    <input type="checkbox" defaultChecked required />
                    <span>
                      By requesting a quote you agree to share your project and contact details.
                    </span>
                  </label>
                  <button kind="primary" type="submit">
                    Send Inquiry
                  </button>
                </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
