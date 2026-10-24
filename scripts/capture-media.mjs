// Records the README hero and motion loop from a fresh browser session: the calendar, then one review.
// Usage: vp run media:capture -- [--url http://localhost:4173]
// Needs agent-browser (with its browser installed) and FFmpeg on the PATH. Recording and encoding come from showcase.
import { parseArgs } from "node:util";
import { record } from "@soleone/showcase/capture";

const { values } = parseArgs({
  options: { url: { type: "string", default: "https://gaming.soleone.xyz" } },
});

const game = "Resident Evil Requiem";
// Each review has its own URL, and the hidden agent sheet is a dialog too, so the path is the signal.
const reviewOpen = `location.pathname.startsWith("/games/")`;

const { durationMs, grid } = await record({
  url: `${values.url}/2026`,
  out: "docs/media/demo.webp",
  attempts: 3,
  start: async (page) => {
    await page.waitFor(`document.querySelectorAll("article img").length > 4`);
    await page.waitFor(
      `[...document.images].filter((image) => image.getBoundingClientRect().top < innerHeight).every((image) => image.complete)`,
      { timeoutMs: 15_000 },
    );
    await page.sleep(800);
    await page.run("screenshot", "docs/media/hero.png");
  },
  async drive(page) {
    await page.sleep(1200);
    await page.eval(`window.scrollTo({ top: 900, behavior: "smooth" }), true`);
    await page.sleep(1800);
    await page.eval(`window.scrollTo({ top: 0, behavior: "smooth" }), true`);
    await page.sleep(1400);
    // A real click on this card's own Review button; every card has one with the same name.
    const card = (await page.run("snapshot", "-i")).split(`article "${game}"`)[1];
    const ref = card?.match(/button "Review" \[ref=(\w+)\]/)?.[1];
    if (!ref) throw new Error(`No Review button on the ${game} card`);
    await page.run("click", `@${ref}`);
    await page.waitFor(reviewOpen, { timeoutMs: 5000 });
    await page.sleep(4000);
    // Closed with the pointer: Escape returns keyboard focus to the Review button, ringed, so the loop would not end where it starts.
    await page.click("Close review");
    await page.waitFor(`!${reviewOpen}`, { timeoutMs: 5000 });
    await page.sleep(1500);
  },
  async verify(page) {
    if (await page.eval(reviewOpen)) return "the review did not close";
    if (await page.eval(`window.scrollY !== 0`)) return "the calendar did not return to the top";
  },
});

console.log(
  `Wrote docs/media/demo.webp (${(durationMs / 1000).toFixed(1)} s). Frame sheet: ${grid}`,
);
