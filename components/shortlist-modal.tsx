"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import { BASE_PATH } from "@/lib/base-path";

/** Seeded shortlist so the picker has somewhere to add to on a fresh session. */
const EXISTING_SHORTLISTS = [{ name: "my shortlist", count: 2 }];

type ShortlistModalProps = {
  open: boolean;
  onClose: () => void;
  /** How many suppliers the rail is handing over — drives the confirmation. */
  supplierCount: number;
  /** Records the picks against the chosen list and closes. */
  onSave: (listName: string) => void;
};

/**
 * Shortlist picker, opened from the rail's "Add to shortlist". The buyer
 * either names a new list or drops the selection into one they already have —
 * naming a new list wins, since typing into it is the more deliberate act.
 */
export function ShortlistModal({ open, onClose, supplierCount, onSave }: ShortlistModalProps) {
  const [newList, setNewList] = useState("");
  /** Empty until the buyer picks one, so Save has a real disabled state. */
  const [existing, setExisting] = useState("");

  // Fresh picker each time it opens (state adjusted during render, per
  // react.dev "adjusting state when a prop changes").
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setNewList("");
      setExisting("");
    }
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    onSave(newList.trim() || existing);
  };

  return (
    <div className="gate-scrim" role="presentation" onClick={onClose}>
      <div
        className="shortlist-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortlist-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="gate-close" aria-label="Close" onClick={onClose}>
          <l-icon name="xmark" />
        </button>

        <div className="shortlist-brand">
          <Image
            src={`${BASE_PATH}/thomas-wordmark.png`}
            width={238}
            height={48}
            alt="Thomas"
          />
          <span>For Industry.</span>
        </div>

        <span className="shortlist-check" aria-hidden="true">
          <l-icon name="circle-check" />
        </span>

        <h2 id="shortlist-title" className="shortlist-title mar-0">
          Add {supplierCount === 1 ? "supplier" : "suppliers"} to your Shortlist
        </h2>
        <p className="shortlist-manage mar-0">
          Manage your{" "}
          <a href="#" onClick={(event) => event.preventDefault()}>
            saved suppliers here.
          </a>
        </p>

        <form className="shortlist-form" onSubmit={submit}>
          <fieldset>
            <label htmlFor="shortlist-new">Create a new shortlist:</label>
            <input
              id="shortlist-new"
              type="text"
              value={newList}
              onChange={(event) => setNewList(event.target.value)}
            />
          </fieldset>

          <fieldset>
            <label htmlFor="shortlist-existing">Add to existing shortlist:</label>
            <select
              id="shortlist-existing"
              value={existing}
              // Naming a new list is the more deliberate choice, so picking an
              // existing one clears whatever was half-typed above it.
              onChange={(event) => {
                setExisting(event.target.value);
                setNewList("");
              }}
            >
              <option value="">Select a shortlist</option>
              {EXISTING_SHORTLISTS.map((list) => (
                <option key={list.name} value={list.name}>
                  {list.name} ({list.count})
                </option>
              ))}
            </select>
          </fieldset>

          <button
            kind="primary"
            type="submit"
            className="shortlist-save"
            // Nothing to save to until a list is named or picked.
            disabled={!newList.trim() && !existing}
          >
            Save to Shortlist
          </button>
        </form>
      </div>
    </div>
  );
}
