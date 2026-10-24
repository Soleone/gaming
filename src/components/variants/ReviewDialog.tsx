import type { ComponentProps } from "react";
import { XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DialogClose, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

// A wide, edge-to-edge dialog whose cover runs under a round close button. `instant` drops the
// dialog's own enter and exit animation while a View Transition carries the cover in and out.
export function ReviewDialogContent({
  instant,
  closeLabel,
  className,
  children,
  ...props
}: ComponentProps<typeof DialogContent> & { instant: boolean; closeLabel: string }) {
  return (
    <DialogContent
      showCloseButton={false}
      className={cn(
        "max-h-[calc(100dvh-4rem)] gap-0 overflow-y-auto p-0 sm:max-w-4xl",
        instant && "data-open:animate-none data-closed:hidden",
        className,
      )}
      {...props}
    >
      {children}
      <DialogClose
        render={
          <Button
            variant="secondary"
            size="icon"
            className="absolute top-3.5 right-3.5 rounded-full"
            aria-label={closeLabel}
          />
        }
      >
        <XIcon />
      </DialogClose>
    </DialogContent>
  );
}

// The review's headline, set large over the cover.
export function ReviewTitle({ className, ...props }: ComponentProps<typeof DialogTitle>) {
  return (
    <DialogTitle
      className={cn(
        "text-3xl leading-none font-bold tracking-tight text-balance sm:text-5xl",
        className,
      )}
      {...props}
    />
  );
}
