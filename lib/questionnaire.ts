import questionnaireData from "./questionnaire.json"

export type QuestionOption = {
  value: string
  note?: string
  taxonomyId?: string
  routesToDeepDrawing?: boolean
}

export type Question = {
  id: string
  rank: string
  importance: number
  title: string
  tier: "core" | "adaptive"
  multi: boolean
  /**
   * Answered with a typed place — ZIP code, city, or state — rather than by
   * picking from the option rows; the options carry only the no-preference
   * opt-out ("National").
   */
  location?: boolean
  /**
   * Answered from a searchable dropdown rather than option rows — the option
   * list is a catalog to search, so it's offered whole, never pruned against
   * the supplier slice.
   */
  search?: boolean
  ask: string
  /** Short buyer-facing note on what the options cover and why they matter. */
  hint: string
  options: QuestionOption[]
}

export const QUESTIONNAIRE = questionnaireData as Question[]
