import { useEffect, useState, type Ref } from "react";
import { animate } from "motion/react";
import ReactMarkdown from "react-markdown";
import { CircleHelp, Sparkles, ThumbsDown, ThumbsUp, type LucideIcon } from "lucide-react";
import { Dialog, DialogDescription } from "@/components/ui/dialog";
import { Separator } from "@/components/ui/separator";
import { ReviewDialogContent, ReviewTitle } from "@/components/variants/ReviewDialog";
import { Spoiler } from "@/components/variants/Spoiler";
import { cn } from "@/lib/utils";
import { Pips } from "./Pips";
import { PlayBadge } from "./PlayBadge";
import { markdownSpoilers, spoilerHref, splitSpoilers } from "./spoilers";
import { playLabels, releaseLabel, verdictLabels, type Game, type Verdict } from "./model";

type Review = NonNullable<Game["review"]>;

const verdictLooks: Record<Verdict, { icon: LucideIcon; tone: string; mark: string }> = {
  amazing: { icon: Sparkles, tone: "text-primary", mark: "bg-primary" },
  nice: { icon: ThumbsUp, tone: "text-foreground", mark: "bg-foreground" },
  questionable: { icon: CircleHelp, tone: "text-muted-foreground", mark: "bg-muted-foreground" },
  terrible: { icon: ThumbsDown, tone: "text-destructive", mark: "bg-destructive" },
};

type ScoreTier = "gold" | "plain" | "low";

// A score reads by tier: 9 and up in gold, 7 and 8 plain, anything lower in red.
export function scoreLook(score: number): { tier: ScoreTier; text: string; fill: string } {
  if (score >= 9) return { tier: "gold", text: "text-score-gold", fill: "bg-score-gold" };
  if (score >= 7) return { tier: "plain", text: "text-foreground", fill: "bg-foreground" };
  return { tier: "low", text: "text-destructive", fill: "bg-destructive" };
}

// The stamp's count starts as it lands (see .review-stamp in index.css) and eases gently into the
// score. Rounding shows each number halfway into its step, so the last one doesn't hang.
const countDelay = 0.5;
const countEase = [0.35, 0.35, 0.6, 1] as const;

function countsUp(): boolean {
  return (
    typeof matchMedia === "function" && !matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// The score stamp counts up from 0 with its bar in a muted tone, then lands on the score in its
// tier's colour, and a completed game's badge is stamped on after it. With reduced motion it
// shows it all straight away.
export function ScoreStamp({
  score,
  label,
  completed,
}: {
  score: number;
  label: string;
  completed: boolean;
}) {
  const [shown, setShown] = useState(() => (countsUp() ? 0 : score));
  useEffect(() => {
    if (!countsUp()) return;
    const controls = animate(0, score, {
      delay: countDelay,
      duration: 0.4 + score * 0.06,
      ease: countEase,
      onUpdate: (value) => setShown(Math.round(value)),
    });
    return () => controls.stop();
  }, [score]);
  const look = scoreLook(score);
  const landed = shown === score;
  return (
    <div
      data-tier={look.tier}
      data-landed={landed || undefined}
      className="review-stamp relative mx-6 -mb-8 flex w-40 flex-col gap-2.5 self-end rounded-xl border border-primary/50 bg-background px-4.5 pt-3.5 pb-4 shadow-2xl sm:absolute sm:right-12 sm:-bottom-16 sm:m-0"
    >
      <span className="text-center text-xs font-semibold tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      <p aria-hidden="true" className="flex items-baseline justify-center gap-1.5">
        <strong
          key={shown}
          className={cn(
            "review-score text-7xl leading-none font-extrabold tracking-tighter tabular-nums",
            landed ? look.text : "text-muted-foreground",
          )}
        >
          {shown}
        </strong>
        <span className="text-lg font-medium text-muted-foreground">/ 10</span>
      </p>
      <span className="sr-only">{score} out of 10</span>
      <Pips
        value={shown}
        max={10}
        fill={landed ? look.fill : "bg-muted-foreground"}
        aria-hidden="true"
        className="review-pips grid grid-cols-10 gap-1"
      />
      {completed && (
        <div className="review-seal flex justify-center">
          <PlayBadge play="completed" />
        </div>
      )}
    </div>
  );
}

const markdownElements = ["p", "em", "strong", "a", "ul", "ol", "li", "code"];

// A Started game's review is a first impression; it becomes the review once played.
export function reviewLabel(play: Game["play"]): string {
  return play === "started" ? "First impressions" : "Review";
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
              {review.score !== null ? "" : `${playLabels[game.play]} · `}Released{" "}
              {releaseLabel(game.release)}
            </DialogDescription>
          </div>
          {review.score !== null && (
            <ScoreStamp
              score={review.score}
              label={started ? "So far" : "Verdict"}
              completed={game.play === "completed"}
            />
          )}
        </header>
        <div className="flex min-h-24 flex-col gap-9 px-6 pt-14 pb-10 sm:px-12 sm:pt-11 sm:pb-12">
          {review.text && (
            <div className="review-text max-w-xl text-lg leading-relaxed">
              <ReactMarkdown
                allowedElements={markdownElements}
                unwrapDisallowed
                components={{
                  a: ({ href, children }) =>
                    href === spoilerHref ? (
                      <Spoiler>{children}</Spoiler>
                    ) : (
                      <a href={href} target="_blank" rel="noreferrer">
                        {children}
                      </a>
                    ),
                }}
              >
                {markdownSpoilers(review.text)}
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
                                <span className="min-w-0">
                                  {splitSpoilers(point).map((part, i) =>
                                    part.spoiler ? (
                                      <Spoiler key={i}>{part.text}</Spoiler>
                                    ) : (
                                      part.text
                                    ),
                                  )}
                                </span>
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
