"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CATEGORY_LABEL, STATUS_LABEL } from "@/lib/format";
import type { Category, Status } from "@/lib/types";
import { cn } from "@/lib/utils";

// ===========================================================================
// FILTERS LIVE IN THE URL, NOT IN REACT STATE.
//
// Every control here writes to the query string and the server component
// re-renders from it. Nothing in this file holds the filter values — the URL
// does, and this component only reads and rewrites them.
//
// FOUR THINGS THAT FALL OUT OF THAT, all of which useState would cost:
//   1. A filtered view is a real URL you can send someone or bookmark.
//   2. The back button works, because each view is a history entry.
//   3. The results are server-rendered — no spinner on first paint, and no
//      client fetch waterfall.
//   4. Refreshing the page keeps the filters.
//
// The controls have to be a client component because they respond to input.
// The RESULTS do not, and are not.
// ===========================================================================

const CATEGORIES: Category[] = ["POTHOLE", "GARBAGE", "DRAINAGE", "STREETLIGHT", "OTHER"];
const STATUSES: Status[] = ["OPEN", "IN_PROGRESS", "RESOLVED"];

const SEARCH_DEBOUNCE_MS = 300;

export function ReportFilters() {
  const router = useRouter();
  const params = useSearchParams();

  const category = params.get("category") ?? "";
  const status = params.get("status") ?? "";
  const search = params.get("search") ?? "";

  // The search box is the ONE control that keeps local state, because it has to
  // stay responsive while typing — waiting for a server round trip per keystroke
  // would make the field feel broken. Everything else writes straight to the URL.
  const [searchDraft, setSearchDraft] = useState(search);

  // Keeps the box in sync when the URL changes from somewhere else — the back
  // button, or the "Clear filters" button below. Without this, going back would
  // change the results while leaving stale text in the input.
  useEffect(() => {
    setSearchDraft(search);
  }, [search]);

  /**
   * Rewrites the query string.
   *
   * TWO DETAILS THAT MATTER:
   *
   * `page` is always deleted. Changing a filter while on page 5 of a two-page
   * result would show an empty list that looks exactly like "no matches" — a
   * bug that is very hard to recognise as a bug.
   *
   * `replace` vs `push`: filter changes REPLACE the history entry, so the back
   * button leaves the list rather than walking backwards through every
   * intermediate state of a debounced search — `dra`, `dr`, `d`. The pager uses
   * `push`, because stepping back a page IS what back should do there.
   */
  function apply(changes: Record<string, string>) {
    const next = new URLSearchParams(params.toString());

    for (const [key, value] of Object.entries(changes)) {
      if (value) next.set(key, value);
      else next.delete(key);
    }
    next.delete("page");

    const qs = next.toString();
    router.replace(qs ? `/reports?${qs}` : "/reports", { scroll: false });
  }

  // Debounce the search box. The timer is held in a ref rather than state
  // because changing it must not trigger a re-render.
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function onSearchChange(value: string) {
    setSearchDraft(value);

    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => apply({ search: value }), SEARCH_DEBOUNCE_MS);
  }

  // Clear any pending timer on unmount, so a navigation cannot be followed by a
  // stray router.replace from a component that no longer exists.
  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const hasFilters = Boolean(category || status || search);

  return (
    <div className="space-y-5">
      <div className="max-w-md space-y-1.5">
        <Label htmlFor="report-search">Search</Label>
        <Input
          id="report-search"
          type="search"
          placeholder="Title or description"
          value={searchDraft}
          onChange={(e) => onSearchChange(e.target.value)}
        />
        {/* The backend matches case-insensitively across BOTH title and
            description (Postgres ILIKE). Saying so stops people guessing. */}
        <p className="text-sm text-ink-muted">
          Matches the title or the description, ignoring case.
        </p>
      </div>

      <div className="space-y-3">
        <FilterRow
          legend="Category"
          options={CATEGORIES.map((c) => ({ value: c, label: CATEGORY_LABEL[c] }))}
          selected={category}
          onSelect={(value) => apply({ category: value })}
        />
        <FilterRow
          legend="Status"
          options={STATUSES.map((s) => ({ value: s, label: STATUS_LABEL[s] }))}
          selected={status}
          onSelect={(value) => apply({ status: value })}
        />
      </div>

      {hasFilters && (
        <button
          type="button"
          onClick={() => router.replace("/reports", { scroll: false })}
          className="docket py-1.5 text-signal-ink underline underline-offset-4"
        >
          Clear all filters
        </button>
      )}
    </div>
  );
}

/**
 * A row of toggle chips.
 *
 * Chips rather than a <select> on purpose: five categories are all visible at
 * once, so filtering is one tap instead of open-scroll-choose. On a phone a
 * native select opens a full-screen wheel, which is a lot of ceremony for a
 * five-item list.
 *
 * `fieldset`/`legend` is the correct grouping for a set of related controls —
 * a screen reader announces "Category, Pothole, button" rather than a bare
 * "Pothole" with no indication of what it filters.
 */
function FilterRow({
  legend,
  options,
  selected,
  onSelect,
}: {
  legend: string;
  options: { value: string; label: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="docket mb-1">{legend}</legend>

      {options.map(({ value, label }) => {
        const active = selected === value;
        return (
          <button
            key={value}
            type="button"
            // Toggling: tapping the active chip clears it. Avoids needing a
            // separate "All" chip in every row.
            onClick={() => onSelect(active ? "" : value)}
            // aria-pressed is what makes a toggle button announce its state.
            // Without it a screen reader says "Pothole, button" whether the
            // filter is on or off.
            aria-pressed={active}
            className={cn(
              "docket rounded-full border px-3 py-1.5 transition-colors",
              active
                ? "border-signal bg-signal-wash text-signal-ink"
                : "border-rule text-ink-muted hover:border-ink-muted hover:text-ink"
            )}
          >
            {label}
          </button>
        );
      })}
    </fieldset>
  );
}
