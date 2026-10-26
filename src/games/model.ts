import { z } from "zod";

const year = z.number().int().min(1970).max(2200);
const month = z.number().int().min(1).max(12);
const releaseSchema = z
  .discriminatedUnion("precision", [
    z
      .object({ precision: z.literal("day"), year, month, day: z.number().int().min(1).max(31) })
      .strict(),
    z.object({ precision: z.literal("month"), year, month }).strict(),
    z
      .object({ precision: z.literal("quarter"), year, quarter: z.number().int().min(1).max(4) })
      .strict(),
    z.object({ precision: z.literal("year"), year }).strict(),
    z.object({ precision: z.literal("unknown"), year: year.nullable() }).strict(),
  ])
  .refine((release) => {
    if (release.precision !== "day") return true;
    return (
      new Date(Date.UTC(release.year, release.month - 1, release.day)).getUTCDate() === release.day
    );
  }, "That day does not exist in the selected month.");

const safeUrl = z
  .string()
  .max(2000)
  .refine((value) => {
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:";
    } catch {
      return false;
    }
  }, "Use a complete http or https URL.");

export const playStatuses = ["not_played", "started", "played", "completed"] as const;
export const playLabels: Record<(typeof playStatuses)[number], string> = {
  not_played: "Not played",
  started: "Started",
  played: "Played",
  completed: "Completed",
};

// Any game that has been started can carry a review.
export function canReview(play: string): boolean {
  return play !== "not_played";
}

export function isPlayed(play: string): boolean {
  return play === "played" || play === "completed";
}

// Short bullet points that sit beside the written review.
export const verdicts = ["amazing", "nice", "questionable", "terrible"] as const;
export type Verdict = (typeof verdicts)[number];
export const verdictLabels: Record<Verdict, string> = {
  amazing: "Amazing",
  nice: "Nice",
  questionable: "Questionable",
  terrible: "Terrible",
};
const notes = z.array(z.string().trim().min(1));

// Whether a review has anything to open: a write-up or a point. A score alone stays on the card.
export function hasReviewContent(review: NonNullable<Game["review"]>): boolean {
  return review.text !== "" || verdicts.some((verdict) => review[verdict].length > 0);
}

export const gameFieldsSchema = z
  .object({
    id: z
      .string()
      .min(1)
      .max(100)
      .regex(/^[a-z0-9-]+$/),
    title: z.string().trim().min(1).max(160),
    cover: z.union([safeUrl, z.string().regex(/^\/covers\/[a-zA-Z0-9._-]+$/)]).nullable(),
    release: releaseSchema,
    source: safeUrl.nullable(),
    hype: z.number().int().min(1).max(5).nullable(),
    play: z.enum(playStatuses),
    review: z
      .object({
        text: z.string().trim().max(1000),
        score: z.number().int().min(1).max(10).nullable(),
        amazing: notes,
        nice: notes,
        questionable: notes,
        terrible: notes,
      })
      .strict()
      .nullable(),
  })
  .strict();

// Reviews exist exactly for games that have been started.
export const gameSchema = gameFieldsSchema.refine(
  (game) => (game.review !== null) === canReview(game.play),
  "Only started, played, and completed games have a review.",
);

export const gamesSchema = z
  .array(gameSchema)
  .max(1000)
  .refine(
    (games) => new Set(games.map((game) => game.id)).size === games.length,
    "Game IDs must be unique.",
  );
export type Game = z.infer<typeof gameSchema>;
export type Release = Game["release"];

export const MONTHS = Array.from({ length: 12 }, (_, index) =>
  new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
    new Date(Date.UTC(2026, index, 1)),
  ),
);

export function releaseLabel(release: Release): string {
  switch (release.precision) {
    case "day":
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(release.year, release.month - 1, release.day)));
    case "month":
      return new Intl.DateTimeFormat("en-US", {
        month: "short",
        year: "numeric",
        timeZone: "UTC",
      }).format(new Date(Date.UTC(release.year, release.month - 1, 1)));
    case "quarter":
      return `Q${release.quarter} ${release.year}`;
    case "year":
      return `${release.year} · date TBA`;
    case "unknown":
      return release.year === null ? "TBD" : `${release.year} · date unknown`;
  }
}

// How soon an exact release lands, for the final week before it: "today", "tomorrow", "in 5 days".
export function releaseCountdown(release: Release, today = new Date()): string | null {
  if (release.precision !== "day") return null;
  const days = Math.round(
    (Date.UTC(release.year, release.month - 1, release.day) -
      Date.UTC(today.getFullYear(), today.getMonth(), today.getDate())) /
      86_400_000,
  );
  if (days < 0 || days > 7) return null;
  return days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
}

export function hasReleased(release: Release, today = new Date()): boolean {
  if (release.precision === "unknown") return false;
  const lastDay =
    release.precision === "day"
      ? new Date(release.year, release.month - 1, release.day)
      : release.precision === "month"
        ? new Date(release.year, release.month, 0)
        : release.precision === "quarter"
          ? new Date(release.year, release.quarter * 3, 0)
          : new Date(release.year, 11, 31);
  const currentDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return release.precision === "day" ? currentDay >= lastDay : currentDay > lastDay;
}

/** The first game in today's year that hasn't passed yet, so Today can scroll past the releases already out. */
export function upcomingGame(games: Game[], today = new Date()): Game | undefined {
  const month = today.getMonth() + 1;
  return calendarSections(games, String(today.getFullYear()))
    .filter((section) => section.key <= 12)
    .flatMap((section) => section.games)
    .find(({ release }) =>
      release.precision === "day"
        ? release.month > month || (release.month === month && release.day >= today.getDate())
        : release.precision === "month" && release.month >= month,
    );
}

/** Later years with games, in order, then "unscheduled" last if any game has no year. */
export function followingYears(games: Game[], selectedYear: string): string[] {
  if (selectedYear === "unscheduled") return [];
  const later = games.flatMap(({ release }) =>
    release.year !== null && release.year > Number(selectedYear) ? [release.year] : [],
  );
  const years = [...new Set(later)].sort((a, b) => a - b).map(String);
  return games.some(({ release }) => release.year === null) ? [...years, "unscheduled"] : years;
}

export function calendarSections(games: Game[], selectedYear: string) {
  const filtered = games.filter(({ release }) =>
    release.year === null ? selectedYear === "unscheduled" : String(release.year) === selectedYear,
  );
  const groups = new Map<number, { label: string; games: Game[] }>();
  for (const game of filtered) {
    const release = game.release;
    const key =
      release.precision === "day" || release.precision === "month"
        ? release.month
        : release.precision === "quarter"
          ? 12 + release.quarter
          : release.year === null
            ? 18
            : 17;
    const label =
      key <= 12
        ? MONTHS[key - 1]!
        : key <= 16
          ? `Q${key - 12} · month unannounced`
          : key === 17
            ? "Date to be announced"
            : "TBD";
    if (!groups.has(key)) groups.set(key, { label, games: [] });
    groups.get(key)!.games.push(game);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a - b)
    .map(([key, group]) => ({
      key,
      label: group.label,
      games: group.games.toSorted((a, b) => {
        const day = (game: Game) => (game.release.precision === "day" ? game.release.day : 32);
        return day(a) - day(b) || a.title.localeCompare(b.title);
      }),
    }));
}
