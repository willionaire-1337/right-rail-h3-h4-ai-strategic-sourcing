"use client";

import { BuyerDeclineEmail } from "@/components/buyer-decline-email";

/** Decline notification plus five other suppliers who matched the search. */
export default function BuyerEmailMatchesPage() {
  return <BuyerDeclineEmail showMatches={true} />;
}
