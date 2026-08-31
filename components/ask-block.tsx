"use client";

import { useLayoutEffect, useRef, useState } from "react";
import { locationSuggestions } from "@/lib/locations";
import { DONT_KNOW_OPTION, isDontKnowOption, type NextAsk } from "@/lib/simulation";

/** Most rows the search question's dropdown shows at once. */
const MAX_SEARCH_SUGGESTIONS = 8;

/** Most rows of options to offer, however tall the window gets. */
const MAX_OPTION_ROWS = 6;
/** Rows assumed until the grid has been measured, in two-column terms. */
const ASSUMED_VISIBLE = 8;

type AskBlockProps = {
  ask: NextAsk;
  status: "active" | "answered" | "skipped" | "unanswered";
  /** What the buyer picked, shown in place of the option rows once settled. */
  answer?: string[];
  /** Selection for the active ask, restored when a question is reopened. */
  picked: string[];
  onSelect: (value: string) => void;
  /** Settles a multi-select question with everything picked so far. */
  onSubmit?: () => void;
  /** Skips the question — always offered below the options, like "I don't know". */
  onSkip?: () => void;
  /** Reopens a settled question so the buyer can change what they picked. */
  onEdit?: () => void;
  /**
   * Compact browse row: question + status only. Clicking opens the question
   * so the buyer can keep answering from there.
   */
  collapsed?: boolean;
  onOpen?: () => void;
};

/**
 * How many options fit on screen without the buyer having to scroll: as many
 * rows as the pane is tall enough for, capped at MAX_OPTION_ROWS, always
 * leaving the last row for "+N more options" when anything is left over.
 *
 * Measured off the question's own header height rather than the grid's
 * position in the scroller, since the transcript is pinned to the bottom and
 * the active question is what has to fit.
 */
