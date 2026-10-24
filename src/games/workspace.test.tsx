import type { ReactElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { createMemoryRouter, RouterProvider } from "react-router";
import { expect, it } from "vite-plus/test";
import Workspace from "./Workspace";
import { GameForm } from "./GameForm";
import { createGameDraft, type GameDraft } from "./draft";
import type { Game } from "./model";

// Workspace guards navigation with a blocker, which needs a data router.
const inRouter = (element: ReactElement) =>
  renderToStaticMarkup(<RouterProvider router={createMemoryRouter([{ path: "*", element }])} />);

it("agent.sidebar: exposes a single collapsed agent launcher outside the editor", () => {
  const html = inRouter(
    <Workspace games={[]} editor={null} onEdit={() => {}} onClose={() => {}} onSaved={() => {}}>
      <main>Calendar</main>
    </Workspace>,
  );
  expect(html).toContain("Calendar");
  expect(html.match(/aria-label="Open agent"/g)).toHaveLength(1);
  expect(html).not.toContain('aria-label="Agent conversation"');
  expect(html).not.toContain("Research with agent");
});
it("agent.sidebar: renders the draft editor beside the dock, not in a focus-blocking modal", () => {
  const html = inRouter(
    <Workspace
      games={[]}
      editor={{ id: null }}
      onEdit={() => {}}
      onClose={() => {}}
      onSaved={() => {}}
    >
      <header>Gaming</header>
    </Workspace>,
  );
  expect(html).toContain("Local collection editor");
  expect(html).toContain('aria-labelledby="editor-title"');
  expect(html).not.toContain("Games to edit");
  expect(html).not.toContain('role="dialog"');
});

it("editor.actions: puts save at the top and remove in a bottom bar, and confirms removal in a dialog", () => {
  const game = createGameDraft(null);
  const html = renderToStaticMarkup(
    <GameForm
      game={{ id: "hades", title: "Hades", release: { precision: "unknown" } } as Game}
      draft={{ ...game, id: "hades", title: "Hades" }}
      onChange={() => {}}
      busy={false}
      onSave={async () => {}}
      onDelete={async () => {}}
      onDirty={() => {}}
      onClose={() => {}}
      saveError="Could not save"
      notice=""
    />,
  );
  expect(html.indexOf("Save game")).toBeLessThan(html.indexOf('id="title"'));
  expect(html.indexOf("Remove")).toBeGreaterThan(html.indexOf('id="title"'));
  expect(html.indexOf("Could not save")).toBeLessThan(html.indexOf('id="title"'));
  expect(html).not.toContain("Yes, remove");
});

const form = (draft: GameDraft) =>
  renderToStaticMarkup(
    <GameForm
      game={null}
      draft={draft}
      onChange={() => {}}
      busy={false}
      onSave={async () => {}}
      onDelete={async () => {}}
      onDirty={() => {}}
      onClose={() => {}}
      saveError=""
      notice=""
    />,
  );
const order = (html: string, ids: string[]) =>
  ids
    .map((id) => html.indexOf(`id="${id}"`))
    .every((at, index, all) => at > (all[index - 1] ?? -1));

it("editor.layout: previews the cover and orders release, rating, and review fields", () => {
  const blank = form({ ...createGameDraft(null), precision: "day" });
  expect(blank).toContain("No cover yet");
  expect(order(blank, ["precision", "release-year", "release-month", "release-day"])).toBe(true);
  expect(order(blank, ["hype", "score", "play"])).toBe(true);
  expect(blank).not.toContain('id="review"');

  const played = form({ ...createGameDraft(null), cover: "/covers/hades.jpg", play: "played" });
  expect(played).toContain('src="/covers/hades.jpg"');
  expect(
    order(played, [
      "review",
      "review-amazing",
      "review-nice",
      "review-questionable",
      "review-terrible",
    ]),
  ).toBe(true);
});
