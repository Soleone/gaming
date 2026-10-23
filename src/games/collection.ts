import type { GameDraft } from "./draft";
import { gamesSchema, type Game } from "./model";

export type CollectionSession = { games: Game[]; revision: string; token: string };

async function readSession(response: Response): Promise<CollectionSession> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not save. Please try again.",
    );
  if (typeof data.revision !== "string" || typeof data.token !== "string")
    throw new Error("Invalid editor response. Restart the development server.");
  return { games: gamesSchema.parse(data.games), revision: data.revision, token: data.token };
}

export async function loadCollection(signal?: AbortSignal) {
  return readSession(await fetch("/__dev/games", { signal }));
}

// keepCover protects the open draft's downloaded cover from the server's post-save cleanup.
export async function saveCollection(
  session: CollectionSession,
  games: Game[],
  keepCover?: string,
) {
  return readSession(
    await fetch("/__dev/games", {
      method: "PUT",
      headers: { "Content-Type": "application/json", "X-Game-Editor": session.token },
      body: JSON.stringify({ revision: session.revision, games, keepCover }),
    }),
  );
}

const titleKey = (title: string) =>
  title
    .replace(/[™®©]/g, "")
    .normalize("NFKD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();

export function findGame(games: Game[], title: string) {
  const key = titleKey(title);
  return games.find((game) => titleKey(game.title) === key) ?? null;
}

export type ResearchTarget = { kind: "draft" } | { kind: "game"; game: Game } | { kind: "new" };

// A researched game updates its collection match, else the open draft if that is still unsaved.
export function researchTarget(
  games: Game[],
  title: string,
  draft: GameDraft | null,
): ResearchTarget {
  const match = findGame(games, title);
  if (draft && (match ? match.id === draft.id : !games.some((game) => game.id === draft.id)))
    return { kind: "draft" };
  return match ? { kind: "game", game: match } : { kind: "new" };
}

export const upsertGame = (games: Game[], game: Game) =>
  games.some((existing) => existing.id === game.id)
    ? games.map((existing) => (existing.id === game.id ? game : existing))
    : [...games, game];