function useFittedOptionCount(
  gridRef: React.RefObject<HTMLDivElement | null>,
  total: number,
  /** Height kept free below the grid — the multi-select log button. */
  reserve = 0,
) {
  const [fitted, setFitted] = useState(ASSUMED_VISIBLE);

  useLayoutEffect(() => {
    const grid = gridRef.current;
    const scroller = grid?.closest(".agent-body");
    if (!grid || !scroller) return;

    const measure = () => {
      const row = grid.firstElementChild;
      const block = grid.parentElement;
      if (!row || !block) return;

      const gridStyles = getComputedStyle(grid);
      const columns = gridStyles.gridTemplateColumns.split(" ").length;
      const gap = parseFloat(gridStyles.rowGap) || 0;
      const rowHeight = row.getBoundingClientRect().height;
      if (!rowHeight) return;

      // The scroller's own padding already reserves room for the floating
      // Back / Skip controls, so what's left is the block's to fill.
      const scrollerStyles = getComputedStyle(scroller);
      const header = grid.getBoundingClientRect().top - block.getBoundingClientRect().top;
      const room =
        scroller.clientHeight -
        parseFloat(scrollerStyles.paddingTop) -
        parseFloat(scrollerStyles.paddingBottom) -
        header -
        reserve;

      const rows = Math.min(MAX_OPTION_ROWS, Math.max(1, Math.floor((room + gap) / (rowHeight + gap))));
      // Everything fits, or one row goes to "+N more options".
      setFitted(rows * columns >= total ? total : Math.max(columns, (rows - 1) * columns));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(scroller);
    observer.observe(grid);
    return () => observer.disconnect();
  }, [gridRef, total, reserve]);

  return fitted;
}

/** One option row. */
function OptionRow({
  option,
  pressed,
  single,
  onSelect,
}: {
  option: string;
  pressed: boolean;
  single: boolean;
  onSelect: (value: string) => void;
}) {
  return (
    <button
      type="button"
      className="option-row"
      aria-pressed={pressed}
      onClick={() => onSelect(option)}
    >
      <span className="row-indicator" data-single={single || undefined} aria-hidden="true">
        {pressed && <l-icon name="check" />}
      </span>
      <span className="option-row-label">{option}</span>
    </button>
  );
}

/**
 * One question in the run: the question itself and its option rows. Picking
 * an option answers the question outright; Back / Skip float over the foot
 * of the card.
 */
export function AskBlock({
  ask,
  status,
  answer,
  picked,
  onSelect,
  onSubmit,
  onSkip,
  onEdit,
  collapsed = false,
  onOpen,
}: AskBlockProps) {
  const { question, options } = ask;
  const [expanded, setExpanded] = useState(false);
  /** Typed entry for the location and search questions. */
  const [place, setPlace] = useState("");
  /** Whether the autocomplete above the input is showing. */
  const [suggestOpen, setSuggestOpen] = useState(false);
  /** Row the arrow keys have landed on. */
  const [highlighted, setHighlighted] = useState(0);

  // Both typed-entry questions share the combobox: the location question
  // suggests places, the search question suggests its own option catalog —
  // whole while the field is empty, filtered as the buyer types.
  const suggestions: { label: string; value: string; kind?: string }[] =
    status !== "active"
      ? []
      : question.location
        ? locationSuggestions(place)
        : question.search
          ? options
              .filter((option) => !isDontKnowOption(option))
              .filter((option) => option.toLowerCase().includes(place.trim().toLowerCase()))
              .slice(0, MAX_SEARCH_SUGGESTIONS)
              .map((option) => ({ label: option, value: option }))
          : [];
  const suggesting = suggestOpen && suggestions.length > 0;

  /** Settles a typed-entry question with a typed or suggested answer. */
  const submitPlace = (value: string) => {
    const text = value.trim();
    if (!text) return;
    setPlace("");
    setSuggestOpen(false);
    onSelect(text);
  };

  const active = status === "active";
  const gridRef = useRef<HTMLDivElement>(null);
  // Multi-select cards keep a row free below the grid for the log button.
  const fitted = useFittedOptionCount(gridRef, active ? options.length : 0, question.multi ? 56 : 0);

  // Keep "I don't know" on-screen even when other options collapse behind +more.
  const visible = (() => {
    if (expanded || options.length <= fitted) return options;
    const core = options.filter((option) => option !== DONT_KNOW_OPTION);
    if (core.length === options.length) return options.slice(0, fitted);
    return [...core.slice(0, Math.max(0, fitted - 1)), DONT_KNOW_OPTION];
  })();
  const hiddenCount = options.length - visible.length;

  const settledLabel =
    answer && answer.length > 0
      ? answer.join(", ")
      : status === "skipped"
        ? "Skipped"
        : null;

  const edit = onEdit ? (
    <button
      type="button"
      className="ask-edit"
      title="Change this answer"
      aria-label={`Change your answer to ${question.title}`}
      onClick={onEdit}
    >
      Edit
    </button>
  ) : null;

  if (collapsed) {
    const summary =
      status === "unanswered"
        ? "Not answered"
        : settledLabel
          ? settledLabel
          : active
            ? "In progress"
            : "Skipped";
    return (
      <button
        type="button"
        className="ask-block ask-collapsed"
        data-status={status}
        onClick={onOpen}
        aria-label={`Open question: ${question.ask}`}
      >
        <span className="ask-collapsed-ask">{question.ask}</span>
        <span className="ask-collapsed-summary" data-status={status}>
          {status === "answered" && <l-icon name="check" aria-hidden="true" />}
          {summary}
        </span>
      </button>
    );
  }

  return (
    <div className="ask-block" aria-disabled={active ? undefined : true}>
      <h5 className="ask-question mar-0">{question.ask}</h5>
      {active && <p className="ask-help mar-0">{question.hint}</p>}

      {!active && (
        <p
          className={
            answer && answer.length > 0 && status !== "skipped"
              ? "mar-0 ask-settled ask-answer"
              : "mar-0 ask-settled ask-skipped"
          }
        >
          {answer && answer.length > 0 && status !== "skipped" && (
            <l-icon name="check" aria-hidden="true" />
          )}
          {settledLabel ?? "Skipped"}
          {edit}
        </p>
      )}

      {active && (question.location || question.search) && (
        <form
          className="location-entry"
          onSubmit={(event) => {
            event.preventDefault();
            submitPlace(place);
          }}
        >
          <div className="location-entry-field">
            {/* The dropdown sits above the input — the question card lives at
                the foot of the transcript, so upward is where the room is. */}
            {suggesting && (
              <ul
                className={`location-suggest${question.search ? " location-suggest-down" : ""}`}
                role="listbox"
                aria-label={question.search ? "Product suggestions" : "Location suggestions"}
              >
                {suggestions.map((suggestion, index) => (
                  <li key={suggestion.label}>
                    <button
                      type="button"
                      role="option"
                      aria-selected={index === highlighted}
                      className="location-suggest-row"
                      data-active={index === highlighted || undefined}
                      // Mousedown, so the pick lands before the input's blur
                      // closes the list out from under the click.
                      onMouseDown={(event) => {
                        event.preventDefault();
                        submitPlace(suggestion.value);
                      }}
                      onMouseEnter={() => setHighlighted(index)}
                    >
                      <l-icon
                        name={question.location ? "location-dot" : "magnifying-glass"}
                        aria-hidden="true"
                      />
                      {suggestion.label}
                      {suggestion.kind && (
                        <span className="location-suggest-kind">{suggestion.kind}</span>
                      )}
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <label className="location-search">
              <l-icon
                name={question.location ? "location-dot" : "magnifying-glass"}
                aria-hidden="true"
              />
              <input
                type="text"
                value={place}
                aria-label={
                  question.location
                    ? "ZIP code, city, or state"
                    : "Search products"
                }
                placeholder={
                  question.location
                    ? "ZIP code, city, or state"
                    : "Search products — brackets, washers…"
                }
                role="combobox"
                aria-expanded={suggesting}
                aria-autocomplete="list"
                onChange={(event) => {
                  setPlace(event.target.value);
                  setSuggestOpen(true);
                  setHighlighted(0);
                }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setSuggestOpen(false)}
                onKeyDown={(event) => {
                  if (!suggesting) return;
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setHighlighted((index) => (index + 1) % suggestions.length);
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setHighlighted((index) => (index - 1 + suggestions.length) % suggestions.length);
                  } else if (event.key === "Enter") {
                    event.preventDefault();
                    submitPlace(suggestions[highlighted]?.value ?? place);
                  } else if (event.key === "Escape") {
                    setSuggestOpen(false);
                  }
                }}
              />
            </label>
          </div>
          <button kind="primary" type="submit" disabled={!place.trim()}>
            {question.location ? "Set location" : "Set product"}
          </button>
        </form>
      )}

      {/* The search question's catalog lives in the dropdown, not in rows. */}
      {active &&
        !question.search &&
        (options.length > 0 ? (
          <div className="option-rows" role="group" aria-label={question.title} ref={gridRef}>
            {visible.map((option) => (
              <OptionRow
                key={option}
                option={option}
                pressed={picked.includes(option)}
                single={!question.multi}
                onSelect={onSelect}
              />
            ))}
            {hiddenCount > 0 && (
              <button type="button" className="option-row row-more" onClick={() => setExpanded(true)}>
                +{hiddenCount} more options
              </button>
            )}
          </div>
        ) : (
          <small className="txt-darkblue-50">Free-form answer — skip to move on.</small>
        ))}

      {/* Skip rides below the options — always on offer, like "I don't know". */}
      {active && onSkip && (
        <button type="button" className="ask-skip-row" onClick={onSkip}>
          Skip →
        </button>
      )}

      {/* Multi-select questions settle from an explicit log button — picking
          rows only toggles them, so the buyer can choose more than one. */}
      {active && question.multi && options.length > 0 && (
        <div className="ask-submit">
          <small className="txt-darkblue-50">Select all that apply</small>
          <button kind="primary" type="button" disabled={picked.length === 0} onClick={onSubmit}>
            Submit
          </button>
        </div>
      )}
    </div>
  );
}
