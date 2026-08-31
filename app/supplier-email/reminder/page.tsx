"use client";

import { SupplierQuoteEmail } from "@/components/supplier-quote-email";

/** Next-day follow-up if the supplier hasn't replied to the original request. */
export default function SupplierReminderEmailPage() {
  return <SupplierQuoteEmail variant="reminder" />;
}
