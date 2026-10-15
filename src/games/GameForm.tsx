import { useState, type FormEvent } from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceField } from "./ChoiceField";
import { gameSchema, MONTHS, type Game } from "./model";

const currentYear = new Date().getFullYear();

export function GameForm({
  game,
  busy,
  onSave,
  onDelete,
  onDirty,
}: {
  game: Game | null;
  busy: boolean;
  onSave: (game: Game) => Promise<void>;
  onDelete: () => Promise<void>;
  onDirty: () => void;
}) {
  const [precision, setPrecision] = useState(game?.release.precision ?? "unknown");
  const [month, setMonth] = useState(
    String(game && "month" in game.release ? game.release.month : 1),
  );
  const [quarter, setQuarter] = useState(
    String(game?.release.precision === "quarter" ? game.release.quarter : 1),
  );
  const [hype, setHype] = useState(String(game?.hype ?? "unrated"));
  const [played, setPlayed] = useState(game?.review ? "yes" : "no");
  const [invalid, setInvalid] = useState(false);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(false);
  const choose = (update: (value: string) => void) => (value: string) => {
    update(value);
    onDirty();
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const text = (key: string) => {
      const value = data.get(key);
      return typeof value === "string" ? value.trim() : "";
    };
    const year = text("release-year") === "" ? null : Number(text("release-year"));
    const release = {
      precision,
      year,
      ...(precision === "day" || precision === "month" ? { month: Number(month) } : {}),
      ...(precision === "day" ? { day: Number(text("release-day")) } : {}),
      ...(precision === "quarter" ? { quarter: Number(quarter) } : {}),
    };
    const parsed = gameSchema.safeParse({
      id: game?.id ?? crypto.randomUUID(),
      title: text("title"),
      cover: text("cover") || null,
      release,
      source: text("source") || null,
      hype: hype === "unrated" ? null : Number(hype),
      review:
        played === "yes"
          ? { text: text("review"), score: text("score") === "" ? null : Number(text("score")) }
          : null,
    });
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

  return (
    <form
      onSubmit={(event) => {
        void submit(event);
      }}
      onChange={onDirty}
    >
      <fieldset disabled={busy} className="flex min-w-0 flex-col gap-6">
        <legend className="sr-only">{game ? `Edit ${game.title}` : "New game"}</legend>
        <FieldGroup>
          <Field data-invalid={invalid}>
            <FieldLabel htmlFor="title">Title</FieldLabel>
            <Input
              autoFocus
              id="title"
              name="title"
              defaultValue={game?.title ?? ""}
              required
              maxLength={160}
              aria-invalid={invalid}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="cover">Cover image</FieldLabel>
            <Input
              id="cover"
              name="cover"
              defaultValue={game?.cover ?? ""}
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
              value={precision}
              onChange={choose((value) => setPrecision(value as Game["release"]["precision"]))}
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
                {precision === "unknown" ? "Expected year (optional)" : "Release year"}
              </FieldLabel>
              <Input
                id="release-year"
                name="release-year"
                type="number"
                min={1970}
                max={2200}
                step={1}
                required={precision !== "unknown"}
                defaultValue={game ? (game.release.year ?? "") : currentYear}
              />
            </Field>
          </div>
          {(precision === "month" || precision === "day") && (
            <div className="grid grid-cols-2 gap-4">
              <ChoiceField
                id="release-month"
                label="Release month"
                value={month}
                onChange={choose(setMonth)}
                options={MONTHS.map((label, index) => ({ value: String(index + 1), label }))}
              />
              {precision === "day" && (
                <Field>
                  <FieldLabel htmlFor="release-day">Day</FieldLabel>
                  <Input
                    id="release-day"
                    name="release-day"
                    type="number"
                    min={1}
                    max={31}
                    step={1}
                    required
                    defaultValue={game?.release.precision === "day" ? game.release.day : 1}
                  />
                </Field>
              )}
            </div>
          )}
          {precision === "quarter" && (
            <ChoiceField
              id="release-quarter"
              label="Release quarter"
              value={quarter}
              onChange={choose(setQuarter)}
              options={[1, 2, 3, 4].map((value) => ({ value: String(value), label: `Q${value}` }))}
            />
          )}
          <Field>
            <FieldLabel htmlFor="source">Release source</FieldLabel>
            <Input
              id="source"
              name="source"
              type="url"
              defaultValue={game?.source ?? ""}
              placeholder="https://publisher.com/…"
              maxLength={2000}
            />
            <FieldDescription>
              Optional link to the announcement. Dates are maintained manually.
            </FieldDescription>
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <ChoiceField
              id="hype"
              label="Hype"
              value={hype}
              onChange={choose(setHype)}
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
              value={played}
              onChange={choose(setPlayed)}
              options={[
                { value: "no", label: "Not played" },
                { value: "yes", label: "Played" },
              ]}
            />
          </div>
          <Field data-disabled={played !== "yes"}>
            <FieldLabel htmlFor="score">Your score (1–10)</FieldLabel>
            <Input
              id="score"
              name="score"
              type="number"
              min={1}
              max={10}
              step={1}
              disabled={played !== "yes"}
              defaultValue={game?.review?.score ?? ""}
              placeholder="Not scored"
            />
          </Field>
          <Field data-disabled={played !== "yes"}>
            <FieldLabel htmlFor="review">Short review</FieldLabel>
            <Textarea
              id="review"
              name="review"
              rows={3}
              maxLength={1000}
              disabled={played !== "yes"}
              defaultValue={game?.review?.text ?? ""}
              placeholder="What stayed with you?"
            />
            <FieldDescription>
              Up to 1,000 characters. Switching to “Not played” clears the review when saved.
            </FieldDescription>
          </Field>
        </FieldGroup>
        {error && (
          <Alert variant="destructive">
            <AlertTitle>Check the game details</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <Separator />
        <div className="flex flex-wrap items-center justify-between gap-3">
          {game ? (
            <Button
              type="button"
              variant="destructive"
              onClick={() => setRemoving(true)}
              disabled={busy}
            >
              <Trash2 data-icon="inline-start" />
              Remove game
            </Button>
          ) : (
            <span className="text-xs text-muted-foreground">Saved directly to games.json</span>
          )}
          <Button type="submit" disabled={busy}>
            <Save data-icon="inline-start" />
            {busy ? "Saving…" : "Save game"}
          </Button>
        </div>
        {removing && (
          <Alert>
            <AlertTitle>Remove {game?.title} from your collection?</AlertTitle>
            <AlertDescription>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="destructive"
                  onClick={() => {
                    void onDelete();
                  }}
                  disabled={busy}
                >
                  Yes, remove
                </Button>
                <Button type="button" variant="outline" onClick={() => setRemoving(false)}>
                  Keep game
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </fieldset>
    </form>
  );
}
