import type { ComponentProps } from "react";
import { ComboboxContent } from "@/components/ui/combobox";

// Suggestions size to their longest title instead of the small search field they drop from, so
// titles aren't cut off. A very long one still truncates at the cap or the screen edge.
export function SearchResults(props: ComponentProps<typeof ComboboxContent>) {
  return (
    <ComboboxContent
      align="end"
      className="w-max max-w-[min(32rem,var(--available-width))]"
      {...props}
    />
  );
}
