import { useState } from "react";
import { ClipboardPaste } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { loadCollection, saveCollection } from "./collection";
import { playLabels, verdicts, type Game } from "./model";
import { importNotes, parseSharedNotes, type NoteImport } from "./notes";

function summary(result: NoteImport, games: Game[]) {
  if (result.kind === "missing") return "Not in the collection, skipped";
  if (result.kind === "invalid") return `Skipped: ${result.error}`;
  const { note } = result;
  const points = verdicts.reduce((total, verdict) => total + note[verdict].length, 0);
  return [
    note.text && "write-up",
    points && `${points} ${points === 1 ? "point" : "points"}`,
    note.score !== null && `score ${note.score}`,
    games.find((game) => game.id === result.game.id)?.play !== result.game.play &&
      `now ${playLabels[result.game.play]}`,
  ]
    .filter(Boolean)
    .join(", ");
}

// Development only: merges notes copied from the production site straight into games.json.
export default function NotesImport({
  games,
  onSaved,
}: {
  games: Game[];
  onSaved: (games: Game[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const notes = text.trim() ? parseSharedNotes(text) : null;
  const preview = notes ? importNotes(games, notes).results : [];
  const mergeable = preview.filter((result) => result.kind === "merged").length;

  async function merge() {
    if (!notes) return;
    setBusy(true);
    setError("");
    try {
      const current = await loadCollection();
      const saved = await saveCollection(current, importNotes(current.games, notes).games);
      onSaved(saved.games);
      setText("");
      setOpen(false);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save games.json.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Button variant="outline" onClick={() => setOpen(true)}>
        <ClipboardPaste data-icon="inline-start" />
        Import notes
      </Button>
      <Dialog open={open} onOpenChange={(next) => !busy && setOpen(next)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Import review notes</DialogTitle>
            <DialogDescription>
              Paste the notes copied on the live site. They go straight into games.json.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="notes-import">Notes</FieldLabel>
            <Textarea
              id="notes-import"
              value={text}
              onChange={(event) => setText(event.target.value)}
              rows={6}
              placeholder='[{ "id": "…", "title": "…", … }]'
              disabled={busy}
            />
          </Field>
          {text.trim() && !notes && (
            <Alert variant="destructive">
              <AlertTitle>These aren't review notes</AlertTitle>
              <AlertDescription>Copy them again with Copy notes on the live site.</AlertDescription>
            </Alert>
          )}
          {preview.length > 0 && (
            <ul className="flex flex-col gap-2 text-sm">
              {preview.map((result) => (
                <li key={result.note.id} className="flex flex-col">
                  <span className="font-medium">{result.note.title}</span>
                  <span className="text-muted-foreground">{summary(result, games)}</span>
                </li>
              ))}
            </ul>
          )}
          {error && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>Could not update the collection</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void merge()} disabled={busy || mergeable === 0}>
              {busy ? "Saving…" : `Add notes to ${mergeable} ${mergeable === 1 ? "game" : "games"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
