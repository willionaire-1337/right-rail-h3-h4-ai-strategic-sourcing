import { isDontKnowOption, type LoggedAnswer } from "./simulation"
import { CATEGORY_LABEL } from "./suppliers"

/** Cap on capability pills shown on a result card. */
export const MAX_MATCH_PILLS = 5

/** Spec questions that are not capability-style labels. */
const SKIP_QUESTIONS = new Set(["stock", "qty", "size", "tooling", "tol", "loc", "diverse"])

/** Material answers → generic capability wording, not the option text. */
const MATERIAL_PILLS: Record<string, string> = {
  Aluminum: "Aluminum Alloy",
  Steel: "Carbon Steel",
  "Carbon Steel": "Carbon Steel",
  "Stainless Steel": "Stainless Steel",
  Copper: "Copper Alloy",
  "Beryllium Copper": "Copper Alloy",
  Nickel: "Nickel Alloy",
  Metal: "Metal Stampings",
  "Sheet Metal": "Sheet Metal",
  "Exotic Metal Alloy": "Exotic Alloys",
  "Precious Metals": "Precious Metals",
  Gold: "Precious Metals",
}

/** Process answers → a capability family, not the questionnaire option. */
const PROCESS_PILLS: Record<string, string> = {
  "Progressive Die": "Metal Stampings",
  "Transfer Die": "Metal Stampings",
  "Transfer Press": "Metal Stampings",
  "Punch Press": "Metal Stampings",
  "Compound Die": "Metal Stampings",
  Fourslide: "Fourslide Stampings",
  "Multislide®": "Fourslide Stampings",
  "Fine blanking": "Fineblanking",
  "Blanking only": "Blanking",
  Coining: "Coining",
  "Reel-to-reel": "Reel-to-Reel Stampings",
  "Robotic stamping": "Robotic Stampings",
  "High speed": "High Speed Stampings",
  "Deep drawing": "Deep Draw Stampings",
}

/** Secondary-op answers that map to a capability label. Unlisted features are skipped. */
const FEATURE_PILLS: Record<string, string> = {
  "Heat treated": "Heat Treating",
  Tapped: "Tapping",
  Embossed: "Embossing",
  Countersunk: "Countersinking",
  Coated: "Coatings",
  Enameled: "Enameling",
  "In-die assembly": "In-Die Assembly",
  Assembly: "Assembly",
  "Engineering / design assistance": "Engineering",
  Laminated: "Laminations",
  Perforated: "Perforating",
  "Deburring / edge finishing": "Deburring",
  Plating: "Plating",
}

/** Capability-relevant questions, in the order pills should fill. */
const QUESTION_ORDER = ["material", "process", "part", "features", "app", "cert"] as const

function pillFor(questionId: string, value: string): string | null {
  if (isDontKnowOption(value) || /^not sure/i.test(value)) return null
  if (SKIP_QUESTIONS.has(questionId)) return null
  if (questionId === "material") return MATERIAL_PILLS[value] ?? value
  if (questionId === "process") return PROCESS_PILLS[value] ?? null
  if (questionId === "part") return value
  if (questionId === "features") return FEATURE_PILLS[value] ?? null
  if (questionId === "app") return value
  if (questionId === "cert") return value.replace(/:\d{4}$/, "")
  return null
}

/**
 * Up to {@link MAX_MATCH_PILLS} generic capability labels derived from the
 * search category plus logged answers — not the raw questionnaire text.
 */
export function matchPillsFor(answers: LoggedAnswer[]): string[] {
  const pills: string[] = [CATEGORY_LABEL]
  const seen = new Set(pills.map((pill) => pill.toLowerCase()))
  const byId = new Map(
    answers
      .filter((answer) => !answer.skipped && answer.values.length > 0)
      .map((answer) => [answer.questionId, answer]),
  )

  const add = (label: string | null) => {
    if (!label || pills.length >= MAX_MATCH_PILLS) return
    const key = label.toLowerCase()
    if (seen.has(key)) return
    seen.add(key)
    pills.push(label)
  }

  for (const questionId of QUESTION_ORDER) {
    const answer = byId.get(questionId)
    if (!answer) continue
    for (const value of answer.values) {
      add(pillFor(questionId, value))
      if (pills.length >= MAX_MATCH_PILLS) return pills
    }
  }

  return pills
}
