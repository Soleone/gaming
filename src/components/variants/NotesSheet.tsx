import type { ComponentProps } from "react";
import { SheetContent } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

// A side sheet that fills a phone screen and is wide enough on larger screens for a two-column
// form. Its content scrolls on its own.
export function NotesSheetContent({ className, ...props }: ComponentProps<typeof SheetContent>) {
  return (
    <SheetContent
      side="right"
      className={cn(
        "gap-0 overflow-y-auto data-[side=right]:w-full data-[side=right]:sm:max-w-xl",
        className,
      )}
      {...props}
    />
  );
}
