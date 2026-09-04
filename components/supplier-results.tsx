"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { ContactSupplierModal } from "@/components/contact-supplier-modal";
import { FilterDrawer, type FilterGroup } from "@/components/filter-drawer";
import { SelectSuppliersRail } from "@/components/select-suppliers-rail";
import { ShortlistModal } from "@/components/shortlist-modal";
import { SupplierCard } from "@/components/supplier-card";
import { SupplierLogo } from "@/components/supplier-logo";
import {
  capabilitiesForMaterials,
  certificationsForAnswers,
  locationFromAnswers,
  mapCertificationOption,
  materialsFromCapabilities,
} from "@/lib/filter-sync";
import {
  questionById,
  candidatesFor,
  LOCATION_QUESTION_ID,
  matchSetFor,
  railTarget,
  simulatedMatchCount,
  type LoggedAnswer,
} from "@/lib/simulation";
import { planScreening, scoreRecord } from "@/lib/screening";
import { matchPillsFor } from "@/lib/match-pills";
import { type Supplier } from "@/lib/suppliers";

const PAGE_SIZE = 25;
/** How many ranked suppliers land on the rail when the questionnaire wraps up. */
const AUTO_QUEUE_COUNT = 3;

/** Short spec labels for the RFI draft card's bulleted requirement lines —
    the questionnaire titles are too long to read as "Label: Value". */
const RFI_SPEC_LABELS: Record<string, string> = {
  part: "Product",
  process: "Process",
  material: "Material",
  stock: "Stock",
  qty: "Quantity",
  size: "Size",
  tooling: "Tooling",
  tol: "Tolerance",
  loc: "Location",
  features: "Features",
  app: "Application",
  cert: "Certifications",
  diverse: "Diversity",
};

/** Short uppercase label shown above each answer chip in the results header. */
const FACET_LABELS: Record<string, string> = {
  process: "PROCESS",
  material: "MATERIAL",
  stock: "THICKNESS",
  qty: "QUANTITY",
  size: "SIZE",
  tooling: "TOOLING",
  tol: "TOLERANCE",
  loc: "LOCATION",
  features: "FEATURES",
  part: "PART TYPE",
  app: "INDUSTRY",
  cert: "CERTIFICATIONS",
  diverse: "DIVERSITY",
};

type SupplierResultsProps = {
  answers: LoggedAnswer[];
  query: string;
  /** Drops a logged answer when its pill is dismissed. */
  onRemoveAnswer: (questionId: string) => void;
  /** Writes a mapped All Filters pick into the agent answers (or clears it). */
  onApplyFilterAnswer: (questionId: string, values: string[] | null) => void;
  /** Clears every questionnaire-backed drawer facet in one shot. */
  onClearMappedAnswers: () => void;
  /** Reports how many suppliers sit on the engage rail, for the stage bar. */
  /** Engage tray's Refine control: reopens the define pane. */
  onRefine: () => void;
  /** True once the run wraps up or the buyer clicks Done. */
  questionnaireComplete: boolean;
  /** Increments on Reset so the rail can drop auto-queued chips. */
  runId: number;
};

/**
 * The results rail: screening header with live counts, suppliers still
 * matching everything logged so far (best first), and a persistent action
 * footer — select all, contact, shortlist, export, save.
 */
