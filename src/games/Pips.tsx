import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

// A row of short bars filled up to a value, like hype out of 5 or a score out of 10.
export function Pips({
  value,
  max,
  fill = "bg-primary",
  pipClassName,
  ...props
}: ComponentProps<"span"> & {
  value: number | null;
  max: number;
  fill?: string;
  pipClassName?: string;
}) {
  return (
    <span {...props}>
      {Array.from({ length: max }, (_, index) => {
        const filled = value !== null && index < value;
        return (
          <span
            key={index}
            aria-hidden="true"
            data-filled={filled || undefined}
            className={cn("h-1.5 rounded-full", filled ? fill : "bg-border", pipClassName)}
          />
        );
      })}
    </span>
  );
}
