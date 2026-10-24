import { useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent } from "react";
import {
  ArrowLeft,
  CircleHelp,
  ImageOff,
  Save,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  type LucideIcon,
} from "lucide-react";
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
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Textarea } from "@/components/ui/textarea";
import { ChoiceField } from "./ChoiceField";
import { parseGameDraft, type GameDraft } from "./draft";
import {
  canReview,
  MONTHS,
  playLabels,
  playStatuses,
  verdictLabels,
  verdicts,
  type Game,
  type Verdict,
} from "./model";

const verdictIcons: Record<Verdict, LucideIcon> = {
  amazing: Sparkles,
  nice: ThumbsUp,
  questionable: CircleHelp,
  terrible: ThumbsDown,
};

// Previews the cover as the calendar crops it; blank or broken URLs show a placeholder.
function CoverPreview({ src }: { src: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (src && src !== failed)
    return (
      <img
        src={src}
        alt="Cover preview"
        referrerPolicy="no-referrer"
        className="aspect-video w-full rounded-xl border border-border object-cover"
        onError={() => setFailed(src)}
      />
    );
  return (
    <div className="aspect-video rounded-xl border border-dashed border-border">
      <Empty className="h-full">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ImageOff aria-hidden="true" />
          </EmptyMedia>
          <EmptyTitle>{src ? "Preview unavailable" : "No cover yet"}</EmptyTitle>
        </EmptyHeader>
      </Empty>
    </div>
  );
}

export function GameForm({
  game,
  draft,
  onChange,
  busy,
  onSave,
  onDelete,
  onDirty,
  onClose,
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
  onClose: () => void;
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
  const reviewable = canReview(draft.play);
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <form
        ref={formRef}
        className="flex min-w-0 flex-col gap-8"
        onKeyDown={submitShortcut}
        onSubmit={(event) => {
          void submit(event);
        }}
      >
        <div className="sticky top-0 z-10 flex flex-col gap-3 border-b border-border bg-background py-3">
          <div className="flex items-center gap-3">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Close editor"
              onClick={onClose}
              disabled={busy}
            >
              <ArrowLeft />
            </Button>
            <div className="flex min-w-0 flex-1 flex-col">
              <h1 id="editor-title" className="truncate font-heading text-xl font-semibold">
                {draft.title.trim() || "New game"}
              </h1>
              <p className="truncate text-xs text-muted-foreground">
                Local editor · saves to src/data/games.json
              </p>
            </div>
            <Button type="submit" disabled={busy}>
              <Save data-icon="inline-start" />
              {busy ? "Saving…" : "Save game"}
            </Button>
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
        <fieldset disabled={busy} className="flex min-w-0 flex-col gap-10">
          <legend className="sr-only">{game ? `Edit ${game.title}` : "New game"}</legend>
          <div className="grid min-w-0 gap-8 lg:grid-cols-5">
            <div className="flex min-w-0 flex-col gap-3 lg:col-span-2">
              <CoverPreview src={draft.cover.trim()} />
              <Field>
                <FieldLabel htmlFor="cover">Cover image</FieldLabel>
                <Input
                  id="cover"
                  {...input("cover")}
                  placeholder="https://… or /covers/game.jpg"
                  maxLength={2000}
                />
                <FieldDescription>Local artwork lives in public/covers/.</FieldDescription>
              </Field>
            </div>
            <FieldGroup className="lg:col-span-3">
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
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-36">
                  <ChoiceField
                    id="precision"
                    label="Release"
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
                </div>
                <div className="w-24">
                  <Field>
                    <FieldLabel htmlFor="release-year">Year</FieldLabel>
                    <Input
                      id="release-year"
                      {...input("year")}
                      type="number"
                      min={1970}
                      max={2200}
                      step={1}
                      required={draft.precision !== "unknown"}
                      placeholder={draft.precision === "unknown" ? "Optional" : undefined}
                    />
                  </Field>
                </div>
                {(draft.precision === "month" || draft.precision === "day") && (
                  <div className="w-36">
                    <ChoiceField
                      id="release-month"
                      label="Month"
                      value={draft.month}
                      onChange={(value) => edit("month", value)}
                      options={MONTHS.map((label, index) => ({ value: String(index + 1), label }))}
                    />
                  </div>
                )}
                {draft.precision === "day" && (
                  <div className="w-20">
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
                  </div>
                )}
                {draft.precision === "quarter" && (
                  <div className="w-24">
                    <ChoiceField
                      id="release-quarter"
                      label="Quarter"
                      value={draft.quarter}
                      onChange={(value) => edit("quarter", value)}
                      options={[1, 2, 3, 4].map((value) => ({
                        value: String(value),
                        label: `Q${value}`,
                      }))}
                    />
                  </div>
                )}
              </div>
              <div className="flex flex-wrap items-start gap-4">
                <div className="w-44">
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
                </div>
                <div className="w-24">
                  <Field data-disabled={!reviewable}>
                    <FieldLabel htmlFor="score">Score</FieldLabel>
                    <InputGroup data-disabled={!reviewable}>
                      <InputGroupInput
                        id="score"
                        {...input("score")}
                        type="number"
                        min={1}
                        max={10}
                        step={1}
                        disabled={!reviewable}
                        placeholder="–"
                      />
                      <InputGroupAddon align="inline-end">/ 10</InputGroupAddon>
                    </InputGroup>
                  </Field>
                </div>
                <div className="w-36">
                  <ChoiceField
                    id="play"
                    label="Play status"
                    value={draft.play}
                    onChange={(value) => edit("play", value)}
                    options={playStatuses.map((value) => ({ value, label: playLabels[value] }))}
                  />
                </div>
              </div>
            </FieldGroup>
          </div>
          {reviewable ? (
            <FieldSet>
              <FieldLegend>Review</FieldLegend>
              <FieldDescription>
                Setting the game back to Not played clears the review when saved.
              </FieldDescription>
              <FieldGroup>
                <Field>
                  <FieldLabel htmlFor="review">Write-up</FieldLabel>
                  <Textarea
                    id="review"
                    {...input("review")}
                    rows={6}
                    maxLength={1000}
                    placeholder="What stayed with you? Markdown works. Hide spoilers with ||double bars||."
                  />
                  <FieldDescription>{draft.review.length} / 1,000 characters</FieldDescription>
                </Field>
                <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  {verdicts.map((verdict) => {
                    const Icon = verdictIcons[verdict];
                    return (
                      <Field key={verdict}>
                        <FieldLabel htmlFor={`review-${verdict}`}>
                          <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                          {verdictLabels[verdict]}
                        </FieldLabel>
                        <Textarea
                          id={`review-${verdict}`}
                          {...input(verdict)}
                          rows={4}
                          placeholder="One point per line. ||Spoilers|| in double bars."
                        />
                      </Field>
                    );
                  })}
                </div>
              </FieldGroup>
            </FieldSet>
          ) : (
            <p className="text-sm text-muted-foreground">
              The review opens once the game is Started, Played, or Completed.
            </p>
          )}
        </fieldset>
        {game && (
          <div className="flex items-center justify-end border-t border-border pt-4">
            <Button
              type="button"
              variant="destructive"
              onClick={() => setRemoving(true)}
              disabled={busy}
            >
              <Trash2 data-icon="inline-start" />
              Remove
            </Button>
          </div>
        )}
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
