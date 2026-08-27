import { ALL_CANDIDATES, narrowCandidates, planField } from "./ask-viability"
import { QUESTIONNAIRE, type Question } from "./questionnaire"
import { planScreening } from "./screening"
import { CATEGORY_SUPPLIER_COUNT, type Supplier } from "./suppliers"

/**
 * The simulated assistant. Where the previous prototype streamed a live LLM,
 * this one is deterministic: the buyer's first message is parsed against the
 * questionnaire for anything already specified, and the remaining questions
 * are asked one at a time in importance order, with options pruned to what the
 * supplier database can still fulfil.
 */

/**
 * Tier 1 is rules based: the buyer answers with the option rows, so the
 * free-text composer and the copy that points at it are hidden. Flip this back
 * on when the phase that interprets typed answers lands.
 */
export const FREE_TEXT_ENABLED = false

export type LoggedAnswer = {
  questionId: string
  /** Option values chosen, or a free-form entry as a single value. */
  values: string[]
  /** True when the buyer skipped or answered "I don't know". */
  skipped?: boolean
}

/** Always offered last on every ask — logs as skipped so it never filters. */
export const DONT_KNOW_OPTION = "I don't know"

export function isDontKnowOption(value: string): boolean {
  return value === DONT_KNOW_OPTION
}

/** Append {@link DONT_KNOW_OPTION} after pruning so viability can't drop it. */
function withDontKnow(options: string[]): string[] {
  if (options.includes(DONT_KNOW_OPTION)) return options
  return [...options, DONT_KNOW_OPTION]
}

/**
 * Phrases buyers write that the option lists don't say verbatim. Each maps to
 * a question id and the exact option value to log.
 */
const PHRASE_MAP: [RegExp, string, string][] = [
  [/\btight(er)? tolerances?\b/, "tol", "Close tolerance"],
  [/\bclose tolerances?\b/, "tol", "Close tolerance"],
  [/\bhigh precision\b/, "tol", "High precision"],
  [/\bprecision\b/, "tol", "Precision"],
  [/\bproduction\s+(quantit|volume|run|qty)/, "qty", "Production Runs"],
  [/\bhigh volume\b/, "qty", "High Volume"],
  [/\bprototype/, "qty", "Prototype"],
  [/\bshort run/, "qty", "Short Run"],
  [/\blong run/, "qty", "Long Run"],
  [/\bstainless\b/, "material", "Stainless Steel"],
  [/\bprog(ressive)? die\b/, "process", "Progressive Die"],
  [/\bfine ?blank/, "process", "Fine blanking"],
  [/\bdeep draw/, "process", "Deep drawing"],
  [/\bfourslide\b/, "process", "Fourslide"],
  [/\bheat treat/, "features", "Heat treated"],
  [/\bplating|plated\b/, "features", "Plating"],
  [/\bassembly\b/, "features", "Assembly"],
]

/** Option values too generic to log off a free-text mention. */
const IGNORED_OPTION_MATCHES = new Set(["Metal", "Production Runs"])

/**
 * Read the buyer's opening message for answers they already gave — "aluminum
 * production quantity tight tolerance stamping services" logs material,
 * quantity, and tolerance before the first question is ever asked.
 */
export function parseInitialQuery(query: string): LoggedAnswer[] {
  const text = query.toLowerCase()
  const byQuestion = new Map<string, Set<string>>()

  const log = (questionId: string, value: string) => {
    const set = byQuestion.get(questionId) ?? new Set()
    set.add(value)
    byQuestion.set(questionId, set)
  }

  for (const [pattern, questionId, value] of PHRASE_MAP) {
    if (pattern.test(text)) log(questionId, value)
  }

  for (const question of QUESTIONNAIRE) {
    for (const option of question.options) {
      const value = option.value.toLowerCase().replace(/[®™]/g, "")
      if (value.length < 4) continue
      if (IGNORED_OPTION_MATCHES.has(option.value)) continue
      const escaped = value.replace(/[.*+?^${}()|[\]\\/-]/g, "\\$&")
      if (new RegExp(`\\b${escaped}s?\\b`).test(text)) {
        log(question.id, option.value)
      }
    }
  }

  const answers: LoggedAnswer[] = []
  for (const question of QUESTIONNAIRE) {
    const values = byQuestion.get(question.id)
    if (!values) continue
    const picked = question.multi ? [...values] : [...values].slice(0, 1)
    answers.push({ questionId: question.id, values: picked })
  }
  return answers
}

