"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AskBlock } from "@/components/ask-block";
import { DeepDrawGate } from "@/components/deep-draw-gate";
import { SiteNavbar } from "@/components/site-navbar";
import { SupplierResults } from "@/components/supplier-results";
import { ThinkingIndicator } from "@/components/thinking-indicator";
import {
  FREE_TEXT_ENABLED,
  askForQuestion,
  browseableQuestionIds,
  impliedAnswers,
  introSummary,
  isDontKnowOption,
  matchSetFor,
  mergeParsedAnswers,
  nextAsk,
  parseInitialQuery,
  questionById,
  railTarget,
  routesOutToDeepDrawing,
  SHORTLIST_TARGET,
  simulatedMatchCount,
  type LoggedAnswer,
  type NextAsk,
} from "@/lib/simulation";
import { syncableQuestionIds } from "@/lib/filter-sync";
import { CATEGORY_LABEL } from "@/lib/suppliers";

const OPT_OUT_HINT =
  "Opt out of the Thomas Agent experience and go back to Thomas Classic sourcing";

type TranscriptEntry =
  | { kind: "user"; id: number; text: string }
  | { kind: "assistant"; id: number; text: string; logged?: LoggedAnswer[]; matchCount?: number }
  /** Terminal step: the run is over, either quotable or routed to another family. */
  | {
      kind: "done";
      id: number;
      routed?: boolean;
      text?: string;
      /** Suppliers in the category still matching everything logged. */
      matched?: number;
      /** How many of them the results rail is showing. */
      shortlist?: number;
      /** Stall rule: the run completed while still above the shortlist target. */
      stalled?: boolean;
    }
  | {
      kind: "ask";
      id: number;
      ask: NextAsk;
      status: "active" | "answered" | "skipped";
      /** What the buyer picked, shown on the settled question card. */
      answer?: string[];
    };

let entryId = 0;
function nextId(): number {
  return ++entryId;
}

type BrowseItem = {
  questionId: string;
  entryId?: number;
  ask: NextAsk;
  status: "active" | "answered" | "skipped" | "unanswered";
  answer?: string[];
};

/** The first core question — stamping process / method. */
function makeIntro(): TranscriptEntry[] {
  const ask = nextAsk([]);
  return ask ? [{ kind: "ask", id: nextId(), ask, status: "active" }] : [];
}