export function SupplierResults({
  answers,
  query,
  onRemoveAnswer,
  onApplyFilterAnswer,
  onClearMappedAnswers,
  onRefine,
  questionnaireComplete,
  runId,
}: SupplierResultsProps) {
  const [page, setPage] = useState(1);
  /** Shortlisted supplier ids; nothing renders it since the card Save button
      left, but the rail's "Add to shortlist" still records the picks. */
  const [, setSaved] = useState<Set<string>>(new Set());
  /** Draft for the drawer location field while typing; commits into answers. */
  const [locationDraft, setLocationDraft] = useState("");
  /** Classic facet rail, opened from "All Filters". */
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [verifiedOnly, setVerifiedOnly] = useState(false);
  const [partnerOnly, setPartnerOnly] = useState(false);
  /** Local-only facets (no questionnaire twin) — e.g. company type. */
  const [localFacetPicks, setLocalFacetPicks] = useState<Record<string, string[]>>({});
  const [contactOpen, setContactOpen] = useState(false);
  const [shortlistOpen, setShortlistOpen] = useState(false);
  /** The rail's RFI goes to its pre-picked top suppliers, not the selection. */
  const [railRfi, setRailRfi] = useState(false);
  /** Suppliers the buyer added to the rail from card "+ Add" CTAs, in order. */
  const [railAdded, setRailAdded] = useState<string[]>([]);
  /** Card currently highlighted after a rail-chip click. */
  const [focusedSupplierId, setFocusedSupplierId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const locationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoQueued = useRef(false);
  const pendingRevealId = useRef<string | null>(null);
  const [revealNonce, setRevealNonce] = useState(0);

  const logged = answers.filter((answer) => !answer.skipped && answer.values.length > 0);

  // Keep the drawer location field aligned with the loc answer when it changes
  // from the left rail (or a committed drawer edit).
  const answerLocation = locationFromAnswers(answers);
  useEffect(() => {
    if (answerLocation === null) {
      setLocationDraft("");
      return;
    }
    setLocationDraft(answerLocation);
  }, [answerLocation]);

  useEffect(() => {
    return () => {
      if (locationTimer.current) clearTimeout(locationTimer.current);
    };
  }, []);

  useEffect(() => {
    autoQueued.current = false;
    setRailAdded([]);
    setFocusedSupplierId(null);
  }, [runId]);

  /** Suppliers in the category still matching — the number the buyer is shown. */
  const matchTotal = simulatedMatchCount(answers);

  // Exact matches rank above any near matches the rail was padded with, so a
  // relaxed answer never pushes a supplier that meets everything down the list.
  const { exact, near } = useMemo(() => {
    const set = matchSetFor(answers, railTarget(matchTotal));
    const plan = planScreening(
      `${query} ${logged.map((answer) => answer.values.join(" ")).join(" ")}`,
      [],
    );
    const types = localFacetPicks.companyType ?? [];
    const passesFacets = (supplier: Supplier) =>
      (!verifiedOnly || supplier.verified === true) &&
      (types.length === 0 || types.some((type) => supplier.companyTypes.includes(type)));
    const rank = (group: Supplier[]) =>
      group
        .filter((supplier) => passesFacets(supplier))
        .sort((a, b) => {
          const scoreDelta = scoreRecord(b, plan) - scoreRecord(a, plan);
          if (scoreDelta !== 0) return scoreDelta;
          if (a.verified !== b.verified) return a.verified ? -1 : 1;
          if (a.sponsored !== b.sponsored) return a.sponsored ? -1 : 1;
          return 0;
        });
    return {
      exact: rank(set.matches),
      near: rank(set.near),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers, matchTotal, query, verifiedOnly, localFacetPicks]);

  const results = useMemo(() => [...exact, ...near], [exact, near]);

  // A new answer or filter reshuffles the list, so the buyer starts back on
  // page one rather than stranded past the end of a shorter set.
  useEffect(() => {
    setPage(1);
  }, [results]);

  const pageCount = Math.max(1, Math.ceil(results.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount);
  const pageStart = (currentPage - 1) * PAGE_SIZE;

  const goToPage = (next: number) => {
    setPage(Math.min(pageCount, Math.max(1, next)));
    scrollRef.current?.scrollTo({ top: 0 });
  };

  // Facet options come from the suppliers this category can return, so the rail
  // never offers a filter that would empty the list on its own.
  const filterGroups = useMemo<FilterGroup[]>(() => {
    const collect = (pick: (supplier: Supplier) => string[]) => {
      const values = new Set<string>();
      for (const supplier of candidatesFor([])) for (const value of pick(supplier)) values.add(value);
      return [...values].sort();
    };
    return [
      { id: "companyType", title: "Company Type", options: collect((s) => s.companyTypes) },
      { id: "certification", title: "Quality Certifications", options: collect((s) => s.certifications) },
      { id: "material", title: "Material", options: collect((s) => s.capabilities) },
    ];
  }, []);

  const materialOptions =
    filterGroups.find((group) => group.id === "material")?.options ?? [];
  const certificationOptions =
    filterGroups.find((group) => group.id === "certification")?.options ?? [];

  // Mapped facets are derived from answers so the drawer and left rail stay in sync.
  const materialAnswer = logged.find((answer) => answer.questionId === "material");
  const syncedCertifications = certificationsForAnswers(answers, certificationOptions);
  const localCertifications = (localFacetPicks.certification ?? []).filter(
    (option) => mapCertificationOption(option) == null,
  );
  const facetPicks: Record<string, string[]> = {
    ...localFacetPicks,
    material: capabilitiesForMaterials(materialAnswer?.values ?? [], materialOptions),
    certification: [...syncedCertifications, ...localCertifications],
  };

  const filterCount =
    (verifiedOnly ? 1 : 0) +
    (partnerOnly ? 1 : 0) +
    (locationDraft.trim() ? 1 : 0) +
    Object.values(facetPicks).reduce((total, values) => total + values.length, 0);

  const clearFilters = () => {
    setVerifiedOnly(false);
    setPartnerOnly(false);
    setLocationDraft("");
    setLocalFacetPicks({});
    if (locationTimer.current) clearTimeout(locationTimer.current);
    onClearMappedAnswers();
  };

  const commitLocation = (value: string) => {
    const trimmed = value.trim();
    if (!trimmed) {
      onApplyFilterAnswer(LOCATION_QUESTION_ID, null);
      return;
    }
    onApplyFilterAnswer(LOCATION_QUESTION_ID, [trimmed]);
  };

  const onLocation = (value: string) => {
    setLocationDraft(value);
    if (locationTimer.current) clearTimeout(locationTimer.current);
    locationTimer.current = setTimeout(() => commitLocation(value), 400);
  };

  const toggleFacet = (groupId: string, option: string) => {
    if (groupId === "material") {
      const currentCaps = new Set(facetPicks.material ?? []);
      if (currentCaps.has(option)) currentCaps.delete(option);
      else currentCaps.add(option);
      const materials = materialsFromCapabilities([...currentCaps]);
      onApplyFilterAnswer("material", materials.length > 0 ? materials : null);
      return;
    }

    if (groupId === "certification") {
      const mapped = mapCertificationOption(option);
      if (!mapped) {
        // No questionnaire twin — keep it local only.
        setLocalFacetPicks((current) => {
          const chosen = current[groupId] ?? [];
          return {
            ...current,
            [groupId]: chosen.includes(option)
              ? chosen.filter((entry) => entry !== option)
              : [...chosen, option],
          };
        });
        return;
      }

      const questionAnswers =
        answers.find((answer) => answer.questionId === mapped.questionId && !answer.skipped)
          ?.values ?? [];
      const next = questionAnswers.includes(mapped.value)
        ? questionAnswers.filter((value) => value !== mapped.value)
        : [...questionAnswers, mapped.value];
      onApplyFilterAnswer(mapped.questionId, next.length > 0 ? next : null);
      return;
    }

    setLocalFacetPicks((current) => {
      const chosen = current[groupId] ?? [];
      return {
        ...current,
        [groupId]: chosen.includes(option)
          ? chosen.filter((entry) => entry !== option)
          : [...chosen, option],
      };
    });
  };

  const facets = logged.map((answer) => ({
    id: answer.questionId,
    title: questionById(answer.questionId)?.title ?? "",
    label: FACET_LABELS[answer.questionId] ?? (questionById(answer.questionId)?.title ?? "").toUpperCase(),
    value: answer.values.join(", "),
  }));

  // Logged answers echoed on the contact modal and the rail RFI card.
  const requirements = logged.map((answer) => ({
    label:
      RFI_SPEC_LABELS[answer.questionId] ??
      questionById(answer.questionId)?.title ??
      answer.questionId,
    value: answer.values.join(", "),
  }));

  const matchPills = matchPillsFor(logged);

  /** The rail's list: auto-queued top matches plus card additions. */
  const railSuppliers = railAdded
    .map((id) => results.find((supplier) => supplier.id === id))
    .filter((supplier): supplier is Supplier => supplier != null);
  const railIds = new Set(railSuppliers.map((supplier) => supplier.id));

  /** Card "+ Add" CTA: put the supplier on the rail list (or take it back off). */
  const toggleRailAdd = (supplier: Supplier) => {
    setRailAdded((current) =>
      current.includes(supplier.id)
        ? current.filter((id) => id !== supplier.id)
        : [...current, supplier.id],
    );
  };

  const removeFromRail = (supplierId: string) => {
    setRailAdded((current) => current.filter((id) => id !== supplierId));
  };

  /** Queue the top ranked matches once the questionnaire wraps up. */
  useEffect(() => {
    if (!questionnaireComplete || autoQueued.current) return;
    const topIds = results.slice(0, AUTO_QUEUE_COUNT).map((supplier) => supplier.id);
    if (topIds.length === 0) return;
    autoQueued.current = true;
    setRailAdded((current) => [
      ...topIds,
      ...current.filter((id) => !topIds.includes(id)),
    ]);
  }, [questionnaireComplete, results]);

  const revealSupplier = (supplierId: string) => {
    const index = results.findIndex((supplier) => supplier.id === supplierId);
    if (index < 0) return;
    const targetPage = Math.floor(index / PAGE_SIZE) + 1;
    pendingRevealId.current = supplierId;
    setFocusedSupplierId(supplierId);
    if (targetPage !== currentPage) {
      setPage(targetPage);
    } else {
      setRevealNonce((nonce) => nonce + 1);
    }
  };

  useEffect(() => {
    const id = pendingRevealId.current;
    if (!id) return;
    const card = scrollRef.current?.querySelector(`[data-supplier-id="${id}"]`);
    if (!card) return;
    card.scrollIntoView({ behavior: "smooth", block: "start" });
    pendingRevealId.current = null;
  }, [page, revealNonce, results]);

  useEffect(() => {
    if (!focusedSupplierId) return;
    const timer = setTimeout(() => setFocusedSupplierId(null), 1600);
    return () => clearTimeout(timer);
  }, [focusedSupplierId]);

  // The engage rail's RFI goes to its own list.
  const contactRecipients = railRfi ? railSuppliers : [];

  /** Rail primary CTA: RFI addressed to the pre-picked top suppliers. */
  const openRailRfi = () => {
    setRailRfi(true);
    setContactOpen(true);
  };

  /** Drafted RFI headline: material + process + part type, e.g. "Metal
      Progressive Die Brackets", falling back to the search query. */
  const answerValue = (questionId: string) =>
    logged.find((answer) => answer.questionId === questionId)?.values[0];
  const draftPieces = [answerValue("material"), answerValue("process")].filter(
    (value): value is string => value != null,
  );
  const draftTitle =
    draftPieces.length > 0
      ? [...draftPieces, answerValue("part") ?? "Parts"].join(" ")
      : query;

  /** Rail secondary CTA: pick a list before the suppliers are saved to it. */
  const shortlistRailSuppliers = () => setShortlistOpen(true);

  const saveToShortlist = () => {
    setSaved((set) => {
      const next = new Set(set);
      for (const supplier of railSuppliers) next.add(supplier.id);
      return next;
    });
    setShortlistOpen(false);
  };

  return (
    <>
      <div className="results-body">
      <div className="results-center">
        <div className="pane-scroll" ref={scrollRef}>
      <div className="results-header">
        <div className="results-meta">
          <div className="results-headline">
            <h3 className="mar-0">Suppliers that match your spec</h3>
            <p className="mar-0 txt-smaller txt-darkblue-75">
              <span className="txt-blue-100 font-semi">{matchTotal.toLocaleString()}</span>{" "}
              verified suppliers match your query.
            </p>
          </div>
          <button
            type="button"
            className="all-filters"
            aria-label="All Filters"
            onClick={() => setFiltersOpen(true)}
          >
            <l-icon name="sliders" aria-hidden="true" />
            <span className="all-filters-label">All Filters</span>
            {filterCount > 0 && <span className="all-filters-count">{filterCount}</span>}
          </button>
        </div>
        {/* Logged answers echoed as removable pills, each under the facet it
            narrowed — the spec stays visible without reopening the drawer. */}
        {facets.length > 0 && (
          <div className="answer-pill-row">
            {facets.map((facet) => (
              <div className="answer-pill-stack" key={facet.id}>
                <span className="answer-pill-label">{facet.label}</span>
                <span className="answer-pill">
                  {facet.value}
                  <button
                    type="button"
                    className="answer-pill-remove"
                    aria-label={`Remove ${facet.title}: ${facet.value}`}
                    onClick={() => onRemoveAnswer(facet.id)}
                  >
                    <l-icon name="xmark" aria-hidden="true" />
                  </button>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
        <div className="results-list">
          {results.slice(pageStart, pageStart + PAGE_SIZE).map((supplier) => (
            <Fragment key={supplier.id}>
              <div
                className={
                  focusedSupplierId === supplier.id
                    ? "supplier-anchor is-focused"
                    : "supplier-anchor"
                }
                data-supplier-id={supplier.id}
              >
                <SupplierCard
                  supplier={supplier}
                  added={railIds.has(supplier.id)}
                  onToggleAdd={() => toggleRailAdd(supplier)}
                  matchPills={matchPills}
                />
              </div>
            </Fragment>
          ))}
          {results.length === 0 && (
            <l-panel class="results-row-full">
              <p className="mar-0">
                No suppliers match every requirement yet. Try skipping the last answer or widening a
                constraint.
              </p>
            </l-panel>
          )}
          {pageCount > 1 && (
            <nav className="results-row-full pagination" aria-label="Results pages">
              <button
                type="button"
                className="page-nav"
                disabled={currentPage === 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                <l-icon name="arrow-left" aria-hidden="true" /> Previous
              </button>
              {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
                <button
                  key={number}
                  type="button"
                  className="page-number"
                  aria-label={`Page ${number}`}
                  aria-current={number === currentPage ? "page" : undefined}
                  onClick={() => goToPage(number)}
                >
                  {number}
                </button>
              ))}
              <button
                type="button"
                className="page-nav"
                disabled={currentPage === pageCount}
                onClick={() => goToPage(currentPage + 1)}
              >
                Next <l-icon name="arrow-right" aria-hidden="true" />
              </button>
            </nav>
          )}
        </div>
      </div>
      </div>

        <SelectSuppliersRail
          suppliers={railSuppliers}
          onRemove={removeFromRail}
          onReveal={revealSupplier}
          onAddToShortlist={shortlistRailSuppliers}
          onSendRfi={openRailRfi}
          draftTitle={draftTitle}
          requirementCount={logged.length}
          requirementPreview={requirements}
        />
      </div>

      {/* Tablet and phone: the engage rail collapses into a fixed bottom tray. */}
      <div className="engage-tray">
        <button type="button" className="engage-tray-refine" onClick={onRefine}>
          <l-icon name="sparkles" fill aria-hidden="true" /> Refine
        </button>
        {/* Marks and their count share one cell, so the count sits against the
            logos instead of being pushed out by the button column below. */}
        <span className="engage-tray-picks">
          {railSuppliers.length > 0 && (
            <span className="engage-tray-avatars" aria-hidden="true">
              {railSuppliers.slice(0, 3).map((supplier) => (
                <span key={supplier.id}>
                  <SupplierLogo name={supplier.name} size={26} />
                </span>
              ))}
            </span>
          )}
          <span className="engage-tray-note">
            {railSuppliers.length} supplier{railSuppliers.length === 1 ? "" : "s"} to engage
          </span>
        </span>
        <button
          kind="neutral"
          scale="small"
          type="button"
          className="engage-tray-shortlist"
          disabled={railSuppliers.length === 0}
          onClick={shortlistRailSuppliers}
        >
          Shortlist
        </button>
        <button
          kind="primary"
          scale="small"
          type="button"
          disabled={railSuppliers.length === 0}
          onClick={openRailRfi}
        >
          Send RFI
        </button>
      </div>

      <ShortlistModal
        open={shortlistOpen}
        onClose={() => setShortlistOpen(false)}
        supplierCount={railSuppliers.length}
        onSave={saveToShortlist}
      />

      <ContactSupplierModal
        suppliers={contactRecipients}
        open={contactOpen}
        onClose={() => {
          setContactOpen(false);
          setRailRfi(false);
        }}
        requirements={requirements}
      />

      <FilterDrawer
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        applied={facets}
        onRemoveApplied={onRemoveAnswer}
        groups={filterGroups}
        picked={facetPicks}
        onTogglePicked={toggleFacet}
        verifiedOnly={verifiedOnly}
        onVerifiedOnly={setVerifiedOnly}
        partnerOnly={partnerOnly}
        onPartnerOnly={setPartnerOnly}
        location={locationDraft}
        onLocation={onLocation}
        selectedCount={filterCount}
        onClearAll={clearFilters}
      />
    </>
  );
}
