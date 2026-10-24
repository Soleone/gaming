import { expect, it } from "vite-plus/test";
import type { Game } from "../src/games/model";
import { reviewMeta, withMeta } from "./share-pages";

const game = (review: Partial<NonNullable<Game["review"]>>, play: Game["play"] = "played") => ({
  id: "hades-ii",
  title: "Hades II",
  cover: null,
  release: { precision: "day" as const, year: 2026, month: 2, day: 6 },
  source: null,
  hype: null,
  play,
  review: {
    text: "",
    score: null,
    amazing: [],
    nice: [],
    questionable: [],
    terrible: [],
    ...review,
  },
});

it("share.preview: titles a review by its score and keeps spoilers out of the description", () => {
  const meta = reviewMeta(
    game({ score: 9, text: "A **great** run, and ||the ending|| lands. [Site](https://x.test)" }),
  );
  expect(meta.title).toBe("Hades II: 9/10");
  expect(meta.description).toBe("A great run, and … lands. Site");
  expect(meta.path).toBe("/games/hades-ii");
  expect(meta.image.url).toBe("https://gaming.soleone.xyz/share/hades-ii.jpg");
});

it("share.preview: says so mid-game and when there is no score", () => {
  expect(reviewMeta(game({ score: 6, nice: ["Tight"] }, "started")).title).toBe(
    "Hades II: 6/10 so far",
  );
  expect(reviewMeta(game({ nice: ["Tight"] }, "started")).title).toBe(
    "Hades II: first impressions",
  );
  expect(reviewMeta(game({ nice: ["Tight"] })).title).toBe("Hades II: review");
});

it("share.preview: falls back to points without spoilers, then to the release", () => {
  expect(
    reviewMeta(
      game({ amazing: ["Snappy"], nice: ["Hidden ||twist||", "Pretty"], terrible: ["Slow"] }),
    ).description,
  ).toBe("Snappy · Pretty · Slow");
  expect(reviewMeta(game({ score: 7, nice: ["Only ||this||"] })).description).toBe(
    "Played · Feb 6, 2026",
  );
});

it("share.preview: long write-ups are cut at a word", () => {
  const { description } = reviewMeta(game({ text: "word ".repeat(80) }));
  expect(description.length).toBeLessThanOrEqual(201);
  expect(description.endsWith("word…")).toBe(true);
});

it("share.preview: writes the tags in place of the title, escaped, without touching the rest", () => {
  const html = "<head><title>Soleone Gaming</title><script>$&</script></head>";
  const out = withMeta(html, {
    title: 'Say "hi" <b> $& 5/10',
    description: "a & b",
    path: "/games/x",
    image: { url: "https://x.test/a.jpg", alt: "alt", sized: true },
  });
  expect(out).toContain("<title>Say &quot;hi&quot; &lt;b&gt; $&amp; 5/10 · Soleone Gaming</title>");
  expect(out).toContain('<meta property="og:description" content="a &amp; b" />');
  expect(out).toContain('<link rel="canonical" href="https://gaming.soleone.xyz/games/x" />');
  expect(out).toContain("<script>$&</script></head>");
});
