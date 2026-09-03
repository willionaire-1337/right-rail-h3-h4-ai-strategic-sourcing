"use client";

import Image from "next/image";
import { BASE_PATH } from "@/lib/base-path";

/** Logos on the trust strip — wordmarks only, set in type. */
const TRUSTED_BY = ["BOEING", "3M", "NASA", "Rockwell Collins", "General Dynamics", "Kraft"];

type LoginScreenProps = {
  open: boolean;
  /** Any click anywhere stands in for a completed login. */
  onDismiss: () => void;
};

/**
 * Login wall shown when an unauthenticated buyer tries to send. Nothing here
 * authenticates: this is the prototype's stand-in for the real Thomas login,
 * so a click anywhere returns the buyer to the form as a signed-in user.
 */
export function LoginScreen({ open, onDismiss }: LoginScreenProps) {
  if (!open) return null;

  return (
    <div
      className="login-screen"
      role="dialog"
      aria-modal="true"
      aria-label="Login to Thomas"
      onClick={onDismiss}
    >
      <section className="login-pane">
        <Image
          className="login-wordmark"
          src={`${BASE_PATH}/thomas-wordmark.png`}
          width={148}
          height={30}
          alt="Thomas"
        />

        <div className="login-form">
          <h1 className="login-title mar-0">Login to Thomas</h1>

          {/* Notched border label, as the real login draws it. */}
          <div className="login-field">
            <span className="login-field-label">Business Email*</span>
            <input type="email" aria-label="Business Email" readOnly />
          </div>

          <button type="button" kind="primary" className="login-continue">
            Continue
          </button>

          <p className="login-terms mar-0">
            By continuing, you agree to our <a href="#">Terms</a> and{" "}
            <a href="#">Privacy Policy</a>.
          </p>
          <p className="login-register mar-0">
            Don&apos;t have an account? <a href="#">Register for free</a>
          </p>
        </div>
      </section>

      <aside className="login-aside">
        <h2 className="login-aside-title mar-0">2.2M+ Businesses Trust Thomas</h2>

        {/* Buyer-to-supplier match, the panel's one piece of product proof. */}
        <div className="login-match">
          <div className="login-match-card">
            <span className="login-match-role">Buyer</span>
            <div className="login-match-party">
              <span className="login-match-avatar" aria-hidden="true" />
              <div>
                <strong>Volt Mobility</strong>
                <span>Los Angeles, CA · EV / Automotive</span>
              </div>
            </div>
            <p className="login-match-quote mar-0">
              &ldquo;Sheet metal battery tray, IATF 16949&rdquo;
            </p>
            <span className="login-match-badge">
              <l-icon name="check" aria-hidden="true" /> Matched
            </span>
            <span className="login-match-role">Supplier</span>
            <div className="login-match-party">
              <span className="login-match-avatar" aria-hidden="true" />
              <div>
                <strong>American Fab &amp; Form</strong>
                <span>Manchester, NH</span>
              </div>
            </div>
            <p className="login-match-spec mar-0">IATF 16949 · Sheet Metal · Automotive</p>
          </div>
        </div>

        <div className="login-trust">
          <p className="mar-0">Trusted by thousands of industry leaders</p>
          <ul>
            {TRUSTED_BY.map((brand) => (
              <li key={brand}>{brand}</li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
