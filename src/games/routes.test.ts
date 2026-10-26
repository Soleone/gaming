import { expect, it } from "vite-plus/test";
import { backdropOf, calendarPath, editPath, gameSlug, parseRoute, reviewPath } from "./routes";

it("nav.routes: reads the calendar year and editor targets from the path", () => {
  expect(parseRoute("/")).toEqual({ view: "calendar", year: null });
  expect(parseRoute("/2026")).toEqual({ view: "calendar", year: "2026" });
  expect(parseRoute("/unscheduled")).toEqual({ view: "calendar", year: "unscheduled" });
  expect(parseRoute("/games/hades-ii")).toEqual({ view: "review", slug: "hades-ii" });
  expect(parseRoute("/edit")).toEqual({ view: "edit", id: null });
  expect(parseRoute("/edit/hades-ii")).toEqual({ view: "edit", id: "hades-ii" });
});

it("nav.routes: rejects paths that name no real view", () => {
  for (const path of [
    "/2026/10",
    "/1800",
    "/abc",
    "/2026/1/2",
    "/edit/a/b",
    "/unscheduled/3",
    "/games",
    "/games/a/b",
  ])
    expect(parseRoute(path)).toBeNull();
});

it("nav.routes: builds paths that parse back to the same view", () => {
  expect(calendarPath("2026")).toBe("/2026");
  expect(calendarPath("unscheduled")).toBe("/unscheduled");
  expect(parseRoute(editPath("a b"))).toEqual({ view: "edit", id: "a b" });
  expect(editPath(null)).toBe("/edit");
});

it("nav.routes: round-trips review paths and keeps only a calendar as the backdrop", () => {
  const game = { id: "x", title: "Castlevania: Belmont's Curse" };
  expect(reviewPath(game)).toBe("/games/castlevania-belmonts-curse");
  expect(parseRoute(reviewPath(game))).toEqual({
    view: "review",
    slug: "castlevania-belmonts-curse",
  });
  expect(gameSlug({ id: "x", title: "Pokémon Légendes: Z-A" })).toBe("pokemon-legendes-z-a");
  expect(gameSlug({ id: "x", title: "!!!" })).toBe("x");
  expect(backdropOf({ from: "/2026" })?.route).toEqual({ view: "calendar", year: "2026" });
  expect(backdropOf({ from: "/edit" })).toBeNull();
  expect(backdropOf({ from: "/games/x" })).toBeNull();
  expect(backdropOf(null)).toBeNull();
});