export function questionById(id: string): Question | undefined {
  return QUESTIONNAIRE.find((question) => question.id === id)
}

/**
 * Answers that already answer a later question, so it is never asked. Kept to
 * implications the taxonomy actually supports — a foil part has its thickness
 * class by definition; fine blanking produces fully sheared edges.
 */
const IMPLICATIONS: { source: [string, string]; implies: [string, string] }[] = [
  { source: ["material", "Foil"], implies: ["stock", "Foil gauge"] },
  { source: ["process", "Fine blanking"], implies: ["features", "Fully sheared edges"] },
]

/** Answers implied by what's already logged, for questions not yet answered. */
export function impliedAnswers(answers: LoggedAnswer[]): LoggedAnswer[] {
  const answered = new Set(answers.map((answer) => answer.questionId))
  const implied: LoggedAnswer[] = []
  for (const rule of IMPLICATIONS) {
    const [sourceId, sourceValue] = rule.source
    const [targetId, targetValue] = rule.implies
    if (answered.has(targetId)) continue
    if (implied.some((answer) => answer.questionId === targetId)) continue
    const hit = answers.some(
      (answer) =>
        !answer.skipped && answer.questionId === sourceId && answer.values.includes(sourceValue),
    )
    if (hit) implied.push({ questionId: targetId, values: [targetValue] })
  }
  return implied
}

/**
 * True when a logged value routes the need out of stamping — deep-drawn parts
 * (formed depth greater than width) are quoted by the Deep Drawing Services
 * family, so the remaining stamping questions no longer apply.
 */
export function routesOutToDeepDrawing(answers: LoggedAnswer[]): boolean {
  return answers.some((answer) => {
    if (answer.skipped) return false
    const question = questionById(answer.questionId)
    if (!question) return false
    return answer.values.some((value) =>
      question.options.some((option) => option.value === value && option.routesToDeepDrawing),
    )
  })
}

/**
 * Fold freshly parsed answers into the log, keeping only questions that have
 * not been answered yet — a buyer's later message never overwrites an explicit
 * earlier answer.
 */
export function mergeParsedAnswers(
  answers: LoggedAnswer[],
  parsed: LoggedAnswer[],
): { merged: LoggedAnswer[]; added: LoggedAnswer[] } {
  const answered = new Set(answers.map((answer) => answer.questionId))
  const added = parsed.filter((answer) => !answered.has(answer.questionId))
  return { merged: [...answers, ...added], added }
}

/**
 * Questions whose answers describe the order, not the supplier — a need-by
 * date or ship-to ZIP says nothing a profile can be screened on, and letting
 * its words filter ("ship" hitting "shipment") would empty the pool. They're
 * still asked and still go on the RFQ; they just don't narrow the list.
 */
const NON_FILTERING_QUESTIONS = new Set<string>(["delivery"])

/**
 * The location question is answered with a typed place rather than an option
 * row, so its filtering can't go through the keyword screen — "TX" would hit
 * "manufacturing". It gets its own matcher instead.
 */
export const LOCATION_QUESTION_ID = "loc"
/** The location question's only option row: no geographic preference. */
export const LOCATION_NATIONAL = "National"

/** A location answer that doesn't constrain geography at all. */
function isNationalLocation(answer: LoggedAnswer): boolean {
  return answer.questionId === LOCATION_QUESTION_ID && answer.values.includes(LOCATION_NATIONAL)
}

/**
 * Whether a supplier is in the typed place. A ZIP counts as its three-digit
 * region rather than the exact code; a state name, code, or metro resolves to
 * the state and its neighbors (sourcing is regional); anything else matches
 * against the profile's city and state.
 */
