import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vite-plus/test";
import { GameSearch } from "./GameSearch";

it("calendar.search: shows the / shortcut in the empty field", () => {
  const markup = renderToStaticMarkup(<GameSearch games={[]} onPick={() => {}} />);
  expect(markup).toContain('aria-label="Search games"');
  expect(markup).toMatch(/<kbd[^>]*>\/<\/kbd>/);
});
