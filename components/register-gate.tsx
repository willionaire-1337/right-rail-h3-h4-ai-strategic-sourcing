"use client";

import Image from "next/image";
import { useEffect } from "react";
import { BASE_PATH } from "@/lib/base-path";

type RegisterGateProps = {
  open: boolean;
  onClose: () => void;
  /** Hands off to the login screen — the buyer comes back signed in. */
  onContinue: () => void;
};

/**
 * Registration wall in front of saving a shortlist. Nothing here registers
 * anyone: it hands the buyer to the login stand-in, which returns them to the
 * step they were trying to reach.
 */
export function RegisterGate({ open, onClose, onContinue }: RegisterGateProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="gate-scrim" role="presentation" onClick={onClose}>
      <div
        className="register-gate"
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-gate-title"
        onClick={(event) => event.stopPropagation()}
      >
        <button type="button" className="gate-close" aria-label="Close" onClick={onClose}>
          <l-icon name="xmark" />
        </button>

        <div className="register-gate-brand">
          <Image
            src={`${BASE_PATH}/thomas-wordmark.png`}
            width={238}
            height={48}
            alt="Thomas"
          />
          <span>For Industry.</span>
        </div>

        <h2 id="register-gate-title" className="register-gate-title mar-0">
          Register to continue
        </h2>
        <p className="register-gate-sub mar-0">
          In less than a minute you&apos;ll have access to 500k+ Suppliers
        </p>

        <button type="button" kind="primary" className="register-gate-cta" onClick={onContinue}>
          Continue to Sign In <l-icon name="arrow-right-to-bracket" aria-hidden="true" />
        </button>

        <p className="register-gate-alt mar-0">
          New to Thomas?{" "}
          <a
            href="#"
            onClick={(event) => {
              event.preventDefault();
              onContinue();
            }}
          >
            Create Your Free Account
          </a>
        </p>
      </div>
    </div>
  );
}
