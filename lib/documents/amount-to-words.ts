// Converts a peso amount to the words used on generated invoices/ARs
// (phases-plan-revision-1.md Phase 9), matching the seed data's wording
// exactly: "Twenty Thousand Pesos Only" for a whole amount. Handles
// centavos too, since milestone.price is numeric(14,2) and can carry
// them even though every seeded example so far is a whole peso amount.
//
// ponytail: no npm number-to-words package — this only ever needs to
// spell out pesos, not general-purpose numbers (negatives, decimals
// beyond 2 places, etc.), so a small hand-rolled version is shorter than
// pulling in and adapting a dependency for it.

const ONES = [
  "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
  "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
  "Seventeen", "Eighteen", "Nineteen",
];
const TENS = [
  "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
];
const SCALES = ["", "Thousand", "Million", "Billion"];

function threeDigitsToWords(n: number): string {
  const parts: string[] = [];
  if (n >= 100) {
    parts.push(ONES[Math.floor(n / 100)], "Hundred");
    n %= 100;
  }
  if (n >= 20) {
    parts.push(TENS[Math.floor(n / 10)]);
    n %= 10;
    if (n > 0) parts.push(ONES[n]);
  } else if (n > 0) {
    parts.push(ONES[n]);
  }
  return parts.join(" ");
}

function integerToWords(value: number): string {
  if (value === 0) return "Zero";

  const groups: string[] = [];
  let n = value;
  let scale = 0;
  while (n > 0) {
    const chunk = n % 1000;
    if (chunk > 0) {
      groups.unshift(`${threeDigitsToWords(chunk)}${SCALES[scale] ? ` ${SCALES[scale]}` : ""}`);
    }
    n = Math.floor(n / 1000);
    scale += 1;
  }
  return groups.join(" ");
}

// value is a decimal string like "20000.00" or "1500.50", same shape as
// project_documents.amount / milestones.price.
export function amountToWords(value: string): string {
  const amount = Number(value);
  const pesos = Math.trunc(amount);
  const centavos = Math.round((amount - pesos) * 100);

  const pesosWords = `${integerToWords(pesos)} Peso${pesos === 1 ? "" : "s"}`;
  if (centavos === 0) {
    return `${pesosWords} Only`;
  }
  const centavosWords = `${integerToWords(centavos)} Centavo${centavos === 1 ? "" : "s"}`;
  return `${pesosWords} and ${centavosWords} Only`;
}
