import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vite-plus/test";
import Workspace from "./Workspace";

it("agent.sidebar: exposes a single collapsed agent launcher outside the editor", () => {
  const html = renderToStaticMarkup(
    <Workspace editor={null} onEdit={() => {}} onClose={() => {}} onSaved={() => {}}>
      <main>Calendar</main>
    </Workspace>,
  );
  expect(html).toContain("Calendar");
  expect(html.match(/aria-label="Open agent"/g)).toHaveLength(1);
  expect(html).not.toContain('aria-label="Agent conversation"');
  expect(html).not.toContain("Research with agent");
});
it("agent.sidebar: renders the draft editor beside the dock, not in a focus-blocking modal", () => {
  const html = renderToStaticMarkup(
    <Workspace editor={{ id: null }} onEdit={() => {}} onClose={() => {}} onSaved={() => {}}>
      <header>Gaming</header>
    </Workspace>,
  );
  expect(html).toContain("Local collection editor");
  expect(html).toContain('aria-labelledby="editor-title"');
  expect(html).not.toContain('role="dialog"');
});
