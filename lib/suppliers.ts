import suppliersData from "./suppliers.json"

export type Supplier = {
  id: string
  name: string
  sponsored: boolean
  /** Verified marker (badge) on the supplier result. */
  verified?: boolean
  city: string
  state: string
  zip: string
  employees: string | null
  revenue: string | null
  founded: number | null
  companyTypes: string[]
  description: string
  capabilities: string[]
  certifications: string[]
  media: string[]
}

/**
 * Example supplier database for General Stamping Services (152408),
 * transcribed from supplier discovery search result pages.
 */
export const SUPPLIERS = suppliersData as Supplier[]

/**
 * Total suppliers in the Stamping Services category — the "out of" number for
 * match counts. (The local database holds a transcribed sample.)
 */
export const CATEGORY_SUPPLIER_COUNT = 2482

/** Shown wherever a supplier Thomas can't route a request to is offered. */
export const UNCONTACTABLE_NOTE =
  "This supplier cannot be contacted through Thomas, but can be added to your shortlist."

/**
 * Whether Thomas can route a request to the supplier at this position on the
 * rail. Stubbed to the third entry until the supplier record carries the flag.
 */
export function isUncontactable(index: number): boolean {
  return index === 2
}

/** The saved suppliers a request can actually be sent to. */
export function contactableOnly(suppliers: Supplier[]): Supplier[] {
  return suppliers.filter((_, index) => !isUncontactable(index))
}
export const CATEGORY_LABEL = "Stamping Services"

/**
 * A count over the local sample, restated against the whole category. Left for
 * reference: counts shown to the buyer now come from the answer-driven funnel
 * in `simulation.ts`, since a flat scale-up of a collapsed sample reads as a
 * category of zero long before the questions run out.
 */
export function scaleToCategory(count: number): number {
  return Math.round((count * CATEGORY_SUPPLIER_COUNT) / SUPPLIERS.length)
}
