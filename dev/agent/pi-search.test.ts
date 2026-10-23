import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, afterEach, beforeAll, beforeEach, expect, it, vi } from "vite-plus/test";
import { ModelRegistry, ModelRuntime } from "@earendil-works/pi-coding-agent";
import { createPiSearch } from "./pi-search";

const mock = vi.hoisted(() => {
  const engine = { search: vi.fn(), normalizeSearchProviderSelection: (value: unknown) => value };
  return {
    raw: "{}" as string | null,
    engine,
    load: vi.fn(async (name: string) =>
      name.endsWith("utils.ts")
        ? { getWebSearchConfigPath: () => "/test/web-search.json" }
        : engine,
    ),
  };
});
vi.mock("jiti", () => ({ createJiti: () => ({ import: mock.load }) }));
vi.mock("node:fs", async (original) => {
  const fs = await original<typeof import("node:fs")>();
  return {
    ...fs,
    existsSync: (path: string) =>
      path === "/test/web-search.json" ? mock.raw !== null : fs.existsSync(path),
    readFileSync: (path: string, encoding: "utf8") =>
      path === "/test/web-search.json" ? mock.raw : fs.readFileSync(path, encoding),
  };
});
let directory: string;
let models: ModelRuntime;
beforeAll(async () => {
  directory = await mkdtemp(join(tmpdir(), "gaming-search-"));
  models = await ModelRuntime.create({
    refreshOnCreate: false,
    modelsPath: null,
    modelsStorePath: join(directory, "models.json"),
    credentials: {
      read: async () => undefined,
      list: async () => [],
      modify: async () => undefined,
      delete: async () => undefined,
    },
  });
});
afterAll(async () => {
  await rm(directory, { recursive: true, force: true });
});
beforeEach(() => {
  vi.stubEnv("EXA_API_KEY", "");
  mock.raw = "{}";
  mock.engine.search.mockResolvedValue({
    provider: "exa",
    answer: "A sourced summary.",
    results: [
      {
        title: "Announcement",
        url: "https://publisher.example/announcement",
        snippet: "The official announcement.",
      },
    ],
  });
});
afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

