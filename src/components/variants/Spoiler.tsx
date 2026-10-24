import type { ReactNode } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Popover, PopoverContent, PopoverTitle, PopoverTrigger } from "@/components/ui/popover";

// A hatched, redacted chip that keeps the hidden text out of the page until it is clicked, then
// shows it in a popover. Nothing is rendered for the text while the popover is closed.
export function Spoiler({ children }: { children: ReactNode }) {
  return (
    <Popover>
      <PopoverTrigger
        className="review-spoiler mx-0.5 inline-flex cursor-pointer items-center gap-1 rounded-sm border px-1.5 align-baseline text-[0.65em] leading-snug font-semibold tracking-wider text-muted-foreground uppercase transition-colors hover:border-primary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-popup-open:border-primary/60 data-popup-open:text-foreground"
        aria-label="Show spoiler"
      >
        <EyeOff className="size-[1.1em]" aria-hidden="true" />
        Spoiler
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-80 gap-3 p-4">
        <PopoverTitle className="flex items-center gap-2 text-xs font-semibold tracking-widest text-primary uppercase">
          <Eye className="size-3.5" aria-hidden="true" />
          Spoiler
        </PopoverTitle>
        <div className="text-base leading-relaxed text-popover-foreground">{children}</div>
      </PopoverContent>
    </Popover>
  );
}
