import type { ComponentProps } from "react";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

// A grid of image tiles for picking at most one cover; the pressed tile carries a ring.
export function CoverChoices({ className, ...props }: ComponentProps<typeof ToggleGroup>) {
  return (
    <ToggleGroup className={cn("grid w-full grid-cols-2 items-stretch", className)} {...props} />
  );
}

export function CoverChoice({ className, ...props }: ComponentProps<typeof ToggleGroupItem>) {
  return (
    <ToggleGroupItem
      variant="outline"
      className={cn(
        "h-auto min-w-0 flex-col items-stretch gap-1.5 p-1.5 text-xs font-normal whitespace-normal aria-pressed:border-primary aria-pressed:bg-transparent aria-pressed:ring-2 aria-pressed:ring-primary/40",
        className,
      )}
      {...props}
    />
  );
}
