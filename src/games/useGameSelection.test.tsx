import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vite-plus/test";
import { GameCard } from "./GameCard";
import type { Game } from "./model";

const game = {
  id: "hades",
  title: "Hades",
  cover: null,
  release: { precision: "unknown" },
  source: null,
  hype: null,
  play: "not_played",
  review: null,
} as Game;

it("list.keyboard: marks the selected card and tags every card for navigation", () => {
  const selected = renderToStaticMarkup(<GameCard game={game} selected />);
  expect(selected).toContain('data-game-id="hades"');
  expect(selected).toContain("data-selected");
  const plain = renderToStaticMarkup(<GameCard game={game} />);
  expect(plain).not.toContain("data-selected");
  expect(plain).not.toContain("outline-ring");
});