function matchesLocation(supplier: Supplier, place: string): boolean {
  const text = place.trim().toLowerCase()
  if (!text) return true
  if (/^\d{3,5}$/.test(text)) return supplier.zip.startsWith(text.slice(0, 3))
  const plan = planScreening(place, [])
  if (plan.states.size > 0) {
    const state = supplier.state.toLowerCase()
    return plan.states.has(state) || plan.nearby.has(state)
  }
  // A bare two-letter entry the screen couldn't place ("in" reads as a word,
  // not Indiana) is still a state code when it's the whole answer.
  if (text.length === 2) return supplier.state.toLowerCase() === text
  return `${supplier.city}, ${supplier.state}`.toLowerCase().includes(text)
}

/** Whether an answer narrows the pool at all, and the pool after it. */
function answerFilters(answer: LoggedAnswer): boolean {
  if (answer.skipped || answer.values.length === 0) return false
  if (NON_FILTERING_QUESTIONS.has(answer.questionId)) return false
  if (isNationalLocation(answer)) return false
  return true
}

function applyAnswer(candidates: Supplier[], answer: LoggedAnswer): Supplier[] {
  if (answer.questionId === LOCATION_QUESTION_ID) {
    return candidates.filter((supplier) =>
      answer.values.some((place) => matchesLocation(supplier, place)),
    )
  }
  return narrowCandidates(candidates, answer.values)
}

/**
 * The suppliers still in play given everything logged so far. Answers within
 * one question widen (OR); answers across questions narrow (AND). Skipped
 * questions don't filter.
 */
export function candidatesFor(answers: LoggedAnswer[]): Supplier[] {
  let candidates = ALL_CANDIDATES
  for (const answer of answers) {
    if (!answerFilters(answer)) continue
    candidates = applyAnswer(candidates, answer)
  }
  return candidates
}

/**
 * The largest shortlist ever presented — the spec's "20 or fewer suppliers".
 * The run keeps asking only while the modeled count still exceeds this, and
 * the results rail never shows more than this many profiles.
 */
export const SHORTLIST_TARGET = 20
/**
 * The floor rule's threshold. When an answer drops the set under this, the
 * exact matches are shown first and the rail is backfilled to a full
 * shortlist by relaxing the most recent answers, clearly labeled.
 */
export const MATCH_FLOOR = 10

/**
 * The local database is a 104-profile slice of a 2,482-supplier category, so
 * screening it directly collapses after two answers where the real catalog
 * would still hold hundreds. The count the buyer sees is therefore modelled on
 * the whole category: each answer's selectivity — the share of the slice it
 * matches — is applied to the category total.
 *
 * The share is damped because capabilities correlate in a way a slice this
 * small can't show. Most stamping shops that run aluminum also run steel, so
 * multiplying raw selectivity across a run of answers would annihilate a pool
 * that in reality narrows gently. The exponent is calibrated so answers
 * narrow the count steadily toward {@link SHORTLIST_TARGET} rather than
 * collapsing it to zero.
 */
const SELECTIVITY_DAMPING = 0.48
/**
 * Bounds on one answer's effect, so no single pick ends or stalls the funnel.
 * The floor is set so a run of specific answers can actually reach
 * {@link SHORTLIST_TARGET} within a handful of questions — the spec's example
 * cuts 60–75% per answer — while never letting one answer end the run alone.
 */
const MIN_STEP = 0.35
const MAX_STEP = 0.97

/**
 * The least an answer must cut the modeled count for it to have "materially
 * narrowed" the set — the bar a question has to clear to earn its place.
 */
const MATERIAL_CUT = 0.1

/** The damped share of the category an answer leaves behind, unclamped. */
function dampedShare(values: string[]): number {
  const matched = narrowCandidates(ALL_CANDIDATES, values).length
  const selectivity = matched / ALL_CANDIDATES.length
  if (selectivity <= 0) return 0
  return selectivity ** SELECTIVITY_DAMPING
}

/** The share of the category one answer leaves behind. */
function answerStep(answer: LoggedAnswer): number {
  const matched = applyAnswer(ALL_CANDIDATES, answer).length
  const selectivity = matched / ALL_CANDIDATES.length
  const share = selectivity <= 0 ? 0 : selectivity ** SELECTIVITY_DAMPING
  return Math.min(MAX_STEP, Math.max(MIN_STEP, share))
}