it("agent.research: reuses explicitly configured keyless Exa through the host-neutral Pi engine", async () => {
  mock.raw = JSON.stringify({ provider: "exa" });
  const search = await createPiSearch(models);
  const result = await search("Control Resonant official release");
  expect(result.provider).toBe("exa");
  expect(mock.engine.search).toHaveBeenCalledWith(
    "Control Resonant official release",
    expect.objectContaining({ provider: "exa", numResults: 6 }),
  );
  expect(mock.load.mock.calls.map(([name]) => name)).toEqual([
    import.meta.resolve("pi-web-access/utils.ts"),
    import.meta.resolve("pi-web-access/gemini-search.ts"),
  ]);
});
it("agent.research: defaults unconfigured search to OpenAI with the existing Pi credential registry", async () => {
  mock.raw = null;
  const search = await createPiSearch(models);
  const model = models.getModels()[0]!;
  await search("A game", undefined, { provider: model.provider, modelId: model.id });
  expect(mock.engine.search).toHaveBeenCalledWith(
    "A game",
    expect.objectContaining({
      provider: "openai",
      extensionContext: { modelRegistry: expect.any(ModelRegistry), model },
    }),
  );
});
it("agent.research: uses a configured Exa key and preserves explicit Pi routing instead of inventing another route", async () => {
  vi.stubEnv("EXA_API_KEY", "test-exa-key");
  await (
    await createPiSearch(models)
  )("A game");
  expect(mock.engine.search.mock.calls[0]?.[1].provider).toBe("exa");
  mock.raw = JSON.stringify({
    searchRouting: { providers: ["exa", "openai"], fallbackOn: ["quota", "network"] },
  });
  await (
    await createPiSearch(models)
  )("A game");
  expect(mock.engine.search.mock.calls[1]?.[1].provider).toBe("auto");
});
it("agent.research: bounds summaries and results, removes duplicates and unsafe source URLs", async () => {
  const results = Array.from({ length: 9 }, (_, index) => ({
    title: "x".repeat(500),
    url: `https://publisher.example/${index}`,
    snippet: "y".repeat(2000),
  }));
  mock.engine.search.mockResolvedValue({
    provider: "openai",
    answer: "z".repeat(12000),
    results: [
      { ...results[0], url: "https://127.0.0.1/private" },
      { ...results[0], url: "http://publisher.example/insecure" },
      results[0],
      ...results,
    ],
  });
  const result = await (await createPiSearch(models))("A game");
  expect(result.answer).toHaveLength(8000);
  expect(result.results).toHaveLength(6);
  expect(result.results[0]).toEqual({
    title: "x".repeat(200),
    url: "https://publisher.example/0",
    snippet: "y".repeat(1000),
  });
  expect(new Set(result.results.map((item) => item.url)).size).toBe(6);
});
it("agent.credentials: refuses search credential commands before loading provider code", async () => {
  mock.raw = JSON.stringify({ provider: "exa", exaApiKey: "!do-not-run-this" });
  await expect(createPiSearch(models)).rejects.toThrow("Command-based web-search credentials");
  expect(mock.engine.search).not.toHaveBeenCalled();
  expect(mock.load).toHaveBeenCalledTimes(1);
});
it("agent.credentials: malformed search config and provider errors never reveal key fragments", async () => {
  mock.raw = '{"exaApiKey":"private-secret", broken';
  await expect(createPiSearch(models)).rejects.toThrow("Pi's web-search.json is invalid");
  mock.raw = "{}";
  mock.engine.search.mockRejectedValue(
    Object.assign(new Error("private-secret"), { kind: "auth" }),
  );
  await expect((await createPiSearch(models))("A game")).rejects.toThrow(
    "Pi web search failed (openai, auth)",
  );
  await expect((await createPiSearch(models))("A game")).rejects.not.toThrow("private-secret");
});
it.each([
  "Exa search returned no results.",
  "Exa MCP rate limit reached (429).",
  "Exa MCP error 503: private-secret",
  "fetch failed",
])("agent.research: falls back to OpenAI through Pi credentials after %s", async (message) => {
  mock.raw = JSON.stringify({ provider: "exa" });
  mock.engine.search.mockRejectedValueOnce(new Error(message)).mockResolvedValueOnce({
    provider: "openai",
    answer: "A verified announcement.",
    results: [{ title: "Announcement", url: "https://publisher.example/game", snippet: "2026" }],
  });
  const search = await createPiSearch(models);
  const model = models.getModels()[0]!;
  const ref = { provider: model.provider, modelId: model.id };
  const result = await search("Onimusha 2026", undefined, ref);
  expect(result.provider).toBe("openai");
  expect(result.results).toHaveLength(1);
  expect(
    mock.engine.search.mock.calls.map(([query, options]) => [query, options.provider]),
  ).toEqual([
    ["Onimusha 2026", "exa"],
    ["Onimusha 2026", "openai"],
  ]);
  const primary = mock.engine.search.mock.calls[0]![1];
  expect(mock.engine.search.mock.calls[1]![1]).toEqual({
    ...primary,
    provider: "openai",
    extensionContext: { modelRegistry: expect.any(ModelRegistry), model },
  });
  await search("Another game", undefined, ref);
  expect(mock.engine.search.mock.calls[2]![1].provider).toBe("exa");
});
it.each([
  ["Exa search returned no results.", "invalid-response", "openai", 3],
  ["Exa MCP returned an empty response", "invalid-response", "openai", 3],
  ["fetch failed", "network", "openai", 3],
  ["Exa MCP error 503: private-secret", "transient, HTTP 503", "openai", 3],
  ["Exa MCP rate limit reached (429): private-secret", "quota, HTTP 429", "openai", 2],
  ["Exa API error 401: private-secret", "auth, HTTP 401", "exa", 1],
  ["Exa API error 400: private-secret", "invalid-request, HTTP 400", "exa", 1],
  ["private-secret", "unknown", "exa", 1],
])(
  "agent.research: safely reports %s with bounded recovery",
  async (message, reason, provider, calls) => {
    mock.raw = JSON.stringify({ provider: "exa" });
    mock.engine.search.mockRejectedValue(new Error(message));
    const request = (await createPiSearch(models))("A game");
    await expect(request).rejects.toThrow(`Pi web search failed (${provider}, ${reason})`);
    await expect(request).rejects.not.toThrow("private-secret");
    await expect(request).rejects.not.toThrow("Check the configured search provider and Pi login");
    expect(mock.engine.search).toHaveBeenCalledTimes(calls);
  },
);
it("agent.research: reports OpenAI credential failure if the Exa fallback cannot authenticate", async () => {
  mock.raw = JSON.stringify({ provider: "exa" });
  mock.engine.search
    .mockRejectedValueOnce(Object.assign(new Error("private-exa-secret"), { kind: "quota" }))
    .mockRejectedValue(
      Object.assign(new Error("private-openai-secret"), { kind: "auth", status: 401 }),
    );
  const request = (await createPiSearch(models))("A game");
  await expect(request).rejects.toThrow("Pi web search failed (openai, auth, HTTP 401)");
  await expect(request).rejects.not.toThrow("private-");
  expect(mock.engine.search).toHaveBeenCalledTimes(2);
});
it("agent.research: preserves explicit Pi routing instead of adding another fallback", async () => {
  mock.raw = JSON.stringify({
    searchRouting: { providers: ["exa", "brave"], fallbackOn: ["quota"] },
  });
  mock.engine.search.mockRejectedValue(Object.assign(new Error("quota"), { kind: "quota" }));
  await expect((await createPiSearch(models))("A game")).rejects.toThrow("(auto, quota)");
  expect(mock.engine.search).toHaveBeenCalledTimes(1);
});
it("agent.research: cancellation after Exa fails prevents the OpenAI fallback", async () => {
  mock.raw = JSON.stringify({ provider: "exa" });
  const controller = new AbortController();
  mock.engine.search.mockImplementationOnce(async () => {
    controller.abort();
    throw new Error("Exa MCP rate limit reached (429).");
  });
  await expect((await createPiSearch(models))("A game", controller.signal)).rejects.toHaveProperty(
    "name",
    "AbortError",
  );
  expect(mock.engine.search).toHaveBeenCalledTimes(1);
});
it("agent.research: never retries a structured quota error", async () => {
  mock.engine.search.mockRejectedValue(
    Object.assign(new Error("private-secret"), { kind: "quota" }),
  );
  await expect((await createPiSearch(models))("A game")).rejects.toThrow("rate-limiting");
  expect(mock.engine.search).toHaveBeenCalledTimes(1);
});
it("agent.research: cancellation during recovery prevents the second provider request", async () => {
  const controller = new AbortController();
  mock.engine.search.mockImplementationOnce(async () => {
    setTimeout(() => controller.abort(), 0);
    throw new Error("Exa search returned no results.");
  });
  await expect((await createPiSearch(models))("A game", controller.signal)).rejects.toHaveProperty(
    "name",
    "AbortError",
  );
  expect(mock.engine.search).toHaveBeenCalledTimes(1);
});
it("agent.research: respects disabled Pi web search without issuing a provider request", async () => {
  mock.raw = JSON.stringify({ webSearch: { enabled: false } });
  await expect((await createPiSearch(models))("A game")).rejects.toThrow("disabled");
  expect(mock.engine.search).not.toHaveBeenCalled();
});
it("agent.research: forwards cancellation rather than reporting a provider failure", async () => {
  mock.engine.search.mockImplementation(
    (_query, options) =>
      new Promise((_resolve, reject) => {
        options.signal.addEventListener("abort", () => reject(new Error("provider interrupted")), {
          once: true,
        });
      }),
  );
  const search = await createPiSearch(models);
  const controller = new AbortController();
  const request = search("A game", controller.signal);
  controller.abort();
  await expect(request).rejects.toHaveProperty("name", "AbortError");
});
it("agent.research: reports genuinely empty search results after one retry without claiming discovery succeeded", async () => {
  mock.engine.search.mockResolvedValue({ provider: "exa", answer: "", results: [] });
  await expect((await createPiSearch(models))("A game")).rejects.toThrow(
    "no usable results after one retry",
  );
  expect(mock.engine.search).toHaveBeenCalledTimes(2);
});
it("agent.network: does not retry results rejected by public URL validation", async () => {
  mock.engine.search.mockResolvedValue({
    provider: "exa",
    answer: "A summary is not a verified source.",
    results: [{ title: "Private", url: "https://127.0.0.1/private", snippet: "" }],
  });
  await expect((await createPiSearch(models))("A game")).rejects.toThrow(
    "no usable public HTTPS sources",
  );
  expect(mock.engine.search).toHaveBeenCalledTimes(1);
});
