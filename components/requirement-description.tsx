"use client";

import { Fragment, useRef } from "react";

const REQUIREMENT_LINE = /^([^:]+):\s*(.+)$/;

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function RequirementLine({ line }: { line: string }) {
  const match = line.match(REQUIREMENT_LINE);
  if (!match) return <>{line}</>;
  return (
    <>
      {match[1]}: <strong>{match[2]}</strong>
    </>
  );
}

/** Seed HTML for the contact dialog editor — values after the colon are bold. */
export function descriptionToHtml(text: string) {
  if (!text) return "";
  return text
    .split("\n")
    .map((line) => {
      const match = line.match(REQUIREMENT_LINE);
      if (!match) return escapeHtml(line);
      return `${escapeHtml(match[1])}: <strong>${escapeHtml(match[2])}</strong>`;
    })
    .join("<br>");
}

function editorPlainText(node: HTMLElement) {
  return (node.innerText ?? "").replace(/\u00a0/g, " ").replace(/\n+$/, "");
}

/**
 * Renders a requirements list so each selection after the colon reads
 * heavier than its label. Used on the TFI lead Description and the
 * supplier-email quote of the same box.
 */
export function RequirementDescription({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const lines = text.split("\n");
  return (
    <p className={className}>
      {lines.map((line, index) => (
        <Fragment key={index}>
          {index > 0 ? <br /> : null}
          <RequirementLine line={line} />
        </Fragment>
      ))}
    </p>
  );
}

/**
 * Project-description field: looks like the Tailoft textarea, but values
 * after each colon start bold. A hidden textarea carries the plain text
 * for FormData / localStorage.
 */
export function DescriptionEditor({
  id,
  name,
  initial,
  placeholder,
}: {
  id: string;
  name: string;
  initial: string;
  placeholder: string;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const hiddenRef = useRef<HTMLTextAreaElement>(null);

  return (
    <>
      <div
        ref={editorRef}
        id={id}
        className="contact-desc-editor"
        contentEditable
        role="textbox"
        aria-multiline="true"
        data-placeholder={placeholder}
        suppressContentEditableWarning
        dangerouslySetInnerHTML={{ __html: descriptionToHtml(initial) }}
        onInput={() => {
          if (hiddenRef.current && editorRef.current) {
            hiddenRef.current.value = editorPlainText(editorRef.current);
          }
        }}
        onPaste={(event) => {
          event.preventDefault();
          const text = event.clipboardData.getData("text/plain");
          document.execCommand("insertText", false, text);
        }}
      />
      <textarea
        ref={hiddenRef}
        name={name}
        required
        defaultValue={initial}
        className="contact-desc-value"
        tabIndex={-1}
        aria-hidden="true"
        onInvalid={(event) => {
          event.preventDefault();
          editorRef.current?.focus();
        }}
      />
    </>
  );
}