/**
 * Suppliers in the category still matching everything logged. This is the
 * number the buyer is shown and the one the run's floor is measured against —
 * the results rail below it is a page of that set, not the whole of it.
 */
export function simulatedMatchCount(answers: LoggedAnswer[]): number {
  let share = 1
  for (const answer of answers) {
    if (!answerFilters(answer)) continue
    share *= answerStep(answer)
  }
  return Math.round(CATEGORY_SUPPLIER_COUNT * share)
}

export type MatchSet = {
  /** Suppliers in the slice meeting every answer logged. */
  matches: Supplier[]
  /**
   * Near matches padding the rail out to {@link SHORTLIST_TARGET}, found by
   * relaxing the most recent answers. Empty while the slice can fill the
   * shortlist on its own.
   */
  near: Supplier[]
  /** True once near matches were needed to fill the shortlist. */
  backfilled: boolean
  /**
   * The answers relaxed to fill the shortlist, most recent first, as the
   * values the buyer picked — so the near matches can be labeled with what
   * they aren't guaranteed to meet.
   */
  relaxed: string[]
}

/**
 * The most recent answer that actually filters — skipped questions and ones
 * the profiles can't judge never narrowed anything, so relaxing them would
 * widen nothing.
 */
function lastFilterIndex(answers: LoggedAnswer[]): number {
  for (let index = answers.length - 1; index >= 0; index--) {
    if (answerFilters(answers[index])) return index
  }
  return -1
}

/**
 * How many profiles the rail shows for a given category count: a full
 * shortlist while the category is larger than one, the category itself once
 * it is smaller, and a padded shortlist once it drops under the floor — the
 * floor rule ends the run on a full set worth working through rather than on
 * the handful that survived the last answer.
 */
export function railTarget(count: number): number {
  if (count < MATCH_FLOOR) return SHORTLIST_TARGET
  return Math.min(count, SHORTLIST_TARGET)
}

/**
 * The shortlist to put in front of the buyer. The slice is far smaller than
 * the category it stands for, so once it can't fill the shortlist on its own
 * the most recent answers are relaxed one at a time until it can — an empty
 * rail under a header claiming hundreds would read as broken. Exact matches
 * always rank ahead of anything backfilled.
 */
export function matchSetFor(answers: LoggedAnswer[], target = SHORTLIST_TARGET): MatchSet {
  const matches = candidatesFor(answers)
  if (matches.length >= target) {
    return { matches, near: [], backfilled: false, relaxed: [] }
  }
  const seen = new Set(matches.map((supplier) => supplier.id))
  const near: Supplier[] = []
  const relaxed: string[] = []
  let widened = answers
  while (matches.length + near.length < target) {
    const index = lastFilterIndex(widened)
    // Nothing left to relax — the slice simply holds no one else.
    if (index < 0) break
    // Named so the near-match label reads as a sentence: a relaxed location
    // is "your location (75001)" rather than a bare ZIP.
    relaxed.push(
      widened[index].questionId === LOCATION_QUESTION_ID
        ? `your location (${widened[index].values.join(", ")})`
        : widened[index].values.join(", "),
    )
    widened = [...widened.slice(0, index), ...widened.slice(index + 1)]
    for (const supplier of candidatesFor(widened)) {
      if (seen.has(supplier.id)) continue
      seen.add(supplier.id)
      near.push(supplier)
      if (matches.length + near.length >= target) break
    }
  }
  return { matches, near, backfilled: near.length > 0, relaxed }
}

export type NextAsk = {
  question: Question
  /** Option values still worth offering, pruned against who's left. */
  options: string[]
}

/**
 * Build the ask payload for a specific question — same option pruning as
 * {@link nextAsk}, but without walking the sequence. Used when the buyer
 * jumps to a question from the browse list.
 */
