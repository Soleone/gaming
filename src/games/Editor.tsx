import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GameForm } from "./GameForm";
import { ChoiceField } from "./ChoiceField";
import { createGameDraft, applyResearch, type GameDraft } from "./draft";
import type { ResearchProposal } from "./research";
import { gamesSchema, type Game } from "./model";

type Session = { games: Game[]; revision: string; token: string };

async function readSession(response: Response): Promise<Session> {
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string" ? data.error : "Could not save. Please try again.",
    );
  if (typeof data.revision !== "string" || typeof data.token !== "string")
    throw new Error("Invalid editor response. Restart the development server.");
  return { games: gamesSchema.parse(data.games), revision: data.revision, token: data.token };
}

export default function Editor({
  initialId,
  draft,
  onDraftChange,
  initialResearch,
  onBusyChange,
  onClose,
  onSaved,
}: {
  initialId: string | null;
  draft: GameDraft | null;
  onDraftChange: (draft: GameDraft) => void;
  initialResearch: { proposal: ResearchProposal; cover?: string } | null;
  onBusyChange: (busy: boolean) => void;
  onClose: () => void;
  onSaved: (games: Game[]) => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [selected, setSelected] = useState(initialId);
  const [baseDraft, setBaseDraft] = useState<GameDraft | null>(null);
  const dirty = Boolean(draft && baseDraft && JSON.stringify(draft) !== JSON.stringify(baseDraft));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/__dev/games", { signal: controller.signal })
      .then(readSession)
      .then((loaded) => {
        setSession(loaded);
        const game = loaded.games.find((game) => game.id === initialId) ?? null;
        setSelected(game?.id ?? null);
        const base = createGameDraft(game);
        setBaseDraft(base);
        onDraftChange(
          initialResearch
            ? {
                ...applyResearch(base, initialResearch.proposal),
                cover: initialResearch.cover ?? base.cover,
              }
            : base,
        );
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Could not load games.json.");
      });
    return () => controller.abort();
  }, [initialId, initialResearch, onDraftChange]);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const canDiscard = () => !dirty || window.confirm("Discard your unsaved game changes?");
  const choose = (id: string | null) => {
    if (busy || !canDiscard()) return;
    setSelected(id);
    const base = createGameDraft(session?.games.find((game) => game.id === id) ?? null);
    setBaseDraft(base);
    onDraftChange(base);
    setError("");
    setNotice("");
  };
  const close = () => {
    if (!busy && canDiscard()) onClose();
  };
  async function persist(games: Game[], nextId: string | null) {
    if (!session || busy) return;
    setBusy(true);
    onBusyChange(true);
    setError("");
    setNotice("");
    try {
      const saved = await readSession(
        await fetch("/__dev/games", {
          method: "PUT",
          headers: { "Content-Type": "application/json", "X-Game-Editor": session.token },
          body: JSON.stringify({ revision: session.revision, games }),
        }),
      );
      setSession(saved);
      setSelected(nextId);
      const base = createGameDraft(saved.games.find((game) => game.id === nextId) ?? null);
      setBaseDraft(base);
      onDraftChange(base);
      onSaved(saved.games);
      setNotice("Saved to games.json. Production updates on the next build.");
    } catch (error) {
      setError(
        error instanceof Error
          ? error.message
          : "Could not save games.json. Your changes are still in the form.",
      );
    } finally {
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <section
      aria-labelledby="editor-title"
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 py-8 sm:px-8"
    >
      <header className="flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <h1 id="editor-title" className="font-heading text-2xl font-semibold">
            Local collection editor
          </h1>
          <Button
            variant="ghost"
            size="icon"
            aria-label="Close editor"
            onClick={close}
            disabled={busy}
          >
            <X />
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Development only. Changes write to src/data/games.json on this computer.
        </p>
      </header>
      {error && (
        <Alert variant="destructive">
          <AlertTitle>Could not update the collection</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {notice && !dirty && (
        <Alert role="status">
          <AlertTitle>Collection saved</AlertTitle>
          <AlertDescription>{notice}</AlertDescription>
        </Alert>
      )}
      {!session || !draft ? (
        <p role="status" className="py-6 text-sm text-muted-foreground">
          {error
            ? "Close the editor and try again after fixing the problem."
            : "Reading games.json…"}
        </p>
      ) : (
        <div className="grid min-w-0 gap-6 sm:grid-cols-[11rem_1fr]">
          <div className="sm:hidden">
            <ChoiceField
              id="editor-game"
              label="Game to edit"
              value={selected ?? "__new"}
              onChange={(id) => choose(id === "__new" ? null : id)}
              disabled={busy}
              options={[
                { value: "__new", label: "New game" },
                ...session.games.map((game) => ({ value: game.id, label: game.title })),
              ]}
            />
          </div>
          <nav aria-label="Games to edit" className="hidden flex-col gap-1 sm:flex">
            <Button
              variant={selected === null ? "secondary" : "ghost"}
              onClick={() => choose(null)}
              disabled={busy}
            >
              <Plus data-icon="inline-start" />
              New game
            </Button>
            {session.games.map((game) => (
              <Button
                key={game.id}
                variant={selected === game.id ? "secondary" : "ghost"}
                onClick={() => choose(game.id)}
                disabled={busy}
                title={game.title}
              >
                <span className="truncate">{game.title}</span>
              </Button>
            ))}
          </nav>
          <GameForm
            key={`${selected ?? "new"}-${session.revision}`}
            game={session.games.find((game) => game.id === selected) ?? null}
            draft={draft}
            onChange={onDraftChange}
            busy={busy}
            onDirty={() => setNotice("")}
            onSave={(game) =>
              persist(
                selected === null
                  ? [...session.games, game]
                  : session.games.map((existing) => (existing.id === selected ? game : existing)),
                game.id,
              )
            }
            onDelete={() =>
              persist(
                session.games.filter((game) => game.id !== selected),
                null,
              )
            }
          />
        </div>
      )}
    </section>
  );
}
