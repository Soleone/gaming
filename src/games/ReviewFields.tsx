import { CircleHelp, Sparkles, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import type { GameDraft } from "./draft";
import { verdictLabels, verdicts, type Verdict } from "./model";

const verdictIcons: Record<Verdict, LucideIcon> = {
  amazing: Sparkles,
  nice: ThumbsUp,
  questionable: CircleHelp,
  terrible: ThumbsDown,
};

export type ReviewText = Pick<GameDraft, "review" | Verdict>;

// The write-up and the four point lists. The lists sit side by side as far as the space allows.
export function ReviewFields({
  id,
  values,
  onChange,
}: {
  id: string;
  values: ReviewText;
  onChange: (key: keyof ReviewText, value: string) => void;
}) {
  return (
    <FieldGroup>
      <Field>
        <FieldLabel htmlFor={id}>Write-up</FieldLabel>
        <Textarea
          id={id}
          name="review"
          value={values.review}
          onChange={(event) => onChange("review", event.target.value)}
          rows={6}
          maxLength={1000}
          placeholder="What stayed with you? Markdown works. Hide spoilers with ||double bars||."
        />
        <FieldDescription>{values.review.length} / 1,000 characters</FieldDescription>
      </Field>
      <div className="grid gap-4 @md/field-group:grid-cols-2 @4xl/field-group:grid-cols-4">
        {verdicts.map((verdict) => {
          const Icon = verdictIcons[verdict];
          return (
            <Field key={verdict}>
              <FieldLabel htmlFor={`${id}-${verdict}`}>
                <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
                {verdictLabels[verdict]}
              </FieldLabel>
              <Textarea
                id={`${id}-${verdict}`}
                name={verdict}
                value={values[verdict]}
                onChange={(event) => onChange(verdict, event.target.value)}
                rows={4}
              />
            </Field>
          );
        })}
      </div>
    </FieldGroup>
  );
}
