import { useEffect, useRef, useState } from "react";
import { Search } from "lucide-react";
import { isInteractiveTarget } from "@/components/soleone/theme";
import {
  Combobox,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from "@/components/ui/combobox";
import { SearchResults } from "@/components/variants/SearchResults";
import { InputGroupAddon } from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import { releaseLabel, type Game } from "./model";

/** Finds a game by title as you type and hands the pick to onPick, then clears itself for the next search. */
export function GameSearch({ games, onPick }: { games: Game[]; onPick: (game: Game) => void }) {
  const [query, setQuery] = useState("");
  const input = useRef<HTMLInputElement>(null);
  // Pressing / outside text fields jumps into the search.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.key !== "/") return;
      if (event.metaKey || event.ctrlKey || event.altKey || isInteractiveTarget(event.target))
        return;
      event.preventDefault();
      input.current?.focus();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
  const items = games.toSorted((a, b) => a.title.localeCompare(b.title));
  return (
    <Combobox
      items={items}
      value={null}
      inputValue={query}
      onInputValueChange={setQuery}
      onValueChange={(game) => {
        if (!game) return;
        setQuery("");
        onPick(game);
      }}
      itemToStringLabel={(game: Game) => game.title}
      autoHighlight
    >
      <ComboboxInput
        ref={input}
        className="w-28 sm:w-60"
        placeholder="Search"
        aria-label="Search games"
        showTrigger={false}
      >
        <InputGroupAddon>
          <Search aria-hidden="true" />
        </InputGroupAddon>
        {!query && (
          <InputGroupAddon align="inline-end" className="max-sm:hidden">
            <Kbd>/</Kbd>
          </InputGroupAddon>
        )}
      </ComboboxInput>
      <SearchResults>
        <ComboboxEmpty>No game by that name.</ComboboxEmpty>
        <ComboboxList>
          {(game: Game) => (
            <ComboboxItem key={game.id} value={game}>
              <span className="truncate">{game.title}</span>
              <span className="ml-auto shrink-0 text-xs text-muted-foreground">
                {releaseLabel(game.release)}
              </span>
            </ComboboxItem>
          )}
        </ComboboxList>
      </SearchResults>
    </Combobox>
  );
}
