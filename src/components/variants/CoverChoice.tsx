import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { DialogContent } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// An image tile that opens its cover's preview; the selected tile carries a ring.
export function CoverTile({
  selected,
  className,
  ...props
}: ComponentProps<typeof Button> & { selected: boolean }) {
  return (
    <Button
      type="button"
      variant="outline"
      aria-pressed={selected}
      className={cn(
        "h-auto min-w-0 flex-col items-stretch gap-1.5 p-1.5 text-xs font-normal whitespace-normal aria-pressed:border-primary aria-pressed:ring-2 aria-pressed:ring-primary/40",
        className,
      )}
      {...props}
    />
  );
}

// A wide dialog for looking at one cover at a large size.
export function CoverDialogContent({ className, ...props }: ComponentProps<typeof DialogContent>) {
  return <DialogContent className={cn("sm:max-w-3xl", className)} {...props} />;
}
