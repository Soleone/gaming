import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vite-plus/test";
import { GameCard } from "./GameCard";
import { reviewColumns } from "./Review";
import type { Game } from "./model";

const emptyReview = {
  text: "",
  score: null,
  amazing: [],
  nice: [],
  questionable: [],
  terrible: [],
};
const game = (patch: Partial<Game>): Game => ({
  id: "requiem",
  title: "Resident Evil Requiem",
  cover: null,
  release: { precision: "day", year: 2026, month: 2, day: 27 },
  source: null,
  hype: 5,
  play: "played",
  review: emptyReview,
  ...patch,
});

it("review.card: names the link First impressions and the score so far while Started", () => {
  const html = renderToStaticMarkup(
    <GameCard game={game({ play: "started", review: { ...emptyReview, score: 7 } })} />,
  );
  expect(html).toContain("First impressions");
  expect(html).toContain("/ 10 so far");
  expect(html).toContain('aria-label="First impressions: 7 out of 10"');
});

it("review.card: offers the Review once played, and review to come with nothing to show", () => {
  const scored = renderToStaticMarkup(
    <GameCard game={game({ review: { ...emptyReview, score: 9 } })} />,
  );
  expect(scored).toContain("Review");
  expect(scored).not.toContain("so far");
  expect(scored).not.toContain("review to come");

  const written = renderToStaticMarkup(
    <GameCard game={game({ review: { ...emptyReview, text: "Tense." } })} />,
  );
  expect(written).toContain("Review");
  expect(written).not.toContain("out of 10");

  const blank = renderToStaticMarkup(<GameCard game={game({})} />);
  expect(blank).toContain("Played · review to come");
  expect(blank).not.toContain("Review");
});

it("review.card: makes the cover clickable only when there is a review to open", () => {
  const cover = "https://example.com/requiem.jpg";
  const reviewed = renderToStaticMarkup(
    <GameCard game={game({ cover, review: { ...emptyReview, score: 9 } })} />,
  );
  expect(reviewed).toMatch(/<img[^>]*class="[^"]*cursor-pointer/);
  const blank = renderToStaticMarkup(<GameCard game={game({ cover })} />);
  expect(blank).not.toContain("cursor-pointer");
});

it("review.open: puts Amazing and Nice under the good, the rest under the bad, minus empty lists", () => {
  expect(
    reviewColumns({
      ...emptyReview,
      amazing: ["Zombie variety"],
      questionable: ["Boss-heavy finale"],
      terrible: ["Inventory juggling"],
    }),
  ).toEqual([
    { title: "The good", verdicts: ["amazing"] },
    { title: "The bad", verdicts: ["questionable", "terrible"] },
  ]);
  expect(reviewColumns({ ...emptyReview, nice: ["Checkpoints"] })).toEqual([
    { title: "The good", verdicts: ["nice"] },
  ]);
  expect(reviewColumns(emptyReview)).toEqual([]);
});

it("review.tone: colours the card score gold from 9, plain at 7 and 8, red below", () => {
  const scoreClass = (score: number) =>
    renderToStaticMarkup(<GameCard game={game({ review: { ...emptyReview, score } })} />).match(
      /<strong class="([^"]*)">\d+<\/strong>/,
    )?.[1];
  expect(scoreClass(10)).toBe("text-score-gold");
  expect(scoreClass(9)).toBe("text-score-gold");
  expect(scoreClass(8)).toBe("text-foreground");
  expect(scoreClass(7)).toBe("text-foreground");
  expect(scoreClass(6)).toBe("text-destructive");
  expect(scoreClass(5)).toBe("text-destructive");
});

it("list.keyboard: makes each card one tab stop only when an editor is available", () => {
  const editable = renderToStaticMarkup(
    <GameCard game={game({ review: { ...emptyReview, score: 9 } })} onEdit={() => {}} />,
  );
  expect(editable.match(/<article[^>]*tabindex="0"/g)).toHaveLength(1);
  expect(editable.match(/tabindex="-1"/g)).toHaveLength(3);
  const readOnly = renderToStaticMarkup(
    <GameCard game={game({ review: { ...emptyReview, score: 9 } })} />,
  );
  expect(readOnly).not.toContain("tabindex");
});
