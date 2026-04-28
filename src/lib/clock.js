// Demo clock — frozen so "today" stays consistent with the 2025 seed data.
// In a real app this would be `new Date()`. For the prototype, override here
// to bump the demo forward when seed data shifts.
export const TODAY = new Date("2025-04-23T00:00:00");

const MONTH_ID = {
  Jan: 0, Feb: 1, Mar: 2, Apr: 3, Mei: 4, Jun: 5,
  Jul: 6, Agu: 7, Sep: 8, Okt: 9, Nov: 10, Des: 11,
};

// Accepts a Date, an ISO "YYYY-MM-DD", or a legacy Bahasa "DD Mmm YYYY" string.
// Bahasa parsing is a temporary bridge — the seed-data cleanup (step 3) should
// move every date to ISO so this branch can be deleted.
export function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return new Date(input + "T00:00:00");
  const m = input.match(/^(\d+)\s+(\w+)\s+(\d{4})$/);
  if (m && MONTH_ID[m[2]] !== undefined) return new Date(+m[3], MONTH_ID[m[2]], +m[1]);
  return null;
}

const MS_PER_DAY = 86400000;

export function daysSince(input) {
  const date = parseDate(input);
  if (!date) return Infinity;
  return Math.floor((TODAY - date) / MS_PER_DAY);
}
