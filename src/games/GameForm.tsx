import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceField } from "./ChoiceField";
import { parseGameDraft, type GameDraft } from "./draft";
import { MONTHS, type Game } from "./model";

export function GameForm({
  game,
  draft,
  onChange,
  busy,
  onSave,
  onDelete,
  onDirty,
  saveError,
  notice,
}: {
  game: Game | null;
  draft: GameDraft;
  onChange: (draft: GameDraft) => void;
  busy: boolean;
  onSave: (game: Game) => Promise<void>;
  onDelete: () => Promise<void>;
  onDirty: () => void;
  saveError: string;
  notice: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);

  function edit<K extends keyof GameDraft>(key: K, value: GameDraft[K]) {
    onChange({ ...draft, [key]: value });
    onDirty();
  }
  const input = (key: keyof GameDraft) => ({
    name: key,
    value: draft[key],
    onChange: (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      edit(key, event.target.value),
  });

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const parsed = parseGameDraft(draft);
    setInvalid(!parsed.success);
    if (!parsed.success) {
      setError(
        parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`).join(" "),
      );
      return;
    }
    setError("");
    await onSave(parsed.data);
  }

  // Enter submits from single-line inputs natively; Ctrl/Cmd+Enter submits from anywhere, including the review.
  function submitShortcut(event: KeyboardEvent<HTMLFormElement>) {
    if (event.key !== "Enter" || !(event.ctrlKey || event.metaKey)) return;
    event.preventDefault();
    if (!busy) formRef.current?.requestSubmit();
  }

  const alert = error || saveError;
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <form
        ref={formRef}
        className="flex min-w-0 flex-col gap-6"
        onKeyDown={submitShortcut}
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <div className="sticky top-0 z-10 flex flex-col gap-3 bg-background py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="min-w-0 truncate font-heading text-lg font-medium">
              {game ? game.title : "New game"}
            </h2>
            <div className="flex items-center gap-2">
              {game && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setRemoving(true)}
                  disabled={busy}
                >
                  <Trash2 data-icon="inline-start" />
                  Remove
                </Button>
              )}
              <Button type="submit" disabled={busy}>
                <Save data-icon="inline-start" />
                {busy ? "Saving…" : "Save game"}
              </Button>
            </div>
          </div>
          {alert && (
            <Alert variant="destructive" role="alert">
              <AlertTitle>
                {error ? "Check the game details" : "Could not update the collection"}
              </AlertTitle>
              <AlertDescription>{alert}</AlertDescription>
            </Alert>
          )}
          {notice && !alert && (
            <Alert role="status">
              <AlertTitle>Collection saved</AlertTitle>
              <AlertDescription>{notice}</AlertDescription>
            </Alert>
          )}
        </div>
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
          <legend className="sr-only">{game ? `Edit ${game.title}` : "New game"}</legend>
          <FieldGroup>
            <Field data-invalid={invalid}>
              <FieldLabel htmlFor="title">Title</FieldLabel>
              <Input
                autoFocus
                id="title"
                {...input("title")}
                required
                maxLength={160}
                aria-invalid={invalid}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="cover">Cover image</FieldLabel>
              <Input
                id="cover"
                {...input("cover")}
                placeholder="https://… or /covers/game.jpg"
                maxLength={2000}
              />
              <FieldDescription>
                Leave blank for a placeholder. Local artwork lives in public/covers/.
              </FieldDescription>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <ChoiceField
                id="precision"
                label="Release precision"
                value={draft.precision}
                onChange={(value) => edit("precision", value as GameDraft["precision"])}
                options={[
                  { value: "day", label: "Exact day" },
                  { value: "month", label: "Month" },
                  { value: "quarter", label: "Quarter" },
                  { value: "year", label: "Year only" },
                  { value: "unknown", label: "Unknown" },
                ]}
              />
              <Field>
                <FieldLabel htmlFor="release-year">
                  {draft.precision === "unknown" ? "Expected year (optional)" : "Release year"}
                </FieldLabel>
                <Input
                  id="release-year"
                  {...input("year")}
                  type="number"
                  min={1970}
                  max={2200}
                  step={1}
                  required={draft.precision !== "unknown"}
                />
              </Field>
            </div>
            {(draft.precision === "month" || draft.precision === "day") && (
              <div className="grid grid-cols-2 gap-4">
                <ChoiceField
                  id="release-month"
                  label="Release month"
                  value={draft.month}
                  onChange={(value) => edit("month", value)}
                  options={MONTHS.map((label, index) => ({ value: String(index + 1), label }))}
                />
                {draft.precision === "day" && (
                  <Field>
                    <FieldLabel htmlFor="release-day">Day</FieldLabel>
                    <Input
                      id="release-day"
                      {...input("day")}
                      type="number"
                      min={1}
                      max={31}
                      step={1}
                      required
                    />
                  </Field>
                )}
              </div>
            )}
            {draft.precision === "quarter" && (
              <ChoiceField
                id="release-quarter"
                label="Release quarter"
                value={draft.quarter}
                onChange={(value) => edit("quarter", value)}
                options={[1, 2, 3, 4].map((value) => ({
                  value: String(value),
                  label: `Q${value}`,
                }))}
              />
            )}
            <Field>
              <FieldLabel htmlFor="source">Release source</FieldLabel>
              <Input
                id="source"
                {...input("source")}
                type="url"
                placeholder="https://publisher.com/…"
                maxLength={2000}
              />
              <FieldDescription>
                Optional link to the announcement. Review researched dates before saving.
              </FieldDescription>
            </Field>
            <div className="grid grid-cols-2 gap-4">
              <ChoiceField
                id="hype"
                label="Hype"
                value={draft.hype}
                onChange={(value) => edit("hype", value)}
                options={[
                  { value: "unrated", label: "Not rated" },
                  { value: "1", label: "1 · Curious" },
                  { value: "2", label: "2 · Interested" },
                  { value: "3", label: "3 · Looking forward" },
                  { value: "4", label: "4 · Very excited" },
                  { value: "5", label: "5 · Can’t wait" },
                ]}
              />
              <ChoiceField
                id="played"
                label="Play status"
                value={draft.played}
                onChange={(value) => edit("played", value)}
                options={[
                  { value: "no", label: "Not played" },
                  { value: "yes", label: "Played" },
                ]}
              />
            </div>
            <Field data-disabled={draft.played !== "yes"}>
              <FieldLabel htmlFor="score">Your score (1–10)</FieldLabel>
              <Input
                id="score"
                {...input("score")}
                type="number"
                min={1}
                max={10}
                step={1}
                disabled={draft.played !== "yes"}
                placeholder="Not scored"
              />
            </Field>
            <Field data-disabled={draft.played !== "yes"}>
              <FieldLabel htmlFor="review">Short review</FieldLabel>
              <Textarea
                id="review"
                {...input("review")}
                rows={3}
                maxLength={1000}
                disabled={draft.played !== "yes"}
                placeholder="What stayed with you?"
              />
              <FieldDescription>
                Up to 1,000 characters. Switching to “Not played” clears the review when saved.
              </FieldDescription>
            </Field>
          </FieldGroup>
        </fieldset>
      </form>
      <Dialog open={removing} onOpenChange={setRemoving}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove {game?.title}?</DialogTitle>
            <DialogDescription>
              This deletes the game from games.json. It can't be undone from the editor.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRemoving(false)}>
              Keep game
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => {
                setRemoving(false);
                void onDelete();
              }}
              disabled={busy}
            >
              Remove game
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
