import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowRight, Flame, Gamepad2, Pencil, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { canMorph, morph } from "./morph";
import { hasReviewContent, ReviewDialog, reviewLabel, scoreLook } from "./Review";
import { Pips } from "./Pips";
import { hasReleased, playLabels, releaseLabel, type Game } from "./model";
import { PlayBadge } from "./PlayBadge";

export function GameCard({
  game,
  selected,
  onEdit,
}: {
  game: Game;
  selected?: boolean;
  onEdit?: (id: string) => void;
}) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const [reviewOpen, setReviewOpen] = useState(false);
  // Whether the open review arrived by morphing the cover, so it leaves the same way.
  const [morphed, setMorphed] = useState(false);
  const coverRef = useRef<HTMLImageElement>(null);
  const reviewCoverRef = useRef<HTMLImageElement>(null);
  const showCover = game.cover && game.cover !== failedCover;
  const review = game.review && hasReviewContent(game.review) ? game.review : null;

  function openReview() {
    const cover = coverRef.current;
    if (!cover || !canMorph()) {
      setMorphed(false);
      setReviewOpen(true);
      return;
    }
    morph(
      cover,
      () => reviewCoverRef.current,
      () =>
        flushSync(() => {
          setMorphed(true);
          setReviewOpen(true);
        }),
    );
  }

  function closeReview() {
    const cover = reviewCoverRef.current;
    if (!morphed || !cover) return setReviewOpen(false);
    morph(
      cover,
      () => coverRef.current,
      () => flushSync(() => setReviewOpen(false)),
    );
  }

  return (
    <article
      className={cn(
        "game-entry min-w-0 rounded-xl",
        selected && "outline-2 outline-offset-4 outline-ring",
      )}
      aria-label={game.title}
      data-game-id={game.id}
      data-selected={selected || undefined}
    >
      <Card className="h-full">
        {showCover ? (
          <img
            ref={coverRef}
            src={game.cover!}
            alt={`${game.title} artwork`}
            width="720"
            height="405"
            loading="lazy"
            className={cn(
              "game-cover aspect-video w-full object-cover",
              review && "cursor-pointer",
            )}
            onClick={review ? openReview : undefined}
            onError={() => setFailedCover(game.cover)}
          />
        ) : (
          <div className="aspect-video">
            <Empty className="h-full">
              <EmptyHeader>
                <EmptyMedia variant="icon">
                  <Gamepad2 aria-hidden="true" />
                </EmptyMedia>
                <EmptyTitle>Artwork to come</EmptyTitle>
              </EmptyHeader>
            </Empty>
          </div>
        )}
        <CardHeader>
          <CardTitle>
            <h3>{game.title}</h3>
          </CardTitle>
          <CardDescription>{releaseLabel(game.release)}</CardDescription>
          {onEdit && (
            <CardAction>
              <Button
                variant="ghost"
                size="icon"
                aria-label={`Edit ${game.title}`}
                onClick={() => onEdit(game.id)}
              >
                <Pencil />
              </Button>
            </CardAction>
          )}
        </CardHeader>
        <CardContent className="flex-1">
          <div className="flex flex-col gap-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-sm">
                <Flame className="size-4 text-primary" aria-hidden="true" />
                <span className="text-muted-foreground">Hype</span>
                <Pips
                  value={game.hype}
                  max={5}
                  className="flex gap-1"
                  pipClassName="w-3"
                  aria-label={game.hype === null ? "Not rated" : `${game.hype} out of 5`}
                />
                {game.hype === null && (
                  <span className="text-xs text-muted-foreground">Unrated</span>
                )}
              </div>
              <PlayBadge play={game.play} />
              {game.play === "not_played" && hasReleased(game.release) && (
                <Badge variant="outline">Not played</Badge>
              )}
            </div>
            {game.review && (
              <>
                <Separator />
                {review || game.review.score !== null ? (
                  <div className="flex items-center justify-between gap-3">
                    {game.review.score !== null ? (
                      <Score
                        score={game.review.score}
                        started={game.play === "started"}
                        label={reviewLabel(game.play)}
                        onClick={review ? openReview : undefined}
                      />
                    ) : (
                      <span />
                    )}
                    {review && (
                      <Button variant="link" size="sm" className="-mr-1.5" onClick={openReview}>
                        {reviewLabel(game.play)}
                        <ArrowRight data-icon="inline-end" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {playLabels[game.play]} · review to come
                  </p>
                )}
              </>
            )}
          </div>
        </CardContent>
      </Card>
      {review && (
        <ReviewDialog
          game={game}
          review={review}
          cover={showCover ? game.cover : null}
          coverRef={reviewCoverRef}
          open={reviewOpen}
          instant={morphed}
          onOpenChange={(open) => (open ? openReview() : closeReview())}
        />
      )}
    </article>
  );
}

// The score out of 10. It opens the review when there is one, otherwise it is just a number.
function Score({
  score,
  started,
  label,
  onClick,
}: {
  score: number;
  started: boolean;
  label: string;
  onClick?: () => void;
}) {
  const { text } = scoreLook(score);
  const content = (
    <>
      <Star data-icon="inline-start" className={cn("size-4", text)} />
      <strong className={text}>{score}</strong>
      <span className="text-muted-foreground">/ 10{started && " so far"}</span>
    </>
  );
  // Mirrors the small ghost button's height, gap and text size, so a card without a review looks the same.
  if (!onClick) {
    return <span className="flex h-7 items-center gap-1 text-xs">{content}</span>;
  }
  return (
    <Button
      variant="ghost"
      size="sm"
      className="-ml-1.5"
      aria-label={`${label}: ${score} out of 10`}
      onClick={onClick}
    >
      {content}
    </Button>
  );
}
