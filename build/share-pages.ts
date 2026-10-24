import { readFile } from "node:fs/promises";
import { basename, join } from "node:path";
import sharp from "sharp";
import type { Plugin } from "vite-plus";
import {
  gamesSchema,
  hasReviewContent,
  playLabels,
  releaseLabel,
  verdicts,
  type Game,
} from "../src/games/model";
import { gameSlug, reviewPath } from "../src/games/routes";

const SITE_NAME = "Soleone Gaming";
const SITE_URL = "https://gaming.soleone.xyz";
const SITE_DESCRIPTION =
  "A release calendar for the games I'm watching, with hype ratings and scored reviews.";
const CARD = { width: 1200, height: 630 };

type Meta = {
  title: string;
  description: string;
  /** The page's own path, left out for the calendar because one page serves every calendar URL. */
  path: string | null;
  image: { url: string; alt: string; sized: boolean };
};

const escape = (text: string) =>
  text.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// A spoiler never reaches a link preview, whoever sees it hasn't opted in to reading it.
const unspoiled = (text: string) => text.replace(/\|\|.+?\|\|/g, "…");

// Markdown reads as plain prose in a preview: links keep their text, formatting marks drop out.
const plain = (markdown: string) =>
  unspoiled(markdown)
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[*_`#>~]/g, "")
    .replace(/\s+/g, " ")
    .trim();

const clip = (text: string, max = 200) =>
  text.length <= max ? text : `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;

/** The write-up, or the first points when there is none, and the release when there is neither. */
function summary(game: Game & { review: NonNullable<Game["review"]> }) {
  const { review } = game;
  const points = verdicts
    .flatMap((verdict) => review[verdict])
    .filter((point) => !point.includes("||"))
    .slice(0, 3)
    .map(plain);
  const body = plain(review.text) || points.join(" · ");
  return clip(body || `${playLabels[game.play]} · ${releaseLabel(game.release)}`);
}

export function reviewMeta(game: Game & { review: NonNullable<Game["review"]> }): Meta {
  const { score } = game.review;
  const started = game.play === "started";
  const verdict =
    score === null
      ? started
        ? "first impressions"
        : "review"
      : started
        ? `${score}/10 so far`
        : `${score}/10`;
  const slug = gameSlug(game);
  return {
    title: `${game.title}: ${verdict}`,
    description: summary(game),
    path: reviewPath(game),
    image: { url: `${SITE_URL}/share/${slug}.jpg`, alt: `${game.title} cover art`, sized: true },
  };
}

const siteMeta: Meta = {
  title: SITE_NAME,
  description: SITE_DESCRIPTION,
  path: null,
  image: { url: `${SITE_URL}/share/site.jpg`, alt: `${SITE_NAME} release calendar`, sized: true },
};

/** Puts the page's title and its link-preview tags where the built page has its title. */
export function withMeta(html: string, meta: Meta): string {
  const tags = [
    `<title>${escape(meta.title)}${meta.path === null ? "" : ` · ${SITE_NAME}`}</title>`,
    `<meta name="description" content="${escape(meta.description)}" />`,
    ...(meta.path === null ? [] : [`<link rel="canonical" href="${SITE_URL}${meta.path}" />`]),
    `<meta property="og:site_name" content="${SITE_NAME}" />`,
    `<meta property="og:type" content="${meta.path === null ? "website" : "article"}" />`,
    `<meta property="og:title" content="${escape(meta.title)}" />`,
    `<meta property="og:description" content="${escape(meta.description)}" />`,
    ...(meta.path === null ? [] : [`<meta property="og:url" content="${SITE_URL}${meta.path}" />`]),
    `<meta property="og:image" content="${escape(meta.image.url)}" />`,
    ...(meta.image.sized
      ? [
          `<meta property="og:image:width" content="${CARD.width}" />`,
          `<meta property="og:image:height" content="${CARD.height}" />`,
        ]
      : []),
    `<meta property="og:image:alt" content="${escape(meta.image.alt)}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`,
  ];
  return html.replace(/<title>.*?<\/title>/, () => tags.join("\n    "));
}

/** A cover fitted to the preview shape, over a dimmed blur of itself so any aspect ratio fills it. */
async function previewCard(source: Buffer) {
  const backdrop = await sharp(source)
    .resize(CARD.width, CARD.height, { fit: "cover" })
    .blur(30)
    .modulate({ brightness: 0.55 })
    .toBuffer();
  const cover = await sharp(source).resize(CARD.width, CARD.height, { fit: "inside" }).toBuffer();
  return sharp(backdrop)
    .composite([{ input: cover, gravity: "center" }])
    .jpeg({ quality: 85 })
    .toBuffer();
}

/**
 * Link previews are read by crawlers that never run the app, so the build writes one static page per
 * reviewable game at its own URL, carrying that game's tags and a cover-based image. The calendar page
 * gets site-wide tags and an image made from the site's hero screenshot.
 */
export function sharePagesPlugin(
  dataPath: string,
  coversDirectory: string,
  siteImagePath: string,
): Plugin {
  return {
    name: "share-pages",
    enforce: "post",
    apply: "build",
    async generateBundle(_options, bundle) {
      const index = bundle["index.html"];
      if (index?.type !== "asset") throw new Error("share-pages: no index.html in the build.");
      const html = String(index.source);
      index.source = withMeta(html, siteMeta);

      const emit = (fileName: string, source: string | Buffer) =>
        this.emitFile({ type: "asset", fileName, source });
      emit(
        "share/site.jpg",
        await sharp(await readFile(siteImagePath))
          .resize(CARD.width, CARD.height, { fit: "cover", position: "top" })
          .jpeg({ quality: 85 })
          .toBuffer(),
      );

      const games = gamesSchema.parse(JSON.parse(await readFile(dataPath, "utf8")));
      const seen = new Set<string>();
      for (const game of games) {
        // Exactly the games whose review opens in the app; others send visitors to the calendar.
        if (!game.review || !hasReviewContent(game.review)) continue;
        const slug = gameSlug(game);
        if (seen.has(slug)) continue;
        seen.add(slug);

        const meta = reviewMeta({ ...game, review: game.review });
        // Local covers become a preview card. A remote cover is used as it is; the build stays offline.
        if (game.cover?.startsWith("/covers/")) {
          emit(
            `share/${slug}.jpg`,
            await previewCard(await readFile(join(coversDirectory, basename(game.cover)))),
          );
        } else if (game.cover) {
          meta.image = { url: game.cover, alt: meta.image.alt, sized: false };
        } else {
          meta.image = siteMeta.image;
        }
        emit(`games/${slug}/index.html`, withMeta(html, meta));
      }
    },
  };
}
