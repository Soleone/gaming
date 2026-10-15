import { useEffect, useState } from "react";
import { Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { GameForm } from "./GameForm";
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
  onClose,
  onSaved,
}: {
  initialId: string | null;
  onClose: () => void;
  onSaved: (games: Game[]) => void;
}) {
  const [session, setSession] = useState<Session | null>(null);
  const [selected, setSelected] = useState(initialId);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  useEffect(() => {
    const controller = new AbortController();
    void fetch("/__dev/games", { signal: controller.signal })
      .then(readSession)
      .then(setSession)
      .catch((error: unknown) => {
        if (!controller.signal.aborted)
          setError(error instanceof Error ? error.message : "Could not load games.json.");
      });
    return () => controller.abort();
  }, []);
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
    setDirty(false);
    setError("");
    setNotice("");
  };
  const close = () => {
    if (!busy && canDiscard()) onClose();
  };
  async function persist(games: Game[], nextId: string | null) {
    if (!session || busy) return;
    setBusy(true);
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
      setDirty(false);
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
    }
  }
  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-3xl" showCloseButton={false}>
        <DialogHeader>
          <div className="flex items-center justify-between gap-3">
            <DialogTitle>Local collection editor</DialogTitle>
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
          <DialogDescription>
            Development only. Changes write to src/data/games.json on this computer.
          </DialogDescription>
        </DialogHeader>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Could not update the collection</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        {notice && (
          <Alert role="status">
            <AlertTitle>Collection saved</AlertTitle>
            <AlertDescription>{notice}</AlertDescription>
          </Alert>
        )}
        {!session ? (
          <p role="status" className="py-6 text-sm text-muted-foreground">
            {error
              ? "Close the editor and try again after fixing the problem."
              : "Reading games.json…"}
          </p>
        ) : (
          <div className="grid min-w-0 gap-6 sm:grid-cols-[11rem_1fr]">
            <nav aria-label="Games to edit" className="flex flex-col gap-1">
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
              busy={busy}
              onDirty={() => {
                setDirty(true);
                setNotice("");
              }}
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
      </DialogContent>
    </Dialog>
  );
}
