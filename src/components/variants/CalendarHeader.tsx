import type { ComponentProps } from "react";
import { Button } from "@/components/ui/button";
import { SelectTrigger } from "@/components/ui/select";
import { cn } from "@/lib/utils";

// The year as the page's headline: big type with no field chrome, still opening a select.
export function YearSelectTrigger({ className, ...props }: ComponentProps<typeof SelectTrigger>) {
  return (
    <SelectTrigger
      className={cn(
        "h-auto gap-2 border-0 bg-transparent p-0 font-heading text-5xl leading-none font-semibold tracking-tighter text-foreground tabular-nums hover:text-foreground/80 data-[size=default]:h-auto sm:text-8xl dark:bg-transparent dark:hover:bg-transparent [&_svg]:size-7 sm:[&_svg]:size-9",
        className,
      )}
      {...props}
    />
  );
}

// A month in the jump strip; the current month is marked with a fill and an accent dot.
export function MonthButton({ className, ...props }: ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "relative font-normal aria-[current=date]:bg-muted aria-[current=date]:after:absolute aria-[current=date]:after:bottom-0.5 aria-[current=date]:after:left-1/2 aria-[current=date]:after:size-1 aria-[current=date]:after:-translate-x-1/2 aria-[current=date]:after:rounded-full aria-[current=date]:after:bg-primary",
        className,
      )}
      {...props}
    />
  );
}
