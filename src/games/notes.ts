import { z } from "zod";
import { notesFrom, type GameDraft } from "./draft";
import { gameSchema, playStatuses, verdicts, type Game, type Verdict } from "./model";

/** What a visitor jots down for one game, as typed. A blank play or score keeps the game's own. */
export type Note = Pick<GameDraft, "review" | "score" | "play" | Verdict>;

export const blankNote: Note = {
  review: "",
  score: "",
  play: "",
  amazing: "",
  nice: "",
  questionable: "",
  terrible: "",
};

export const isBlankNote = (note: Note) =>
  Object.values(note).every((value) => value.trim() === "");

const NOTES_KEY = "gaming.notes";
const MODE_KEY = "gaming.notes-mode";

const storedNotes = z.record(
  z.string(),
  z.object(Object.fromEntries(Object.keys(blankNote).map((key) => [key, z.string()]))),
);

// Storage can be missing or blocked (private windows, previews); notes then last for the visit only.
export function readNotes(): Record<string, Note> {
  try {
    const parsed = storedNotes.safeParse(JSON.parse(localStorage.getItem(NOTES_KEY) ?? "{}"));
    return parsed.success ? (parsed.data as Record<string, Note>) : {};
  } catch {
    return {};
  }
}

export function writeNotes(notes: Record<string, Note>) {
  try {
    if (Object.keys(notes).length) localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
    else localStorage.removeItem(NOTES_KEY);
  } catch {
    // Kept in memory for this visit.
  }
}

export function readNotesMode(): boolean {
  try {
    return localStorage.getItem(MODE_KEY) === "on";
  } catch {
    return false;
  }
}

export function writeNotesMode(on: boolean) {
  try {
    if (on) localStorage.setItem(MODE_KEY, "on");
    else localStorage.removeItem(MODE_KEY);
  } catch {
    // Notes mode lasts for this visit.
  }
}

const sharedNoteSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    play: z.enum(playStatuses).nullable(),
    score: z.number().int().min(1).max(10).nullable(),
    text: z.string(),
    ...Object.fromEntries(verdicts.map((verdict) => [verdict, z.array(z.string())])),
  })
  .strict();
type SharedNote = {
  id: string;
  title: string;
  play: Game["play"] | null;
  score: number | null;
  text: string;
} & Record<Verdict, string[]>;

/** The notes as copied out of the browser: one entry per game, points one per list item. */
export function shareNotes(notes: Record<string, Note>, games: Game[]): SharedNote[] {
  return Object.entries(notes).map(([id, note]) => {
    const score = Number(note.score);
    return {
      id,
      title: games.find((game) => game.id === id)?.title ?? id,
      play: playStatuses.find((status) => status === note.play) ?? null,
      score:
        note.score.trim() !== "" && Number.isInteger(score) && score >= 1 && score <= 10
          ? score
          : null,
      text: note.review.trim(),
      ...(Object.fromEntries(
        verdicts.map((verdict) => [verdict, notesFrom(note[verdict])]),
      ) as Record<Verdict, string[]>),
    };
  });
}

export function parseSharedNotes(text: string): SharedNote[] | null {
  try {
    const parsed = z.array(sharedNoteSchema).min(1).safeParse(JSON.parse(text));
    return parsed.success ? (parsed.data as SharedNote[]) : null;
  } catch {
    return null;
  }
}

// Adds a note to the game's review: the write-up goes after the current one, new points after
// the current ones. Anything already there is not added again, so importing twice changes nothing.
function applyNote(game: Game, note: SharedNote): Game {
  const review = game.review ?? {
    text: "",
    score: null,
    amazing: [],
    nice: [],
    questionable: [],
    terrible: [],
  };
  return {
    ...game,
    play: note.play ?? (game.play === "not_played" ? "started" : game.play),
    review: {
      ...review,
      text:
        !note.text || review.text.includes(note.text)
          ? review.text
          : [review.text, note.text].filter(Boolean).join("\n\n"),
      score: note.score ?? review.score,
      ...Object.fromEntries(
        verdicts.map((verdict) => [
          verdict,
          [
            ...review[verdict],
            ...note[verdict].filter((point) => !review[verdict].includes(point)),
          ],
        ]),
      ),
    },
  };
}

export type NoteImport =
  | { note: SharedNote; kind: "merged"; game: Game }
  | { note: SharedNote; kind: "missing" }
  | { note: SharedNote; kind: "invalid"; error: string };

/** Merges each note into its game by id. Notes for unknown games, or that would break a game, are left out. */
export function importNotes(games: Game[], notes: SharedNote[]) {
  const results = notes.map((note): NoteImport => {
    const game = games.find((existing) => existing.id === note.id);
    if (!game) return { note, kind: "missing" };
    const parsed = gameSchema.safeParse(applyNote(game, note));
    return parsed.success
      ? { note, kind: "merged", game: parsed.data }
      : {
          note,
          kind: "invalid",
          error: parsed.error.issues.map((issue) => issue.message).join(" "),
        };
  });
  const merged = new Map(
    results.flatMap((result) => (result.kind === "merged" ? [[result.game.id, result.game]] : [])),
  );
  return { results, games: games.map((game) => merged.get(game.id) ?? game) };
}
