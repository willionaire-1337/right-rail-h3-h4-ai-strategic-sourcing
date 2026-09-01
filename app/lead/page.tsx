import type { Metadata } from "next";
import { LeadDetails } from "@/components/lead-details";

export const metadata: Metadata = {
  title: "Leads — Thomas For Industry",
};

/** Supplier dashboard lead detail, opened from View contact details. */
export default function LeadPage() {
  return <LeadDetails />;
}
