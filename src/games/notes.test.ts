import { expect, it } from "vite-plus/test";
import { blankNote, importNotes, parseSharedNotes, shareNotes } from "./notes";
import type { Game } from "./model";

const review = { text: "", score: null, amazing: [], nice: [], questionable: [], terrible: [] };
const hades: Game = {
  id: "hades",
  title: "Hades II",
  cover: null,
  release: { precision: "year", year: 2026 },
  source: null,
  hype: 5,
  play: "started",
  review: { ...review, text: "Gorgeous.", nice: ["Music"] },
};
const silksong: Game = {
  ...hades,
  id: "silksong",
  title: "Silksong",
  play: "not_played",
  review: null,
};

it("notes.export: copies every game's notes with points split one per line", () => {
  const shared = shareNotes(
    {
      hades: {
        ...blankNote,
        review: " Tight. ",
        score: "8",
        play: "played",
        nice: "- Music\n\n• Boons",
      },
      gone: { ...blankNote, terrible: "Crashes", score: "11" },
    },
    [hades],
  );
  expect(shared).toEqual([
    {
      id: "hades",
      title: "Hades II",
      play: "played",
      score: 8,
      text: "Tight.",
      amazing: [],
      nice: ["Music", "Boons"],
      questionable: [],
      terrible: [],
    },
    {
      id: "gone",
      title: "gone",
      play: null,
      score: null,
      text: "",
      amazing: [],
      nice: [],
      questionable: [],
      terrible: ["Crashes"],
    },
  ]);
  expect(parseSharedNotes(JSON.stringify(shared))).toEqual(shared);
  expect(parseSharedNotes("not json")).toBeNull();
  expect(parseSharedNotes("[]")).toBeNull();
});

it("notes.import: adds the write-up and new points, takes the score and status, and changes nothing twice", () => {
  const notes = shareNotes(
    { hades: { ...blankNote, review: "Tight.", score: "8", play: "played", nice: "Music\nBoons" } },
    [hades],
  );
  const once = importNotes([hades, silksong], notes);
  expect(once.results.map((result) => result.kind)).toEqual(["merged"]);
  expect(once.games).toEqual([
    {
      ...hades,
      play: "played",
      review: { ...review, text: "Gorgeous.\n\nTight.", score: 8, nice: ["Music", "Boons"] },
    },
    silksong,
  ]);
  expect(importNotes(once.games, notes).games).toEqual(once.games);
});

it("notes.import: starts a Not played game and skips unknown or invalid games", () => {
  const notes = shareNotes(
    {
      silksong: { ...blankNote, amazing: "Bosses" },
      gone: { ...blankNote, nice: "Anything" },
      hades: { ...blankNote, review: "x".repeat(1000) },
    },
    [hades, silksong],
  );
  const { results, games } = importNotes([hades, silksong], notes);
  expect(results.map((result) => result.kind)).toEqual(["merged", "missing", "invalid"]);
  expect(games).toEqual([
    hades,
    { ...silksong, play: "started", review: { ...review, amazing: ["Bosses"] } },
  ]);
});
