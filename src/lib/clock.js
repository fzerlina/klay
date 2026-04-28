// Demo clock — frozen so "today" stays consistent with the 2025 seed data.
// In a real app this would be `new Date()`. For the prototype, override here
// to bump the demo forward when seed data shifts.
export const TODAY = new Date("2025-04-23T00:00:00");

// All seed dates are ISO (YYYY-MM-DD). Accepts ISO strings or Date objects.
export function parseDate(input) {
  if (!input) return null;
  if (input instanceof Date) return input;
  if (/^\d{4}-\d{2}-\d{2}/.test(input)) return new Date(input + "T00:00:00");
  return null;
}

const MS_PER_DAY = 86400000;

export function daysSince(input) {
  const date = parseDate(input);
  if (!date) return Infinity;
  return Math.floor((TODAY - date) / MS_PER_DAY);
}
