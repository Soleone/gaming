import { describe, expect, it } from "vite-plus/test";
import {
  calendarSections,
  followingYears,
  gameSchema,
  gamesSchema,
  hasReleased,
  releaseLabel,
  type Game,
} from "./model";
import data from "../data/games.json";

const game: Game = {
  id: "test-game",
  title: "Test game",
  cover: null,
  release: { precision: "unknown", year: 2026 },
  source: null,
  hype: null,
  play: "not_played",
  review: null,
};
const emptyReview = {
  text: "",
  score: null,
  amazing: [],
  nice: [],
  questionable: [],
  terrible: [],
};

describe("game data", () => {
  it("data.valid: validates the current collection", () => {
    expect(gamesSchema.safeParse(data).success).toBe(true);
  });
  it("release.precision: preserves exact, month, quarter, year and unknown labels", () => {
    expect(releaseLabel({ precision: "day", year: 2007, month: 4, day: 2 })).toBe("Apr 2, 2007");
    expect(releaseLabel({ precision: "month", year: 2007, month: 4 })).toBe("Apr 2007");
    expect(releaseLabel({ precision: "quarter", year: 2007, quarter: 2 })).toBe("Q2 2007");
    expect(releaseLabel({ precision: "year", year: 2007 })).toBe("2007 · date TBA");
    expect(releaseLabel({ precision: "unknown", year: null })).toBe("Release date unknown");
  });
  it("release.precision: formats exact dates with an abbreviated month and no leading zero", () => {
    expect(releaseLabel({ precision: "day", year: 2026, month: 10, day: 24 })).toBe("Oct 24, 2026");
    expect(releaseLabel({ precision: "day", year: 2026, month: 1, day: 4 })).toBe("Jan 4, 2026");
  });
  it("review.visibility: waits for a known release day or the end of a partial-date window", () => {
    const exact = { precision: "day", year: 2026, month: 10, day: 24 } as const;
    expect(hasReleased(exact, new Date(2026, 9, 23, 23, 59))).toBe(false);
    expect(hasReleased(exact, new Date(2026, 9, 24))).toBe(true);
    expect(hasReleased(exact, new Date(2026, 9, 25))).toBe(true);
    const partialDates = [
      {
        release: { precision: "month", year: 2026, month: 10 },
        end: new Date(2026, 9, 31),
        after: new Date(2026, 10, 1),
      },
      {
        release: { precision: "quarter", year: 2026, quarter: 2 },
        end: new Date(2026, 5, 30),
        after: new Date(2026, 6, 1),
      },
      {
        release: { precision: "year", year: 2026 },
        end: new Date(2026, 11, 31),
        after: new Date(2027, 0, 1),
      },
    ] as const;
    for (const { release, end, after } of partialDates) {
      expect(hasReleased(release, end)).toBe(false);
      expect(hasReleased(release, after)).toBe(true);
    }
    expect(hasReleased({ precision: "unknown", year: 2025 }, new Date(2026, 9, 24))).toBe(false);
    expect(hasReleased({ precision: "unknown", year: null }, new Date(2026, 9, 24))).toBe(false);
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
    expect(gameSchema.safeParse({ ...game, play: "dropped" }).success).toBe(false);
    expect(gameSchema.safeParse({ ...game, play: "started" }).success).toBe(false);
    expect(
      gameSchema.safeParse({ ...game, play: "started", review: { ...emptyReview, score: null } })
        .success,
    ).toBe(true);
    expect(
      gameSchema.safeParse({ ...game, play: "started", review: { text: "", score: null } }).success,
    ).toBe(false);
    expect(
      gameSchema.safeParse({ ...game, play: "started", review: { ...emptyReview, nice: [""] } })
        .success,
    ).toBe(false);
    expect(
      gameSchema.safeParse({
        ...game,
        play: "started",
        review: { ...emptyReview, terrible: Array.from({ length: 21 }, () => "Too much") },
      }).success,
    ).toBe(false);
    expect(gameSchema.safeParse({ ...game, play: "not_played", review: emptyReview }).success).toBe(
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
  it("calendar.continue: continues into later years that have games, skipping empty ones", () => {
    const entries: Game[] = [
      { ...game, id: "earlier", release: { precision: "year", year: 2025 } },
      game,
      { ...game, id: "later", release: { precision: "quarter", year: 2029, quarter: 1 } },
      { ...game, id: "next", release: { precision: "month", year: 2027, month: 3 } },
      { ...game, id: "next-too", release: { precision: "year", year: 2027 } },
      { ...game, id: "unscheduled", release: { precision: "unknown", year: null } },
    ];
    expect(followingYears(entries, "2026")).toEqual([2027, 2029]);
    expect(followingYears(entries, "2029")).toEqual([]);
    expect(followingYears(entries, "unscheduled")).toEqual([]);
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
