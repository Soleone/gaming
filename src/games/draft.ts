import { canReview, gameSchema, verdicts, type Game, type Release, type Verdict } from "./model";
import type { ResearchProposal } from "./research";

export type GameDraft = {
  id: string;
  title: string;
  cover: string;
  precision: Release["precision"];
  year: string;
  month: string;
  day: string;
  quarter: string;
  source: string;
  hype: string;
  play: string;
  score: string;
  review: string;
} & Record<Verdict, string>;

// Each line of a verdict field is one bullet; pasted Markdown bullet markers are dropped.
const notesFrom = (text: string) =>
  text
    .split("\n")
    .map((line) => line.replace(/^\s*[-*•]\s*/, "").trim())
    .filter(Boolean);

export function createGameDraft(game: Game | null): GameDraft {
  return {
    id: game?.id ?? crypto.randomUUID(),
    title: game?.title ?? "",
    cover: game?.cover ?? "",
    precision: game?.release.precision ?? "unknown",
    year: String(game ? (game.release.year ?? "") : new Date().getFullYear()),
    month: String(game && "month" in game.release ? game.release.month : 1),
    day: String(game?.release.precision === "day" ? game.release.day : 1),
    quarter: String(game?.release.precision === "quarter" ? game.release.quarter : 1),
    source: game?.source ?? "",
    hype: String(game?.hype ?? "unrated"),
    play: game?.play ?? "not_played",
    score: String(game?.review?.score ?? ""),
    review: game?.review?.text ?? "",
    amazing: game?.review?.amazing.join("\n") ?? "",
    nice: game?.review?.nice.join("\n") ?? "",
    questionable: game?.review?.questionable.join("\n") ?? "",
    terrible: game?.review?.terrible.join("\n") ?? "",
  };
}

export function parseGameDraft(draft: GameDraft) {
  return gameSchema.safeParse({
    id: draft.id,
    title: draft.title.trim(),
    cover: draft.cover.trim() || null,
    release: {
      precision: draft.precision,
      year: draft.year.trim() === "" ? null : Number(draft.year),
      ...(draft.precision === "day" || draft.precision === "month"
        ? { month: Number(draft.month) }
        : {}),
      ...(draft.precision === "day" ? { day: Number(draft.day) } : {}),
      ...(draft.precision === "quarter" ? { quarter: Number(draft.quarter) } : {}),
    },
    source: draft.source.trim() || null,
    hype: draft.hype === "unrated" ? null : Number(draft.hype),
    play: draft.play,
    review: canReview(draft.play)
      ? {
          text: draft.review.trim(),
          score: draft.score.trim() === "" ? null : Number(draft.score),
          ...Object.fromEntries(verdicts.map((verdict) => [verdict, notesFrom(draft[verdict])])),
        }
      : null,
  });
}

export function applyResearch(
  draft: GameDraft,
  proposal: ResearchProposal,
  cover?: string,
): GameDraft {
  const release = proposal.release;
  return {
    ...draft,
    title: proposal.title,
    cover: cover ?? draft.cover,
    source: proposal.source,
    precision: release.precision,
    year: String(release.year ?? ""),
    month: String("month" in release ? release.month : 1),
    day: String(release.precision === "day" ? release.day : 1),
    quarter: String(release.precision === "quarter" ? release.quarter : 1),
  };
}

// Late research (after a cover download) may update only its original draft, using that draft's latest fields.
export function applyLateResearch(
  current: GameDraft | null,
  targetId: string,
  proposal: ResearchProposal,
  cover?: string,
): GameDraft | null {
  if (!current || current.id !== targetId) return current;
  return applyResearch(current, proposal, cover);
}
