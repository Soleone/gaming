import { useState } from "react";
import { ArrowUpRight, Check, Flame, Gamepad2, Pencil, Star } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Empty, EmptyHeader, EmptyMedia, EmptyTitle } from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { releaseLabel, type Game } from "./model";

export function GameCard({ game, onEdit }: { game: Game; onEdit?: (id: string) => void }) {
  const [failedCover, setFailedCover] = useState<string | null>(null);
  const showCover = game.cover && game.cover !== failedCover;
  return (
    <article className="game-entry min-w-0" aria-label={game.title}>
      <Card className="h-full">
        {showCover ? (
          <img
            src={game.cover!}
            alt={`${game.title} artwork`}
            width="720"
            height="405"
            loading="lazy"
            className="game-cover aspect-video w-full object-cover"
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
                <span
                  className="flex gap-1"
                  aria-label={game.hype === null ? "Not rated" : `${game.hype} out of 5`}
                >
                  {[1, 2, 3, 4, 5].map((level) => (
                    <span
                      key={level}
                      aria-hidden="true"
                      className={cn(
                        "h-1.5 w-3 rounded-full",
                        game.hype !== null && level <= game.hype ? "bg-primary" : "bg-border",
                      )}
                    />
                  ))}
                </span>
                {game.hype === null && (
                  <span className="text-xs text-muted-foreground">Unrated</span>
                )}
              </div>
              {game.review ? (
                <Badge variant="secondary">
                  <Check data-icon="inline-start" />
                  Played
                </Badge>
              ) : (
                <Badge variant="outline">Not played</Badge>
              )}
            </div>
            {game.review && (
              <>
                <Separator />
                <div className="flex flex-col gap-2">
                  {game.review.score !== null && (
                    <p className="flex items-center gap-1.5 text-sm">
                      <Star className="size-3.5 text-primary" aria-hidden="true" />
                      <strong>{game.review.score}</strong>
                      <span className="text-muted-foreground">/ 10</span>
                    </p>
                  )}
                  {game.review.text && (
                    <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
                      {game.review.text}
                    </p>
                  )}
                  {!game.review.text && game.review.score === null && (
                    <p className="text-sm text-muted-foreground">Played · review to come</p>
                  )}
                </div>
              </>
            )}
          </div>
        </CardContent>
        {game.source && (
          <CardFooter>
            <a
              href={game.source}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Release source <ArrowUpRight className="size-3" aria-hidden="true" />
              <span className="sr-only"> (opens in a new tab)</span>
            </a>
          </CardFooter>
        )}
      </Card>
    </article>
  );
}
