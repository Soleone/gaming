import { useState } from "react";
import { Check, Copy, NotebookPen, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { Game } from "./model";
import { shareNotes, type Note } from "./notes";

// Copies this browser's notes for pasting into Import notes on the dev server.
export function NotesMenu({
  notes,
  games,
  onClear,
  onLeave,
}: {
  notes: Record<string, Note>;
  games: Game[];
  onClear: () => void;
  onLeave: () => void;
}) {
  const [copied, setCopied] = useState<"yes" | "failed" | null>(null);
  const count = Object.keys(notes).length;

  async function copy() {
    try {
      await navigator.clipboard.writeText(JSON.stringify(shareNotes(notes, games), null, 2));
      setCopied("yes");
    } catch {
      setCopied("failed");
    }
  }

  return (
    <Popover onOpenChange={() => setCopied(null)}>
      <PopoverTrigger
        render={<Button variant="ghost" size="sm" aria-label={`Review notes, ${count} games`} />}
      >
        <NotebookPen data-icon="inline-start" />
        {count}
      </PopoverTrigger>
      <PopoverContent align="end">
        <PopoverHeader>
          <PopoverTitle>Review notes</PopoverTitle>
          <PopoverDescription>
            {count === 0
              ? "No notes yet. Open a game's notes from its card."
              : `${count} ${count === 1 ? "game has" : "games have"} notes. Copy them and paste into Import notes on the dev server.`}
          </PopoverDescription>
        </PopoverHeader>
        <Button disabled={count === 0} onClick={() => void copy()}>
          {copied === "yes" ? (
            <Check data-icon="inline-start" />
          ) : (
            <Copy data-icon="inline-start" />
          )}
          {copied === "yes" ? "Copied" : "Copy notes"}
        </Button>
        {copied === "failed" && (
          <p role="alert" className="text-xs text-destructive">
            Could not reach the clipboard. Try again from the page itself.
          </p>
        )}
        <Button
          variant="outline"
          disabled={count === 0}
          onClick={() => {
            if (window.confirm(`Clear the notes for ${count} ${count === 1 ? "game" : "games"}?`))
              onClear();
          }}
        >
          <Trash2 data-icon="inline-start" />
          Clear notes
        </Button>
        <Button variant="link" size="sm" onClick={onLeave}>
          Leave notes mode
        </Button>
      </PopoverContent>
    </Popover>
  );
}
