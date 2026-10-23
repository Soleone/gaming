import { createJiti } from "jiti";
import { afterEach, expect, it, vi } from "vite-plus/test";

const loader = createJiti(import.meta.url);
const { callExaMcp } = await loader.import<{
  callExaMcp: (
    tool: string,
    args: Record<string, unknown>,
    signal?: AbortSignal,
  ) => Promise<string>;
}>(import.meta.resolve("pi-web-access/exa.ts"));

afterEach(() => vi.restoreAllMocks());

it.each(["json", "sse"])(
  "agent.research: treats Exa's HTTP 200 free-tier rate-limit notice as quota failure (%s)",
  async (transport) => {
    const payload = JSON.stringify({
      result: {
        content: [{ type: "text", text: "You've hit Exa's free MCP rate limit. private-secret" }],
      },
    });
    const request = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(transport === "sse" ? `data: ${payload}\n\n` : payload, {
        status: 200,
        headers: { "Content-Type": transport === "sse" ? "text/event-stream" : "application/json" },
      }),
    );
    const result = callExaMcp("web_search_exa", { query: "Onimusha 2026", numResults: 6 });
    await expect(result).rejects.toThrow("Exa MCP rate limit reached (429)");
    await expect(result).rejects.not.toThrow("private-secret");
    expect(request).toHaveBeenCalledTimes(1);
  },
);

it("agent.research: preserves normal Exa result text that happens to mention rate limits", async () => {
  const text =
    "Title: Rate limits in games\nURL: https://publisher.example/game\nText: An announcement.";
  vi.spyOn(globalThis, "fetch").mockResolvedValue(
    new Response(JSON.stringify({ result: { content: [{ type: "text", text }] } })),
  );
  await expect(callExaMcp("web_search_exa", { query: "A game" })).resolves.toBe(text);
});
