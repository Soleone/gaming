import { describe, expect, it } from "vite-plus/test";
import { calendarSections, gameSchema, gamesSchema, releaseLabel, type Game } from "./model";
import data from "../data/games.json";

const game: Game = {
  id: "test-game",
  title: "Test game",
  cover: null,
  release: { precision: "unknown", year: 2026 },
  source: null,
  hype: null,
  review: null,
};

describe("game data", () => {
  it("data.valid: validates the current collection", () => {
    expect(gamesSchema.safeParse(data).success).toBe(true);
  });
  it("release.precision: preserves exact, month, quarter, year and unknown labels", () => {
    expect(releaseLabel({ precision: "day", year: 2007, month: 4, day: 2 })).toBe("April 2, 2007");
    expect(releaseLabel({ precision: "month", year: 2007, month: 4 })).toBe("April 2007");
    expect(releaseLabel({ precision: "quarter", year: 2007, quarter: 2 })).toBe("Q2 2007");
    expect(releaseLabel({ precision: "year", year: 2007 })).toBe("2007 · date TBA");
    expect(releaseLabel({ precision: "unknown", year: null })).toBe("Release date unknown");
  });
  it("data.valid: rejects impossible days, duplicate IDs, unsafe URLs and out-of-range ratings", () => {
    expect(
      gameSchema.safeParse({
        ...game,
        release: { precision: "day", year: 2026, month: 2, day: 29 },
      }).success,
    ).toBe(false);
    expect(
      gameSchema.safeParse({
        ...game,
        release: { precision: "day", year: 2028, month: 2, day: 29 },
      }).success,
    ).toBe(true);
    expect(gameSchema.safeParse({ ...game, hype: 6 }).success).toBe(false);
    expect(gameSchema.safeParse({ ...game, review: { text: "", score: 0 } }).success).toBe(false);
    expect(gameSchema.safeParse({ ...game, review: { text: "", score: 10.5 } }).success).toBe(
      false,
    );
    expect(gameSchema.safeParse({ ...game, source: "javascript:alert(1)" }).success).toBe(false);
    expect(gameSchema.safeParse({ ...game, cover: "/covers/../../secret" }).success).toBe(false);
    expect(gamesSchema.safeParse([game, game]).success).toBe(false);
  });
  it("calendar.filter: always filters by year and optionally by known month", () => {
    const entries: Game[] = [
      game,
      { ...game, id: "quarter", release: { precision: "quarter", year: 2026, quarter: 2 } },
      { ...game, id: "april", release: { precision: "month", year: 2026, month: 4 } },
      { ...game, id: "other-year", release: { precision: "year", year: 2027 } },
    ];
    expect(calendarSections(entries, "2026", "all").map((section) => section.label)).toEqual([
      "April",
      "Q2 · month unannounced",
      "Date to be announced",
    ]);
    expect(
      calendarSections(entries, "2026", "4").flatMap((section) =>
        section.games.map((entry) => entry.id),
      ),
    ).toEqual(["april"]);
    expect(calendarSections(entries, "2007", "all")).toEqual([]);
    expect(
      calendarSections(
        [{ ...game, release: { precision: "unknown", year: null } }],
        "unscheduled",
        "all",
      ),
    ).toHaveLength(1);
  });
  it("calendar.order: sorts exact days before month-only entries", () => {
    const entries: Game[] = [
      { ...game, id: "month", release: { precision: "month", year: 2026, month: 4 } },
      { ...game, id: "late", release: { precision: "day", year: 2026, month: 4, day: 20 } },
      { ...game, id: "early", release: { precision: "day", year: 2026, month: 4, day: 1 } },
    ];
    expect(calendarSections(entries, "2026", "all")[0]?.games.map((entry) => entry.id)).toEqual([
      "early",
      "late",
      "month",
    ]);
  });
});