export function SourcingExperience() {
  const [transcript, setTranscript] = useState<TranscriptEntry[]>(() => makeIntro());
  const [answers, setAnswers] = useState<LoggedAnswer[]>([]);
  // The category search that landed the buyer here — the experience's starting point.
  const [query, setQuery] = useState(CATEGORY_LABEL);
  const [draft, setDraft] = useState("");
  /** Options selected on the active ask, answered from the pinned bottom bar. */
  const [picked, setPicked] = useState<string[]>([]);
  const [thinking, setThinking] = useState(false);
  /** Whether the define pane is open. Collapsing hands the width to the results. */
  const [agentOpen, setAgentOpen] = useState(true);
  /** Phone view: which of the three stages the tab bar is showing. */
  const [mobileTab, setMobileTab] = useState<"define" | "evaluate" | "engage">("evaluate");
  /** Suppliers currently on the engage rail, reported up for the stage bar. */
  const [railCount, setRailCount] = useState(0);
  /**
   * Compact accordion of every ask so far — answered, skipped, or still open —
   * so the buyer can scan the run and jump back into a question.
   */
  const [browseAsks, setBrowseAsks] = useState(false);
  /** Bumps when the run resets so the rail drops auto-queued chips. */
  const [runId, setRunId] = useState(0);
  /** Deep Drawing hand-off confirm, opened from the process question. */
  const [deepDrawGateOpen, setDeepDrawGateOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    const timeouts = timers.current;
    return () => timeouts.forEach(clearTimeout);
  }, []);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [transcript, thinking]);

  useEffect(() => {
    if (!browseAsks) return;
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [browseAsks]);

  const later = useCallback((ms: number, fn: () => void) => {
    timers.current.push(setTimeout(fn, ms));
  }, []);

  /** Engage tray's Refine: jump back into the define stage. */
  const openDefine = useCallback(() => {
    setMobileTab("define");
    setAgentOpen(true);
  }, []);

  /** Queue the next question, or wrap up when nothing is left worth asking. */
  const advance = useCallback(
    (currentAnswers: LoggedAnswer[]) => {
      setThinking(true);
      later(700, () => {
        setThinking(false);
        if (routesOutToDeepDrawing(currentAnswers)) {
          setTranscript((entries) => [
            ...entries,
            {
              kind: "done",
              id: nextId(),
              routed: true,
              text: "Parts with formed depth greater than width are deep drawn, which is quoted by the Deep Drawing Services family rather than stamping. I'll route this need there — no further stamping questions apply.",
            },
          ]);
          return;
        }
        // The stop condition: questions continue only while the match set
        // still exceeds the shortlist target. At 20 or below — or when no
        // refining question remains — the run stops and presents the results.
        const matched = simulatedMatchCount(currentAnswers);
        const ask = matched > SHORTLIST_TARGET ? nextAsk(currentAnswers) : null;
        setTranscript((entries) => {
          // Every question worth asking gets asked — the run only completes
          // when the match set is refined or no refining question remains.
          if (ask) {
            return [...entries, { kind: "ask" as const, id: nextId(), ask, status: "active" as const }];
          }
          // Sized to what the rail actually shows, so the completion copy and
          // the results header never quote two different shortlists.
          const matchSet = matchSetFor(currentAnswers, railTarget(matched));
          return [
            ...entries,
            {
              kind: "done" as const,
              id: nextId(),
              matched,
              shortlist: matchSet.matches.length + matchSet.near.length,
              stalled: matched > SHORTLIST_TARGET,
            },
          ];
        });
      });
    },
    [later],
  );

  /** Start the need-definition flow from a free-text part description. */
  const begin = useCallback(
    (text: string) => {
      const trimmed = text.trim();
      if (!trimmed) return;
      setQuery(trimmed);
      setTranscript((entries) => [...entries, { kind: "user", id: nextId(), text: trimmed }]);
      setThinking(true);
      later(900, () => {
        const parsed = parseInitialQuery(trimmed);
        const all = [...parsed, ...impliedAnswers(parsed)];
        setAnswers(all);
        setThinking(false);
        // Settle the opening ask: covered by the description → answered;
        // otherwise drop it, since advance() re-asks it with pruned options.
        const covered = new Set(all.map((answer) => answer.questionId));
        setTranscript((entries) => [
          ...entries
            .filter(
              (entry) =>
                !(entry.kind === "ask" && entry.status === "active" && !covered.has(entry.ask.question.id)),
            )
            .map((entry) => {
              if (entry.kind !== "ask" || entry.status !== "active") return entry;
              const covering = all.find((answer) => answer.questionId === entry.ask.question.id);
              return { ...entry, status: "answered" as const, answer: covering?.values };
            }),
          {
            kind: "assistant",
            id: nextId(),
            text: introSummary(parsed),
            logged: all,
            matchCount: simulatedMatchCount(all),
          },
        ]);
        advance(all);
      });
    },
    [advance, later],
  );

  const answerActive = useCallback(
    (values: string[], skipped: boolean, freeText?: string) => {
      const active = transcript.find(
        (entry): entry is Extract<TranscriptEntry, { kind: "ask" }> =>
          entry.kind === "ask" && entry.status === "active",
      );
      if (!active) return;
      const question = active.ask.question;

      let updated: LoggedAnswer[] = [...answers, { questionId: question.id, values, skipped }];
      // A typed answer may cover other questions too — never ask those again.
      let covered: LoggedAnswer[] = [];
      if (freeText) {
        const merge = mergeParsedAnswers(updated, parseInitialQuery(freeText));
        updated = merge.merged;
        covered = merge.added;
      }
      const implied = impliedAnswers(updated);
      updated = [...updated, ...implied];
      const extras = [...covered, ...implied];

      setAnswers(updated);
      setPicked([]);
      setTranscript((entries) => [
        ...entries.map((entry) =>
          entry.id === active.id && entry.kind === "ask"
            ? {
                ...entry,
                status: skipped ? ("skipped" as const) : ("answered" as const),
                answer: values,
              }
            : entry,
        ),
        ...(extras.length > 0
          ? [
              {
                kind: "assistant" as const,
                id: nextId(),
                text: "That also answers a later question — logged, so it won't be asked:",
                logged: extras,
              },
            ]
          : []),
      ]);
      advance(updated);
    },
    [advance, answers, transcript],
  );

  /** Free text after the questions ran out: refine the need without a prompt. */
  const refine = useCallback(
    (text: string) => {
      setTranscript((entries) => [...entries, { kind: "user", id: nextId(), text }]);
      setThinking(true);
      later(700, () => {
        setThinking(false);
        const { merged, added } = mergeParsedAnswers(answers, parseInitialQuery(text));
        if (added.length === 0) {
          setTranscript((entries) => [
            ...entries,
            {
              kind: "assistant",
              id: nextId(),
              text: "Noted — that detail goes on the RFQ. It doesn't map to a supplier capability, so the match list is unchanged.",
            },
          ]);
          return;
        }
        setAnswers(merged);
        setTranscript((entries) => [
          ...entries,
          {
            kind: "assistant",
            id: nextId(),
            text: "Logged — the match list is updated.",
            logged: added,
            matchCount: simulatedMatchCount(merged),
          },
        ]);
      });
    },
    [answers, later],
  );

  const submitDraft = useCallback(
    (event: React.FormEvent) => {
      event.preventDefault();
      const text = draft.trim();
      if (!text || thinking) return;
      setDraft("");
      const started = transcript.some((entry) => entry.kind === "user");
      if (!started) {
        // The first message is the part description itself — parse the lot.
        begin(text);
        return;
      }
      const hasActiveAsk = transcript.some((entry) => entry.kind === "ask" && entry.status === "active");
      if (hasActiveAsk) {
        answerActive([text], false, text);
        return;
      }
      refine(text);
    },
    [answerActive, begin, draft, refine, thinking, transcript],
  );

  /**
   * Dismissing answer pills / clearing mapped filters. The question card leaves
   * the transcript along with the answer, so it reads as never asked and can
   * be re-queued on the next advance.
   */
  const removeAnswers = useCallback(
    (questionIds: string[]) => {
      if (questionIds.length === 0) return;
      const drop = new Set(questionIds);
      const updated = answers.filter((answer) => !drop.has(answer.questionId));
      const nextTranscript = transcript.filter(
        (entry) => !(entry.kind === "ask" && drop.has(entry.ask.question.id)),
      );
      setAnswers(updated);
      setTranscript(nextTranscript);
      const hasActive = nextTranscript.some(
        (entry) => entry.kind === "ask" && entry.status === "active",
      );
      if (!hasActive) advance(updated);
    },
    [advance, answers, transcript],
  );

  const removeAnswer = useCallback(
    (questionId: string) => removeAnswers([questionId]),
    [removeAnswers],
  );

  /**
   * All Filters ↔ left rail: write a mapped facet into answers (or clear it so
   * the question can be asked again). Settles or injects the matching ask card.
   */
  const applyFilterAnswer = useCallback(
    (questionId: string, values: string[] | null) => {
      if (!values || values.length === 0) {
        removeAnswer(questionId);
        return;
      }

      const updated = [
        ...answers.filter((answer) => answer.questionId !== questionId),
        { questionId, values, skipped: false },
      ];

      const activeSame = transcript.some(
        (entry) =>
          entry.kind === "ask" &&
          entry.status === "active" &&
          entry.ask.question.id === questionId,
      );

      let nextTranscript: TranscriptEntry[];
      const hasCard = transcript.some(
        (entry) => entry.kind === "ask" && entry.ask.question.id === questionId,
      );
      if (hasCard) {
        nextTranscript = transcript.map((entry) =>
          entry.kind === "ask" && entry.ask.question.id === questionId
            ? { ...entry, status: "answered" as const, answer: values }
            : entry,
        );
      } else {
        const ask = askForQuestion(questionId, updated);
        if (!ask) {
          setAnswers(updated);
          return;
        }
        const card: TranscriptEntry = {
          kind: "ask",
          id: nextId(),
          ask,
          status: "answered",
          answer: values,
        };
        const activeIndex = transcript.findIndex(
          (entry) => entry.kind === "ask" && entry.status === "active",
        );
        nextTranscript =
          activeIndex === -1
            ? [...transcript, card]
            : [...transcript.slice(0, activeIndex), card, ...transcript.slice(activeIndex)];
      }

      setAnswers(updated);
      setTranscript(nextTranscript);
      if (activeSame) {
        setPicked([]);
        advance(updated);
      }
    },
    [advance, answers, removeAnswer, transcript],
  );

  /**
   * Reopen a settled question: everything the run logged from that question
   * onwards is rolled back, so the buyer lands on it with a clean slate and
   * answers it forward again from there.
   */
  const reopenAsk = useCallback((entryId: number) => {
    const index = transcript.findIndex((entry) => entry.id === entryId);
    if (index === -1) return;
    const target = transcript[index];
    if (target.kind !== "ask") return;
    // A queued advance would land a second active question on the rolled-back
    // transcript, so the run stops where it is before rewinding.
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setThinking(false);

    const rolledBack = new Set<string>();
    for (const entry of transcript.slice(index)) {
      if (entry.kind === "ask") rolledBack.add(entry.ask.question.id);
      if (entry.kind === "assistant") {
        for (const logged of entry.logged ?? []) rolledBack.add(logged.questionId);
      }
    }
    setAnswers((current) => current.filter((answer) => !rolledBack.has(answer.questionId)));
    // A reopened question starts blank rather than with the previous pick,
    // so nothing reads as pre-selected while the buyer reconsiders.
    setPicked([]);
    setTranscript((entries) =>
      entries
        .slice(0, index + 1)
        .map((entry) =>
          entry.id === target.id && entry.kind === "ask"
            ? { ...entry, status: "active" as const, answer: undefined }
            : entry,
        ),
    );
  }, [transcript]);

  /** Step back into the question answered most recently. */
  const goBack = useCallback(() => {
    const target = transcript.findLast(
      (entry) => entry.kind === "ask" && entry.status !== "active",
    );
    if (target) reopenAsk(target.id);
  }, [reopenAsk, transcript]);

  /**
   * Leave browse mode and open the chosen question — reopening settled ones
   * so the buyer can keep answering from that point forward, or jumping to an
   * unanswered question that hasn't been asked yet.
   */
  const openAskFromBrowse = useCallback(
    (questionId: string, entryId?: number) => {
      setBrowseAsks(false);
      if (entryId != null) {
        const target = transcript.find((entry) => entry.id === entryId);
        if (target?.kind === "ask" && target.status !== "active") {
          reopenAsk(entryId);
        }
        return;
      }

      // Logged without a card (e.g. from the opening message) — drop it and
      // ask fresh so the buyer can change what was inferred.
      const logged = answers.find((answer) => answer.questionId === questionId);
      const nextAnswers = logged
        ? answers.filter((answer) => answer.questionId !== questionId)
        : answers;
      if (logged) setAnswers(nextAnswers);

      const ask = askForQuestion(questionId, nextAnswers);
      if (!ask) return;
      timers.current.forEach(clearTimeout);
      timers.current = [];
      setThinking(false);
      setPicked([]);
      setTranscript((entries) => [
        ...entries.filter((entry) => !(entry.kind === "ask" && entry.status === "active")),
        { kind: "ask", id: nextId(), ask, status: "active" },
      ]);
    },
    [answers, reopenAsk, transcript],
  );

  const closeChat = useCallback(() => {
    setBrowseAsks(false);
    setAgentOpen(false);
  }, []);

  const reset = useCallback(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
    setTranscript(makeIntro());
    setAnswers([]);
    setQuery(CATEGORY_LABEL);
    setDraft("");
    setPicked([]);
    setThinking(false);
    setBrowseAsks(false);
    setAgentOpen(true);
    setRunId((id) => id + 1);
  }, []);

  const activeAsk = transcript.find(
    (entry): entry is Extract<TranscriptEntry, { kind: "ask" }> =>
      entry.kind === "ask" && entry.status === "active",
  );
  const hasActiveAsk = activeAsk != null;
  const started = transcript.some((entry) => entry.kind === "user");
  const questionnaireComplete =
    transcript.some((entry) => entry.kind === "done" && !entry.routed) ||
    (!agentOpen && answers.length > 0);
  const canGoBack = transcript.some((entry) => entry.kind === "ask" && entry.status !== "active");
  /**
   * Picking an option answers a single-select question outright. Multi-select
   * questions collect picks instead and settle from the card's log button.
   */
  const selectOption = (value: string) => {
    if (thinking) return;
    // "I don't know" is an explicit opt-out — same as Skip for matching.
    if (isDontKnowOption(value)) {
      answerActive([value], true);
      return;
    }
    // Deep Drawing on the process question is served by the standard Thomas
    // search, not the agent: confirm the hand-off instead of logging it.
    const question = activeAsk?.ask.question;
    if (
      question?.id === "process" &&
      question.options.some((option) => option.value === value && option.routesToDeepDrawing)
    ) {
      setDeepDrawGateOpen(true);
      return;
    }
    if (question?.multi) {
      setPicked((current) =>
        current.includes(value) ? current.filter((item) => item !== value) : [...current, value],
      );
      return;
    }
    answerActive([value], false);
  };

  /** Settles a multi-select question with everything picked so far. */
  const submitPicked = () => {
    if (thinking || picked.length === 0) return;
    answerActive(picked, false);
  };

  /* Mobile tab notes: questions settled, rail picks. */
  const stageQuestionIds = browseableQuestionIds();
  const answeredCount = stageQuestionIds.filter((id) =>
    answers.some((answer) => answer.questionId === id),
  ).length;

  /** Full questionnaire for browse mode — answered, skipped, active, or not yet asked. */
  const browseItems: BrowseItem[] = [];
  for (const questionId of browseableQuestionIds()) {
    const entry = transcript.find(
      (item): item is Extract<TranscriptEntry, { kind: "ask" }> =>
        item.kind === "ask" && item.ask.question.id === questionId,
    );
    if (entry) {
      browseItems.push({
        questionId,
        entryId: entry.id,
        ask: entry.ask,
        status: entry.status,
        answer: entry.answer,
      });
      continue;
    }
    const logged = answers.find((answer) => answer.questionId === questionId);
    const ask = askForQuestion(questionId, answers);
    if (!ask) continue;
    if (logged) {
      browseItems.push({
        questionId,
        ask,
        status: logged.skipped ? "skipped" : "answered",
        answer: logged.values,
      });
      continue;
    }
    browseItems.push({ questionId, ask, status: "unanswered" });
  }

  return (
    <div className="app-shell">
      <DeepDrawGate
        open={deepDrawGateOpen}
        onConfirm={() => {
          setDeepDrawGateOpen(false);
          closeChat();
        }}
        onRevise={() => setDeepDrawGateOpen(false)}
      />
      <SiteNavbar
        query={query}
        onSearch={(text) => {
          reset();
          const trimmed = text.trim();
          // A specific need typed into the search starts the flow directly;
          // the bare category search restarts at the goal step.
          if (trimmed && trimmed.toLowerCase() !== CATEGORY_LABEL.toLowerCase()) {
            begin(trimmed);
          }
        }}
      />

      {/* Phone: the stages become tabs that swap the single column. */}
      <div className="mobile-tabs" role="tablist" aria-label="Sourcing stages">
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "define"}
          onClick={() => setMobileTab("define")}
        >
          1 Define{answeredCount >= stageQuestionIds.length ? " ✓" : ""}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "evaluate"}
          onClick={() => setMobileTab("evaluate")}
        >
          2 Evaluate
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={mobileTab === "engage"}
          onClick={() => setMobileTab("engage")}
        >
          3 Engage{railCount > 0 ? ` · ${railCount}` : ""}
        </button>
      </div>

      <main
        className="app-main"
        data-agent-closed={!agentOpen || undefined}
        data-mobile-tab={mobileTab}
      >
        {/* Left: define your need */}
        <section className="pane pane-left" aria-label="Define your need" hidden={!agentOpen}>
          <div className="agent-card">
            <div className="agent-body" ref={scrollRef}>
            <div className="agent-header">
              <span className="agent-badge" aria-hidden="true">
                <l-icon name="sparkles" fill />
              </span>
              <div className="agent-header-copy flex-1">
                <h4 className="mar-0">Smart filter your search</h4>
                <p className="agent-searching mar-0">Find the perfect supplier</p>
              </div>
            </div>
            <div className="transcript" data-browse={browseAsks || undefined}>
              {browseAsks
                ? browseItems.map((item) => (
                    <AskBlock
                      key={item.questionId}
                      ask={item.ask}
                      status={item.status}
                      answer={item.answer}
                      picked={picked}
                      onSelect={selectOption}
                      onSubmit={submitPicked}
                      collapsed
                      onOpen={() => openAskFromBrowse(item.questionId, item.entryId)}
                    />
                  ))
                : transcript.map((entry) => {
                if (entry.kind === "user") {
                  return (
                    <div key={entry.id} className="chat-user">
                      {entry.text}
                    </div>
                  );
                }
                if (entry.kind === "assistant") {
                  return (
                    <div key={entry.id} className="chat-assistant flex flex-col gap-2">
                      {entry.text.split("\n\n").map((paragraph, index) => (
                        <p key={index} className="mar-0">
                          {paragraph}
                        </p>
                      ))}
                      {entry.logged && entry.logged.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {entry.logged.map((logged) => {
                            const question = questionById(logged.questionId);
                            return (
                              <l-chip kind="primary" key={logged.questionId}>
                                {question?.title}: {logged.values.join(", ")} · logged
                              </l-chip>
                            );
                          })}
                        </div>
                      )}
                      {entry.matchCount !== undefined && (
                        <p className="mar-0 font-semi txt-blue-100">
                          {entry.matchCount.toLocaleString()} suppliers matching your need
                        </p>
                      )}
                    </div>
                  );
                }
                if (entry.kind === "done") {
                  return (
                    <l-panel key={entry.id}>
                      <div className="done-card">
                        <span className="done-mark">
                          <ThinkingIndicator state="done" size={28} />
                          <span className="done-check" aria-hidden="true">
                            <l-icon name="check" />
                          </span>
                        </span>
                        <h3 className="done-title mar-0">
                          {entry.routed ? (
                            "This need is quoted by Deep Drawing Services"
                          ) : (
                            <>
                              Based on your inputs we&apos;ve matched you to{" "}
                              <span className="txt-blue-100">{entry.shortlist ?? 0}</span> suppliers.
                            </>
                          )}
                        </h3>
                        <p className="mar-0 done-copy">
                          {entry.routed
                            ? entry.text
                            : `You can restart your search any time or close the agent below.${
                                FREE_TEXT_ENABLED
                                  ? " You can also keep typing details like certifications, industry, or supplier location."
                                  : ""
                              }`}
                        </p>
                        <div className="done-actions">
                          <button kind="neutral" onClick={reset}>
                            <l-icon name="arrow-rotate-left" /> Restart search
                          </button>
                          <button kind="primary" onClick={() => setAgentOpen(false)}>
                            Close Smart Filters
                          </button>
                        </div>
                      </div>
                    </l-panel>
                  );
                }
                return (
                  <AskBlock
                    key={entry.id}
                    ask={entry.ask}
                    status={entry.status}
                    answer={entry.answer}
                    picked={picked}
                    onSelect={selectOption}
                    onSubmit={submitPicked}
                    onSkip={() => answerActive([], true)}
                    onEdit={entry.status === "active" ? undefined : () => reopenAsk(entry.id)}
                  />
                );
              })}

              {thinking && !browseAsks && (
                <div className="thinking-row">
                  <ThinkingIndicator label="Matching suppliers" />
                  <small>Matching suppliers…</small>
                </div>
              )}
            </div>
            </div>

            {activeAsk && (
              <div className="agent-footer">
                {FREE_TEXT_ENABLED && (
                  <form className="composer flex gap-2 align-items-center" onSubmit={submitDraft}>
                    <fieldset className="flex-1">
                      <input
                        type="text"
                        value={draft}
                        aria-label="Your answer"
                        placeholder={
                          !started
                            ? "Write a message…"
                            : hasActiveAsk
                              ? "Tap an option above, or type your own answer…"
                              : "Add anything else about your need…"
                        }
                        onChange={(event) => setDraft(event.target.value)}
                      />
                    </fieldset>
                    <button kind="primary" type="submit" disabled={thinking}>
                      <l-icon name="paper-plane" /> Send
                    </button>
                  </form>
                )}
                {/* Footer toolbar, per the reference: collapse, back, skip,
                    undo, and the all-questions accordion. */}
                <div className="answer-actions">
                  <button
                    className="ghost-button answer-tool"
                    type="button"
                    title={`Close Smart Filters — ${OPT_OUT_HINT}`}
                    aria-label="Close Smart Filters"
                    onClick={closeChat}
                  >
                    <l-icon name="angle-left" aria-hidden="true" />
                  </button>
                  <button
                    className="define-back"
                    type="button"
                    disabled={!canGoBack || browseAsks}
                    onClick={goBack}
                  >
                    Back
                  </button>
                  <button
                    className="define-skip"
                    type="button"
                    title="Done answering — back to the results"
                    onClick={closeChat}
                  >
                    Done
                  </button>
                  <button
                    className="define-tool"
                    type="button"
                    title="Reset your agent"
                    aria-label="Reset your agent"
                    onClick={reset}
                  >
                    <l-icon name="arrow-rotate-left" aria-hidden="true" />
                  </button>
                  <button
                    className="define-tool"
                    type="button"
                    title={browseAsks ? "Expand questions" : "All questions"}
                    aria-label={browseAsks ? "Expand questions" : "All questions"}
                    aria-pressed={browseAsks}
                    onClick={() => setBrowseAsks((open) => !open)}
                  >
                    <l-icon name="list-ul" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* Center + right: supplier results and the engage rail */}
        <section className="pane" aria-label="Supplier results">
          <SupplierResults
            answers={answers}
            query={query}
            onRemoveAnswer={removeAnswer}
            onApplyFilterAnswer={applyFilterAnswer}
            onClearMappedAnswers={() => removeAnswers(syncableQuestionIds())}
            onRailCountChange={setRailCount}
            onRefine={openDefine}
            questionnaireComplete={questionnaireComplete}
            runId={runId}
          />
        </section>

        {!agentOpen && (
          <button
            type="button"
            className="agent-tab"
            title="Open Smart Filters"
            aria-label="Open Smart Filters"
            onClick={() => setAgentOpen(true)}
          >
            <svg
              className="panel-collapse-icon"
              viewBox="0 0 16 16"
              width="16"
              height="16"
              aria-hidden="true"
            >
              <rect
                x="1.25"
                y="1.25"
                width="13.5"
                height="13.5"
                rx="2.5"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
              />
              <path
                d="M5.25 2.5v11"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
              />
              <path
                d="M8.5 5.25 11 8l-2.5 2.75"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Open Smart Filters
          </button>
        )}
      </main>
    </div>
  );
}
