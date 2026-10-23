import { describe, expect, it } from "vite-plus/test";
import { applyLateResearch, applyResearch, createGameDraft, parseGameDraft } from "./draft";
import { researchTarget, upsertGame } from "./collection";
import { researchProposalSchema } from "./research";
import type { Game } from "./model";

const game: Game = {
  id: "my-game",
  title: "Old title",
  cover: "/covers/mine.jpg",
  release: { precision: "unknown", year: null },
  source: null,
  hype: 4,
  review: { text: "My own opinion", score: 9 },
};
const proposal = researchProposalSchema.parse({
  title: "Verified title",
  release: { precision: "quarter", year: 2027, quarter: 2 },
  source: "https://publisher.example/game",
  summary: "Only the quarter was announced.",
  covers: [],
});

describe("agent drafts", () => {
  it("agent.cover: late downloads preserve edits made while downloading", () => {
    const current = { ...createGameDraft(game), hype: "5" };
    expect(applyLateResearch(current, game.id, proposal, "/covers/new.webp")).toEqual({
      ...applyResearch(current, proposal),
      cover: "/covers/new.webp",
    });
  });
  it("agent.cover: late downloads cannot replace a switched or closed draft", () => {
    const current = createGameDraft({ ...game, id: "another-game" });
    expect(applyLateResearch(current, game.id, proposal, "/covers/new.webp")).toBe(current);
    expect(applyLateResearch(null, game.id, proposal, "/covers/new.webp")).toBeNull();
  });
  it("agent.save: updates the collection game with a matching title instead of duplicating it", () => {
    const games = [{ ...game, title: "Hollow Knight: Silksong™" }];
    const target = researchTarget(games, "hollow knight silksong", null);
    expect(target).toEqual({ kind: "game", game: games[0] });
    expect(upsertGame(games, { ...game, hype: 5 })).toEqual([{ ...game, hype: 5 }]);
    expect(upsertGame(games, { ...game, id: "other" })).toHaveLength(2);
  });
  it("agent.save: targets the open draft only when it is that game or still unsaved", () => {
    const saved = createGameDraft(game);
    const unsaved = createGameDraft(null);
    expect(researchTarget([game], "Old title", saved)).toEqual({ kind: "draft" });
    expect(researchTarget([game], "Something else", saved)).toEqual({ kind: "new" });
    expect(researchTarget([game], "Something else", unsaved)).toEqual({ kind: "draft" });
    expect(researchTarget([game], "Old title", unsaved)).toEqual({ kind: "game", game });
  });
  it("agent.proposal: applies sourced facts without changing identity, cover, or personal opinions", () => {
    const draft = createGameDraft(game);
    const updated = applyResearch(draft, proposal);
    expect(parseGameDraft(updated).data).toEqual({
      ...game,
      title: proposal.title,
      release: proposal.release,
      source: proposal.source,
    });
    expect(draft.title).toBe("Old title");
  });
  it("agent.proposal: can populate a new game while preserving unknown precision and unrated opinions", () => {
    const draft = applyResearch(createGameDraft(null), {
      ...proposal,
      release: { precision: "unknown", year: null },
    });
    const result = parseGameDraft(draft);
    expect(result.success).toBe(true);
    expect(result.data).toMatchObject({
      title: proposal.title,
      release: { precision: "unknown", year: null },
      hype: null,
      review: null,
      cover: null,
    });
  });
  it("agent.proposal: rejects invented opinion fields, impossible dates, and unsafe cover URLs", () => {
    expect(researchProposalSchema.safeParse({ ...proposal, hype: 5 }).success).toBe(false);
    expect(
      researchProposalSchema.safeParse({
        ...proposal,
        release: { precision: "day", year: 2027, month: 2, day: 30 },
      }).success,
    ).toBe(false);
    expect(
      researchProposalSchema.safeParse({
        ...proposal,
        covers: [{ url: "file:///etc/passwd", source: proposal.source, label: "Cover" }],
      }).success,
    ).toBe(false);
  });
  it("editor.draft: keeps invalid numeric input in the draft and validates only on save", () => {
    const draft = {
      ...createGameDraft(game),
      precision: "day" as const,
      year: "2027",
      month: "2",
      day: "30",
    };
    expect(parseGameDraft(draft).success).toBe(false);
    expect(draft.day).toBe("30");
    expect(parseGameDraft({ ...draft, day: "28", played: "no" }).data?.review).toBeNull();
  });
});
