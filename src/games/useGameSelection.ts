import { useEffect, useEffectEvent, useState } from "react";
import { isInteractiveTarget } from "@/components/soleone/theme";

type Move = "up" | "down" | "left" | "right";

const arrows: Record<string, Move> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const cardOf = (id: string) =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-game-id]")).find(
    (card) => card.dataset.gameId === id,
  );

/** The id of the nearest card in a direction, judged by where the cards are on screen. */
function neighbor(from: string, move: Move): string | null {
  const origin = cardOf(from)?.getBoundingClientRect();
  if (!origin) return null;
  const sideways = move === "left" || move === "right";
  let best: { id: string; cost: number } | null = null;
  for (const card of document.querySelectorAll<HTMLElement>("[data-game-id]")) {
    const id = card.dataset.gameId!;
    if (id === from) continue;
    const rect = card.getBoundingClientRect();
    const dx = rect.left - origin.left;
    const dy = rect.top - origin.top;
    const ahead = { up: dy < 0, down: dy > 0, left: dx < 0 && dy === 0, right: dx > 0 && dy === 0 };
    if (!ahead[move]) continue;
    // Along the direction first, then the least drift across it.
    const cost = sideways ? Math.abs(dx) : Math.abs(dy) * 1e4 + Math.abs(dx);
    if (!best || cost < best.cost) best = { id, cost };
  }
  return best?.id ?? null;
}

/**
 * Keyboard selection over the games on the page, for the local editor only. The first game is
 * selected until another is chosen; arrows move by screen position, Home and End jump to the ends,
 * and Enter opens the selected game.
 */
export function useGameSelection(ids: string[], enabled: boolean, onOpen: (id: string) => void) {
  const [chosen, setChosen] = useState<string | null>(null);
  const selected = chosen && ids.includes(chosen) ? chosen : (ids[0] ?? null);

  const onKeyDown = useEffectEvent((event: KeyboardEvent) => {
    if (!selected || event.defaultPrevented) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey) return;
    const target = event.target;
    // Typing, dropdowns, dialogs and the agent dock keep their own keys.
    if (isInteractiveTarget(target)) return;
    if (target instanceof Element && target.closest('[data-slot="sidebar"]')) return;
    let next: string | null;
    if (event.key === "Enter") {
      // A focused button or link keeps Enter for itself.
      if (target instanceof Element && target.closest("button, a[href]")) return;
      event.preventDefault();
      onOpen(selected);
      return;
    } else if (event.key === "Home") next = ids[0] ?? null;
    else if (event.key === "End") next = ids.at(-1) ?? null;
    else if (event.key in arrows) next = neighbor(selected, arrows[event.key]!);
    else return;
    event.preventDefault();
    if (!next) return;
    setChosen(next);
    cardOf(next)?.scrollIntoView({ block: "nearest" });
  });
  useEffect(() => {
    if (!enabled) return;
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);

  return enabled ? selected : null;
}
