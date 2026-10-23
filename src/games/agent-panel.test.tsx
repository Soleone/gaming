import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vite-plus/test";
import { AgentPanel, type AgentMessage } from "@/components/soleone/agent";

const step = (id: string, label: string) => ({
  id,
  name: "search_web",
  label,
  status: "complete" as const,
});

it("agent.steps: groups adjacent steps of one reply into one trace and splits them at text", () => {
  const messages: AgentMessage[] = [
    { id: "1", role: "user", text: "Research" },
    { id: "2", role: "assistant", text: "", tools: [step("a", "Searched the web")] },
    { id: "3", role: "assistant", text: "", tools: [step("b", "Read publisher.example")] },
    {
      id: "4",
      role: "assistant",
      text: "Found the release date.",
      tools: [step("c", "Proposed A game")],
    },
  ];
  const html = renderToStaticMarkup(
    <AgentPanel
      messages={messages}
      prompt=""
      onPromptChange={() => {}}
      busy={false}
      onSend={async () => true}
      onStop={() => {}}
    />,
  );
  expect(html.match(/data-slot="trace"/g)).toHaveLength(2);
  expect(html.match(/data-slot="message"/g)).toHaveLength(2);
  expect(html.indexOf("Read publisher.example")).toBeLessThan(
    html.indexOf("Found the release date."),
  );
  expect(html.indexOf("Found the release date.")).toBeLessThan(html.indexOf("Proposed A game"));
});
