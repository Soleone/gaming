import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import {
  Sheet,
  SheetClose,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { NotesSheetContent } from "@/components/variants/NotesSheet";
import { ChoiceField } from "./ChoiceField";
import { ReviewFields } from "./ReviewFields";
import { playLabels, type Game } from "./model";
import type { Note } from "./notes";

// Review notes for one game, kept in this browser as they are typed.
export function NotesSheet({
  game,
  note,
  open,
  onChange,
  onClose,
}: {
  game: Game | null;
  note: Note;
  open: boolean;
  onChange: (note: Note) => void;
  onClose: () => void;
}) {
  const edit = (key: keyof Note, value: string) => onChange({ ...note, [key]: value });
  return (
    <Sheet
      open={open}
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <NotesSheetContent>
        <SheetHeader>
          <SheetTitle>{game?.title}</SheetTitle>
          <SheetDescription>
            Notes stay in this browser until you copy them from Notes in the header.
          </SheetDescription>
        </SheetHeader>
        <div className="px-4">
          <FieldGroup>
            <div className="flex flex-wrap items-start gap-4">
              <div className="w-48">
                <ChoiceField
                  id="note-play"
                  label="Play status"
                  value={note.play || "keep"}
                  onChange={(value) => edit("play", value === "keep" ? "" : value)}
                  options={[
                    { value: "keep", label: `Keep ${game ? playLabels[game.play] : "as is"}` },
                    { value: "started", label: playLabels.started },
                    { value: "played", label: playLabels.played },
                    { value: "completed", label: playLabels.completed },
                  ]}
                />
              </div>
              <div className="w-24">
                <Field>
                  <FieldLabel htmlFor="note-score">Score</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="note-score"
                      name="score"
                      value={note.score}
                      onChange={(event) => edit("score", event.target.value)}
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={10}
                      step={1}
                      placeholder={String(game?.review?.score ?? "–")}
                    />
                    <InputGroupAddon align="inline-end">/ 10</InputGroupAddon>
                  </InputGroup>
                </Field>
              </div>
            </div>
            <FieldDescription>
              The write-up is added after the current review and points join their lists.
            </FieldDescription>
            <ReviewFields id="note" values={note} onChange={edit} />
          </FieldGroup>
        </div>
        <SheetFooter>
          <SheetClose render={<Button />}>Done</SheetClose>
        </SheetFooter>
      </NotesSheetContent>
    </Sheet>
  );
}
