import { BadgeCheck, Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isPlayed, playLabels, type Game } from "./model";

// How far along a visitor is: Started on its own, Played with a check, Completed with a badge.
export function PlayBadge({ play }: { play: Game["play"] }) {
  if (play === "started") return <Badge variant="outline">Started</Badge>;
  if (!isPlayed(play)) return null;
  const Icon = play === "completed" ? BadgeCheck : Check;
  return (
    <Badge variant="secondary">
      <Icon data-icon="inline-start" />
      {playLabels[play]}
    </Badge>
  );
}
