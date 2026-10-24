// The class that gives an element the shared cover's transition name (see index.css).
const MORPH = "review-morph";

// Whether the cover can fly between a card and its review: needs View Transitions and motion.
export function canMorph(): boolean {
  return (
    "startViewTransition" in document && !matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

// Flies the cover from `from` to whatever `to` returns once `apply` has rendered the new state.
// Each end carries the shared name only in its own snapshot, since two elements with one name
// abort the transition. `apply` must render synchronously (flushSync).
export function morph(from: HTMLElement, to: () => HTMLElement | null, apply: () => void) {
  from.classList.add(MORPH);
  const transition = document.startViewTransition(() => {
    from.classList.remove(MORPH);
    apply();
    to()?.classList.add(MORPH);
  });
  void transition.finished.finally(() => to()?.classList.remove(MORPH));
}
