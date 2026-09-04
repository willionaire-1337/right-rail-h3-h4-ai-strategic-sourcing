"use client";

import { useEffect, useState } from "react";
import { LoginScreen } from "@/components/login-screen";
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
  /** Optional; no longer collected on the contact form. */
  quantity?: string;
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
/** Today as yyyy-mm-dd, to compare against a date input's own format. */
function todayISO(): string {
  const now = new Date();
  const month = `${now.getMonth() + 1}`.padStart(2, "0");
  const day = `${now.getDate()}`.padStart(2, "0");
  return `${now.getFullYear()}-${month}-${day}`;
}

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
  /** Signed in for this session — the first send bounces through the login
      wall, and the buyer comes back to press the real Send. */
  const [loggedIn, setLoggedIn] = useState(false);
  const [loginOpen, setLoginOpen] = useState(false);

  /** Per-field messages raised on a failed send, keyed by field name. */
  const [errors, setErrors] = useState<Record<string, string>>({});

  /** Requirement chips cleared before sending, by label. */
  const [droppedRequirements, setDroppedRequirements] = useState<string[]>([]);

  // Fresh form each time the dialog opens (state adjusted during render, per
  // react.dev "adjusting state when a prop changes").
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setSent(false);
      setFiles([]);
      setDroppedRequirements([]);
      setLoggedIn(false);
      setLoginOpen(false);
      setErrors({});
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

  /** Drops a field's message the moment the buyer starts fixing it. */
  const clearError = (name: string) =>
    setErrors((current) => {
      if (!current[name]) return current;
      const next = { ...current };
      delete next[name];
      return next;
    });

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    // First press sends the buyer to log in; they return to press it again.
    if (!loggedIn) {
      setLoginOpen(true);
      return;
    }
    const data = new FormData(event.currentTarget);
    const field = (name: string) => (data.get(name) ?? "").toString().trim();

    // Everything the buyer must fix before this can go out. Checked here
    // rather than left to the browser so the messages sit on the fields.
    const found: Record<string, string> = {};
    if (!field("projectName")) {
      found.projectName = "Give this project a name so suppliers can identify it.";
    }
    const needBy = field("needBy");
    if (needBy && needBy < todayISO()) {
      found.needBy = "Pick a date in the future.";
    }
    if (!data.get("consent")) {
      found.consent = "Confirm this before sending.";
    }
    setErrors(found);
    if (Object.keys(found).length > 0) {
      // Put the buyer on the first thing that needs fixing.
      const first = Object.keys(found)[0];
      const el = event.currentTarget.querySelector<HTMLElement>(`[name="${first}"]`);
      el?.focus();
      el?.scrollIntoView({ block: "center", behavior: "smooth" });
      return;
    }

    const payload: QuoteEmailPayload = {
      supplierName: previewSupplier.name,
      supplierId: previewSupplier.id,
      contactedIds: suppliers.map((supplier) => supplier.id),
      supplierCount: suppliers.length,
      projectName: field("projectName"),
      description: field("description"),
      needBy: field("needBy"),
      requirements: keptRequirements,
      sentAt: new Date().toISOString(),
    };
    localStorage.setItem(QUOTE_EMAIL_STORAGE_KEY, JSON.stringify(payload));
    setSent(true);
  };

  /** Done closes the dialog and opens the supplier's copy of the email. The
      buyer reads the confirmation first — the inbox is the next beat, not an
      interruption. Called from the click, so popup blockers allow it. */
  const finish = () => {
    window.open(`${BASE_PATH}/supplier-email`, "_blank");
    onClose();
  };

  return (
    <>
      <LoginScreen
        open={loginOpen}
        onDismiss={() => {
          setLoggedIn(true);
          setLoginOpen(false);
        }}
      />
    <div className="gate-scrim" role="presentation" onClick={onClose}>
      {/* Shell exists so the close button can sit outside the dialog, which
          scrolls and would otherwise clip it. */}
      <div className="contact-shell" onClick={(event) => event.stopPropagation()}>
        <button type="button" className="contact-close" aria-label="Close" onClick={onClose}>
          <l-icon name="xmark" />
        </button>
      <div
        className="contact-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-supplier-title"
      >

        {sent ? (
          <div className="contact-sent">
            <div className="contact-sent-head">
              <l-icon name="circle-check" aria-hidden="true" />
              <div>
                <h2 className="contact-title mar-0">Request sent!</h2>
                <p className="mar-0 txt-smaller txt-darkblue-75">
                  Your contact message has been successfully sent to the
                  suppliers selected.
                </p>
              </div>
            </div>

            <div className="contact-sent-actions">
              {/* No requests page in the prototype yet, so this just closes. */}
              <button kind="primary" onClick={onClose}>
                View your requests
              </button>
              <button kind="neutral" onClick={finish}>
                Done
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="contact-heading">
              <h2 id="contact-supplier-title" className="contact-title mar-0">
                Contact {single ? single.name : "Suppliers"}
              </h2>
              {/* Who the request goes out as — editable before sending. */}
              <button type="button" className="contact-sender">
                <span className="contact-sender-avatar" aria-hidden="true">TG</span>
                <span className="contact-sender-id">
                  <strong>Tom Greco</strong>
                  <span>Xometry</span>
                </span>
                <l-icon name="pen" aria-hidden="true" />
                <span className="sr-only">Edit sender</span>
              </button>
            </div>

            {!single && (
              <div
                className="contact-recipients"
                aria-label="Suppliers receiving this request"
              >
                <span className="contact-reqs-title">
                  Sending to <span className="contact-sending-count">{suppliers.length}</span>{" "}
                  suppliers
                </span>
                {/* One line, scrolled sideways: the recipient list never wraps
                    into the form. */}
                <div className="contact-reqs-list contact-recipients-strip">
                  {suppliers.map((recipient) => (
                    <span className="contact-recipient-pill" key={recipient.id}>
                      <span className="contact-recipient-logo" aria-hidden="true">
                        <SupplierLogo name={recipient.name} size={22} />
                      </span>
                      {recipient.name}
                    </span>
                  ))}
                </div>
              </div>
            )}

            <form className="contact-form" noValidate onSubmit={submit}>
                <fieldset>
                  <label htmlFor="contact-quote-name">Project name</label>
                  <input
                    id="contact-quote-name"
                    name="projectName"
                    type="text"
                    required
                    defaultValue={buildProjectName(requirements)}
                    placeholder="e.g. Stainless mounting bracket — Rev B"
                    aria-invalid={errors.projectName ? true : undefined}
                    aria-describedby={errors.projectName ? "contact-quote-name-error" : undefined}
                    onInput={() => clearError("projectName")}
                  />
                  {errors.projectName && (
                    <p className="field-error mar-0" id="contact-quote-name-error" role="alert">
                      <l-icon name="circle-exclamation" aria-hidden="true" /> {errors.projectName}
                    </p>
                  )}
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
                    <p className="contact-reqs-note mar-0">
                      Your requirements are automatically attached to your request
                    </p>
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
                    <label className="field-label" htmlFor="contact-quote-date">
                      Response needed by
                      <span className="field-hint">optional</span>
                    </label>
                    <input
                      id="contact-quote-date"
                      name="needBy"
                      type="date"
                      aria-invalid={errors.needBy ? true : undefined}
                      aria-describedby={errors.needBy ? "contact-quote-date-error" : undefined}
                      onInput={() => clearError("needBy")}
                    />
                    {errors.needBy && (
                      <p className="field-error mar-0" id="contact-quote-date-error" role="alert">
                        <l-icon name="circle-exclamation" aria-hidden="true" /> {errors.needBy}
                      </p>
                    )}
                  </fieldset>
                </div>
                <div className="contact-actions">
                  <label className="contact-consent" data-invalid={errors.consent ? true : undefined}>
                    <input
                      type="checkbox"
                      name="consent"
                      defaultChecked
                      required
                      aria-invalid={errors.consent ? true : undefined}
                      onChange={() => clearError("consent")}
                    />
                    <span>
                      I verify that no confidential or export-controlled data was uploaded
                      or entered in this project.
                    </span>
                  </label>
                  {errors.consent && (
                    <p className="field-error mar-0" role="alert">
                      <l-icon name="circle-exclamation" aria-hidden="true" /> {errors.consent}
                    </p>
                  )}
                  <button kind="primary" type="submit">
                    {loggedIn ? "Send Inquiry" : "Log in to Send Inquiry"}
                  </button>
                  {/* Quiet second exit: same link treatment as the rail's
                      "+ Add to shortlist", under the primary action. */}
                  <button type="button" className="rail-sub contact-save-draft">
                    {loggedIn ? "Save Draft" : "Log in to Save Draft"}
                  </button>
                </div>
            </form>
          </>
        )}
      </div>
      </div>
    </div>
    </>
  );
}
