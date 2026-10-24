import { expect, it } from "vite-plus/test";
import { calendarPath, editPath, parseRoute } from "./routes";

it("nav.routes: reads calendar filters and editor targets from the path", () => {
  expect(parseRoute("/")).toEqual({ view: "calendar", year: null, month: "all" });
  expect(parseRoute("/2026")).toEqual({ view: "calendar", year: "2026", month: "all" });
  expect(parseRoute("/2026/10")).toEqual({ view: "calendar", year: "2026", month: "10" });
  expect(parseRoute("/unscheduled")).toEqual({
    view: "calendar",
    year: "unscheduled",
    month: "all",
  });
  expect(parseRoute("/edit")).toEqual({ view: "edit", id: null });
  expect(parseRoute("/edit/hades-ii")).toEqual({ view: "edit", id: "hades-ii" });
});

it("nav.routes: rejects paths that name no real view", () => {
  for (const path of [
    "/2026/13",
    "/2026/0",
    "/1800",
    "/abc",
    "/2026/1/2",
    "/edit/a/b",
    "/unscheduled/3",
  ])
    expect(parseRoute(path)).toBeNull();
});

it("nav.routes: builds paths that parse back to the same view", () => {
  expect(calendarPath("2026")).toBe("/2026");
  expect(calendarPath("2026", "3")).toBe("/2026/3");
  expect(calendarPath("unscheduled", "3")).toBe("/unscheduled");
  expect(parseRoute(editPath("a b"))).toEqual({ view: "edit", id: "a b" });
  expect(editPath(null)).toBe("/edit");
});
