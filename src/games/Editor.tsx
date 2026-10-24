import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GameForm } from "./GameForm";
import { ChoiceField } from "./ChoiceField";
import type { CollectionSession } from "./collection";
import type { GameDraft } from "./draft";
import type { Game } from "./model";

export default function Editor({
  session,
  draft,
  dirty,
  loadError,
  busy,
  onChange,
  onChoose,
  onSave,
  onDelete,
  onClose,
}: {
  session: CollectionSession | null;
  draft: GameDraft | null;
  dirty: boolean;
  loadError: string;
  busy: boolean;
  onChange: (draft: GameDraft) => void;
  onChoose: (id: string | null) => void;
  onSave: (game: Game) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const error = saveError || loadError;
  const loaded = Boolean(session && draft);
  const selected = draft && session?.games.some((game) => game.id === draft.id) ? draft.id : null;
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  const choose = (id: string | null) => {
    if (busy) return;
    onChoose(id);
    setSaveError("");
    setNotice("");
  };
  const close = () => {
    if (!busy) onClose();
  };
  async function persist(save: () => Promise<void>) {
    setSaveError("");
    setNotice("");
    try {
      await save();
      setNotice("Saved to games.json. Production updates on the next build.");
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "Could not save games.json. Your changes are still in the form.",
      );
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
      {error && !loaded && (
        <Alert variant="destructive">
          <AlertTitle>Could not update the collection</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
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
            onChange={onChange}
            busy={busy}
            onDirty={() => setNotice("")}
            saveError={error}
            notice={dirty ? "" : notice}
            onSave={(game) => persist(() => onSave(game))}
            onDelete={() => persist(() => (selected ? onDelete(selected) : Promise.resolve()))}
          />
        </div>
      )}
    </section>
  );
}
