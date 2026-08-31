"use client";

import { BuyerDeclineEmail } from "@/components/buyer-decline-email";

/** Messaging-only buyer notification after a supplier clicks Not interested. */
export default function BuyerEmailPage() {
  return <BuyerDeclineEmail showMatches={false} />;
}
