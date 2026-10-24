export type CalendarRoute = { view: "calendar"; year: string | null; month: string };
export type Route =
  | CalendarRoute
  | { view: "edit"; id: string | null }
  | { view: "review"; slug: string };

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
  if (first === "games") {
    if (parts.length !== 2) return null;
    try {
      return { view: "review", slug: decodeURIComponent(second!) };
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

/** The link name of a game: its title in lowercase words, falling back to its id for titles with none. */
export const gameSlug = (game: { id: string; title: string }) =>
  game.title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f'’]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || game.id;

export const reviewPath = (game: { id: string; title: string }) =>
  `/games/${encodeURIComponent(gameSlug(game))}`;

/** The calendar a review was opened from. It rides in navigation state so it stays behind the dialog. */
export function backdropOf(state: unknown): { path: string; route: CalendarRoute } | null {
  const path = (state as { from?: unknown } | null)?.from;
  if (typeof path !== "string") return null;
  const route = parseRoute(path);
  return route?.view === "calendar" ? { path, route } : null;
}
