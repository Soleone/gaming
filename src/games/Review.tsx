import type { Ref } from "react";
import ReactMarkdown from "react-markdown";
import { CircleHelp, Sparkles, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ReviewDialogContent, ReviewTitle } from "@/components/variants/ReviewDialog";
import { cn } from "@/lib/utils";
import { Pips } from "./Pips";
import { PlayBadge } from "./PlayBadge";
import {
  playLabels,
  releaseLabel,
  verdictLabels,
  verdicts,
  type Game,
  type Verdict,
} from "./model";

type Review = NonNullable<Game["review"]>;

const verdictLooks: Record<Verdict, { icon: LucideIcon; tone: string; mark: string }> = {
  amazing: { icon: Sparkles, tone: "text-primary", mark: "bg-primary" },
  nice: { icon: ThumbsUp, tone: "text-foreground", mark: "bg-foreground" },
  questionable: { icon: CircleHelp, tone: "text-muted-foreground", mark: "bg-muted-foreground" },
  terrible: { icon: ThumbsDown, tone: "text-destructive", mark: "bg-destructive" },
};

// A score reads by tier: 9 and up in gold, 7 and 8 plain, anything lower in red.
export function scoreLook(score: number): { text: string; fill: string } {
  if (score >= 9) return { text: "text-score-gold", fill: "bg-score-gold" };
  if (score >= 7) return { text: "text-foreground", fill: "bg-foreground" };
  return { text: "text-destructive", fill: "bg-destructive" };
}

const markdownElements = ["p", "em", "strong", "a", "ul", "ol", "li", "code"];

// A Started game's review is a first impression; it becomes the review once played.
export function reviewLabel(play: Game["play"]): string {
  return play === "started" ? "First impressions" : "Review";
}

// Whether a review has anything to open: a write-up or a point. A score alone stays on the card.
export function hasReviewContent(review: Review): boolean {
  return review.text !== "" || verdicts.some((verdict) => review[verdict].length > 0);
}

// Points read as pros and cons. Empty lists drop out, and so does a side with nothing left.
export function reviewColumns(review: Review): { title: string; verdicts: Verdict[] }[] {
  const sides: [string, Verdict[]][] = [
    ["The good", ["amazing", "nice"]],
    ["The bad", ["questionable", "terrible"]],
  ];
  return sides
    .map(([title, side]) => ({
      title,
      verdicts: side.filter((verdict) => review[verdict].length > 0),
    }))
    .filter((column) => column.verdicts.length > 0);
}

export function ReviewDialog({
  game,
  review,
  cover,
  coverRef,
  open,
  instant,
  onOpenChange,
}: {
  game: Game;
  review: Review;
  cover: string | null;
  coverRef: Ref<HTMLImageElement>;
  open: boolean;
  instant: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const started = game.play === "started";
  const label = reviewLabel(game.play);
  const columns = reviewColumns(review);
  const look = review.score !== null ? scoreLook(review.score) : null;
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <ReviewDialogContent instant={instant} closeLabel={`Close ${label.toLowerCase()}`}>
        <header className="relative flex flex-col justify-end">
          {cover && (
            <>
              <img
                ref={coverRef}
                src={cover}
                alt=""
                className="absolute inset-0 size-full object-cover"
              />
              <div
                aria-hidden="true"
                className="review-cover-fade absolute inset-x-0 top-0 -bottom-px"
              />
            </>
          )}
          <div
            className={cn(
              "relative flex flex-col gap-2 px-6 pb-7 sm:px-12 sm:pr-60",
              cover ? "pt-48 sm:pt-72" : "pt-14",
            )}
          >
            <span className="text-xs font-semibold tracking-widest text-primary uppercase">
              {label}
            </span>
            <ReviewTitle>{game.title}</ReviewTitle>
            <DialogDescription>
              {look ? "" : `${playLabels[game.play]} · `}Released {releaseLabel(game.release)}
            </DialogDescription>
          </div>
          {review.score !== null && look && (
            <div className="review-stamp relative mx-6 -mb-8 flex w-40 flex-col gap-2.5 self-end rounded-xl border border-primary/50 bg-background px-4.5 pt-3.5 pb-4 shadow-2xl sm:absolute sm:right-12 sm:-bottom-16 sm:m-0">
              <span className="text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                {started ? "So far" : "Verdict"}
              </span>
              <p className="flex items-baseline justify-center gap-1.5">
                <strong
                  className={cn("text-7xl leading-none font-extrabold tracking-tighter", look.text)}
                >
                  {review.score}
                </strong>
                <span className="text-lg font-medium text-muted-foreground">/ 10</span>
              </p>
              <Pips
                value={review.score}
                max={10}
                fill={look.fill}
                aria-hidden="true"
                className="grid grid-cols-10 gap-1"
              />
              <div className="flex justify-center">
                <PlayBadge play={game.play} />
              </div>
            </div>
          )}
        </header>
        <div className="flex min-h-24 flex-col gap-9 px-6 pt-14 pb-10 sm:px-12 sm:pt-11 sm:pb-12">
          {review.text && (
            <div className="review-text max-w-xl text-lg leading-relaxed">
              <ReactMarkdown
                allowedElements={markdownElements}
                unwrapDisallowed
                components={{
                  a: ({ href, children }) => (
                    <a href={href} target="_blank" rel="noreferrer">
                      {children}
                    </a>
                  ),
                }}
              >
                {review.text}
              </ReactMarkdown>
            </div>
          )}
          {columns.length > 0 && (
            <>
              {review.text && <Separator />}
              <div className={cn("grid gap-x-11 gap-y-8", columns.length > 1 && "sm:grid-cols-2")}>
                {columns.map((column) => (
                  <section key={column.title} className="flex min-w-0 flex-col gap-5">
                    <h3 className="border-b pb-2.5 text-xs font-semibold tracking-widest text-muted-foreground uppercase">
                      {column.title}
                    </h3>
                    {column.verdicts.map((verdict) => {
                      const { icon: Icon, tone, mark } = verdictLooks[verdict];
                      return (
                        <div key={verdict} className="flex flex-col gap-3">
                          <h4 className={cn("flex items-center gap-2 text-sm font-semibold", tone)}>
                            <Icon className="size-4" aria-hidden="true" />
                            {verdictLabels[verdict]}
                          </h4>
                          <ul className="flex flex-col gap-2.5">
                            {review[verdict].map((point, index) => (
                              <li key={index} className="flex gap-3 leading-relaxed">
                                <span
                                  aria-hidden="true"
                                  className={cn(
                                    "mt-2.5 size-1.5 shrink-0 rotate-45 rounded-xs",
                                    mark,
                                  )}
                                />
                                <span className="min-w-0">{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}
                  </section>
                ))}
              </div>
            </>
          )}
        </div>
      </ReviewDialogContent>
    </Dialog>
  );
}
