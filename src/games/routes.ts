export type Route =
  | { view: "calendar"; year: string | null; month: string }
  | { view: "edit"; id: string | null };

const MIN_YEAR = 1970;
const MAX_YEAR = 2200;

export function parseRoute(pathname: string): Route | null {
  const parts = pathname.split("/").filter(Boolean);
  const [first, second] = parts;
  if (first === undefined) return { view: "calendar", year: null, month: "all" };
  if (first === "edit") {
    if (parts.length > 2) return null;
    try {
      return { view: "edit", id: second === undefined ? null : decodeURIComponent(second) };
    } catch {
      return null;
    }
  }
  if (first === "unscheduled")
    return parts.length === 1 ? { view: "calendar", year: first, month: "all" } : null;
  if (!/^\d{4}$/.test(first) || parts.length > 2) return null;
  if (Number(first) < MIN_YEAR || Number(first) > MAX_YEAR) return null;
  if (second === undefined) return { view: "calendar", year: first, month: "all" };
  if (!/^\d{1,2}$/.test(second) || Number(second) < 1 || Number(second) > 12) return null;
  return { view: "calendar", year: first, month: String(Number(second)) };
}

export const calendarPath = (year: string, month = "all") =>
  year === "unscheduled" ? "/unscheduled" : month === "all" ? `/${year}` : `/${year}/${month}`;

export const editPath = (id: string | null) => (id ? `/edit/${encodeURIComponent(id)}` : "/edit");