export function askForQuestion(questionId: string, _answers: LoggedAnswer[] = []): NextAsk | null {
  if (NON_FILTERING_QUESTIONS.has(questionId)) return null
  const question = questionById(questionId)
  if (!question) return null
  if (question.location) {
    return { question, options: withDontKnow(question.options.map((option) => option.value)) }
  }
  const plan = planField(
    ALL_CANDIDATES,
    question.options.map((option) => option.value),
  )
  // Still offer the question in browse even when the model would skip it in
  // the live run — the buyer may want to answer it for the RFQ.
  const options = plan.skip || plan.options.length === 0
    ? question.options.map((option) => option.value)
    : plan.options
  return { question, options: withDontKnow(options) }
}

/**
 * The order the run works through: the questionnaire's own rank order,
 * Q1 through Q14. There is no fixed question count: an entry is only ever
 * asked while it can still earn its place, so how many questions a run
 * takes depends on the answers. Questions outside the sequence are never
 * put to the buyer — they're only logged when the buyer's own words cover
 * them.
 *
 * "delivery" (Q7) holds its rank slot but is never asked: a need-by date
 * describes the order rather than the supplier, so it can't narrow the
 * set (see {@link NON_FILTERING_QUESTIONS}).
 */
export const ASK_SEQUENCE = [
  "process", // Q1
  "material", // Q2
  "stock", // Q3
  "qty", // Q4
  "size", // Q5
  "tooling", // Q6
  "delivery", // Q7
  "tol", // Q8
  // "loc" left the define flow 2026-08-27 — location is set from the results
  // header field or the All Filters drawer instead; the answer still filters.
  "features", // Q10
  "part", // Q11
  "app", // Q12
  "cert", // Q13
  "diverse", // Q14
]

/** Every question the browse list can surface, in ask order. */
export function browseableQuestionIds(): string[] {
  return ASK_SEQUENCE.filter((questionId) => {
    if (NON_FILTERING_QUESTIONS.has(questionId)) return false
    return questionById(questionId) != null
  })
}

/**
 * The next question worth asking: the first unanswered question in the ask
 * sequence that earns its place — some answer to it would still materially
 * narrow the set. A need that routed out to Deep Drawing asks nothing
 * further.
 */
export function nextAsk(answers: LoggedAnswer[]): NextAsk | null {
  if (routesOutToDeepDrawing(answers)) return null
  const answered = new Set(answers.map((answer) => answer.questionId))
  // Options are pruned against the whole slice, not against what's left after
  // the answers so far. The slice stands for a category twenty times its size,
  // so a pool that has collapsed to one profile says nothing about whether the
  // category can still field an answer — reading it would cut the run short.
  const candidates = ALL_CANDIDATES
  for (const questionId of ASK_SEQUENCE) {
    if (answered.has(questionId)) continue
    // A question whose answers never filter can't narrow the set, so it never
    // earns a turn — its details reach the RFQ when the buyer volunteers them.
    if (NON_FILTERING_QUESTIONS.has(questionId)) continue
    const question = questionById(questionId)
    if (!question) continue
    // The location question takes a typed place, not an option row, so the
    // option-narrowing checks below don't apply — any real place narrows the
    // set, and "National" is the explicit opt-out.
    if (question.location) {
      return {
        question,
        options: withDontKnow(question.options.map((option) => option.value)),
      }
    }
    const plan = planField(
      candidates,
      question.options.map((option) => option.value),
    )
    if (plan.skip) continue
    // Every question earns its place: skip any whose every remaining option
    // would leave the modeled count effectively where it is.
    const narrows = plan.options.some(
      (option) => dampedShare([option]) <= 1 - MATERIAL_CUT,
    )
    if (!narrows) continue
    return { question, options: withDontKnow(plan.options) }
  }
  return null
}

/**
 * One line acknowledging what the opening message already told us, in the
 * order the questionnaire ranks the fields.
 */
export function introSummary(answers: LoggedAnswer[]): string {
  const parts: string[] = []
  for (const answer of answers) {
    const question = questionById(answer.questionId)
    if (!question || answer.values.length === 0) continue
    parts.push(`${question.title.toLowerCase()}: ${answer.values.join(", ")}`)
  }
  if (parts.length === 0) {
    return "The buyer is looking for stamping services. I'll start working through the details to build an accurate supplier match."
  }
  return `The buyer is looking for stamping services — ${parts.join("; ")}. I'll work through the remaining details to sharpen the supplier match.`
}
