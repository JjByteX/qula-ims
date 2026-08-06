// Matches the client's real templates: "July 31, 2026", not "07/31/2026"
// or an ISO string. Parsed with the T00:00:00 suffix so the displayed
// day never shifts due to the browser's local timezone, same reasoning
// as budget's expenses-section.tsx.
export function formatDocumentDate(value: string): string {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

// Peso amounts in the templates are plain grouped numbers with two
// decimals ("₱15,000.00"), no currency-code suffix.
export function formatPesoAmount(value: string): string {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(Number(value));
}
