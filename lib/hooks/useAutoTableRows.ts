"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// useAutoTableRows — viewport-fit row count for a table.
//
// Ported from amkor-ims's resources/js/hooks/useAutoPageSize.js. Same core
// idea: measure the table card's available height, subtract the header
// (and toolbar, if any) and pagination bar, divide by a fixed row height,
// and clamp the result — so a table always shows exactly as many rows as
// fit the viewport instead of scrolling internally or leaving dead space.
//
// Simplified from the original for Qula's tables specifically:
//   - Qula's project lists are fetched once and paginated entirely
//     client-side (no server per_page round-trip), so there's no
//     debounce-then-refetch dance or "correcting" skeleton-row state —
//     the row count just updates directly on measurement.
//   - No Inertia router / page-size-remembering-per-route; Qula tables
//     don't need to persist a chosen page size across navigations.
//
// Usage:
//   const { containerRef, rowsPerPage } = useAutoTableRows({ hasToolbar: true });
//   <div ref={containerRef} className="flex min-h-0 flex-1 flex-col ...">
//     ...toolbar with data-table-toolbar... <table>...</table>...pagination...
//   </div>
export default function useAutoTableRows({
  hasToolbar = false,
  hasPagination = true,
  minRows = 3,
  maxRows = 100,
}: {
  hasToolbar?: boolean;
  hasPagination?: boolean;
  minRows?: number;
  maxRows?: number;
} = {}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [rowsPerPage, setRowsPerPage] = useState(minRows);

  function getCssVar(name: string, fallback: number) {
    const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    const n = parseInt(raw, 10);
    return isNaN(n) ? fallback : n;
  }

  const compute = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;

    const availableH = el.getBoundingClientRect().height;
    const rowH = getCssVar("--height-table-row", 41);
    const headerH = getCssVar("--height-table-header", 37);
    const paginationH = hasPagination ? 32 : 0;
    const paginationGap = hasPagination ? 8 : 0;

    let toolbarH = 0;
    if (hasToolbar) {
      const toolbar = el.querySelector<HTMLElement>("[data-table-toolbar]");
      toolbarH = toolbar ? toolbar.getBoundingClientRect().height : 0;
    }

    const usable = availableH - paginationH - paginationGap - headerH - toolbarH - 2;
    const rows = Math.floor(usable / rowH);
    const clamped = Math.max(minRows, Math.min(maxRows, rows));

    setRowsPerPage(clamped);
  }, [hasToolbar, hasPagination, minRows, maxRows]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(compute);
    observer.observe(el);
    compute();
    return () => observer.disconnect();
  }, [compute]);

  return { containerRef, rowsPerPage };
}
