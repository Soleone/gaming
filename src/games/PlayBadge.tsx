import { Check } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { isPlayed, playLabels, type Game } from "./model";

// How far along a visitor is: Started on its own, Played and Completed with a check.
export function PlayBadge({ play }: { play: Game["play"] }) {
  if (play === "started") return <Badge variant="outline">Started</Badge>;
  if (!isPlayed(play)) return null;
  return (
    <Badge variant="secondary">
      <Check data-icon="inline-start" />
      {playLabels[play]}
    </Badge>
  );
}
