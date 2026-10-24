import { useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowRight, Check, Flame, Gamepad2, Pencil, Star } from "lucide-react";
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
import { hasReleased, isPlayed, playLabels, releaseLabel, type Game } from "./model";

export function GameCard({ game, onEdit }: { game: Game; onEdit?: (id: string) => void }) {
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
    <article className="game-entry min-w-0" aria-label={game.title}>
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
              {game.play === "started" && <Badge variant="outline">Started</Badge>}
              {isPlayed(game.play) && (
                <Badge variant="secondary">
                  <Check data-icon="inline-start" />
                  {playLabels[game.play]}
                </Badge>
              )}
              {game.play === "not_played" && hasReleased(game.release) && (
                <Badge variant="outline">Not played</Badge>
              )}
            </div>
            {game.review && (
              <>
                <Separator />
                {review ? (
                  <div className="flex items-center justify-between gap-3">
                    {review.score !== null ? (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="-ml-2.5"
                        aria-label={`${reviewLabel(game.play)}: ${review.score} out of 10`}
                        onClick={openReview}
                      >
                        <Star data-icon="inline-start" className={scoreLook(review.score).text} />
                        <strong className={scoreLook(review.score).text}>{review.score}</strong>
                        <span className="text-muted-foreground">
                          / 10{game.play === "started" && " so far"}
                        </span>
                      </Button>
                    ) : (
                      <span />
                    )}
                    <Button variant="link" size="sm" className="-mr-2.5" onClick={openReview}>
                      {reviewLabel(game.play)}
                      <ArrowRight data-icon="inline-end" />
                    </Button>
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
