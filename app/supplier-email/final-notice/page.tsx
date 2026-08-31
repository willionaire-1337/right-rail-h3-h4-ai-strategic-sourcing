"use client";

import { SupplierQuoteEmail } from "@/components/supplier-quote-email";

/** Last notice: respond, or the buyer's RFI goes to other suppliers. */
export default function SupplierFinalNoticeEmailPage() {
  return <SupplierQuoteEmail variant="final-notice" />;
}
