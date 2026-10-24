import { useEffect, useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { GameForm } from "./GameForm";
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
  onSave: (game: Game) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  onClose: () => void;
}) {
  const [saveError, setSaveError] = useState("");
  const [notice, setNotice] = useState("");
  const error = saveError || loadError;
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
  const close = () => {
    if (!busy) onClose();
  };
  // Esc goes back, unless it was meant for an open dialog or dropdown.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented || busy) return;
      if (document.querySelector('[role="dialog"], [role="listbox"], [role="menu"]')) return;
      onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [busy, onClose]);
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
      className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-5 pb-12 sm:px-8"
    >
      {!session || !draft ? (
        <>
          <header className="flex items-center gap-3 pt-6">
            <Button variant="ghost" size="icon" aria-label="Close editor" onClick={close}>
              <ArrowLeft />
            </Button>
            <h1 id="editor-title" className="font-heading text-xl font-semibold">
              Local collection editor
            </h1>
          </header>
          {error && (
            <Alert variant="destructive">
              <AlertTitle>Could not update the collection</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <p role="status" className="text-sm text-muted-foreground">
            {error
              ? "Close the editor and try again after fixing the problem."
              : "Reading games.json…"}
          </p>
        </>
      ) : (
        <GameForm
          key={`${selected ?? "new"}-${session.revision}`}
          game={session.games.find((game) => game.id === selected) ?? null}
          draft={draft}
          onChange={onChange}
          busy={busy}
          onDirty={() => setNotice("")}
          onClose={close}
          saveError={error}
          notice={dirty ? "" : notice}
          onSave={(game) => persist(() => onSave(game))}
          onDelete={() => persist(() => (selected ? onDelete(selected) : Promise.resolve()))}
        />
      )}
    </section>
  );
}
