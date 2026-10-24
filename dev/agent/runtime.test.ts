import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import sharp from "sharp";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { BACKGROUND_CONTEXT } from "@earendil-works/chord/context";
import {
  createModels,
  fauxAssistantMessage,
  fauxProvider,
  fauxText,
  fauxToolCall,
} from "@earendil-works/pi-ai";
import { createRegistry, Harness, MemoryStorage, type Storage } from "@earendil-works/pi-durable";
import { openNodeSqliteStorage } from "@earendil-works/pi-durable/storage/sqlite/node";
import { agentSnapshotSchema } from "../../src/games/agent-protocol";
import { fetchPublic } from "./public-web";
import { gameResearchExtension } from "./research-tools";
import type { GameWebSearch } from "./pi-search";
import { createGamingRuntime } from "./runtime";

vi.mock("./public-web", async (original) => ({
  ...(await original<typeof import("./public-web")>()),
  fetchPublic: vi.fn(),
}));

let directory: string;
let harness: Harness;
let runtime: ReturnType<typeof createGamingRuntime>;
let faux: ReturnType<typeof fauxProvider>;
let models: ReturnType<typeof createModels>;
const search = vi.fn<GameWebSearch>();
const proposal = {
  title: "A verified game",
  release: { precision: "quarter", year: 2027, quarter: 2 },
  source: "https://publisher.example/game",
  summary: "The publisher announced Q2, not an exact date.",
  covers: [
    {
      url: "https://publisher.example/cover.png",
      source: "https://publisher.example/game",
      label: "Publisher artwork",
    },
  ],
};

async function openRuntime(storage: Storage = new MemoryStorage()) {
  const registry = createRegistry();
  registry.install(gameResearchExtension(search));
  harness = await Harness.open(storage, { models, registry }, BACKGROUND_CONTEXT);
  runtime = createGamingRuntime(
    harness,
    { provider: faux.provider.id, modelId: faux.getModel().id },
    join(directory, "covers"),
    faux.models.map((model) => ({
      id: `${faux.provider.id}/${model.id}`,
      name: model.name,
      defaultThinking: "medium",
      thinkingLevels: ["off", "low", "medium", "high"],
    })),
    [],
  );
}

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "gaming-agent-"));
  faux = fauxProvider({
    models: [
      { id: "primary", reasoning: true },
      { id: "alternate", reasoning: true },
    ],
  });
  models = createModels();
  models.setProvider(faux.provider);
  search.mockResolvedValue({
    provider: "exa",
    answer: "The publisher announced Q2 2027.",
    results: [{ title: "Game announcement", url: proposal.source, snippet: "Q2 2027" }],
  });
  const image = await sharp({ create: { width: 800, height: 450, channels: 3, background: "red" } })
    .png()
    .toBuffer();
  vi.mocked(fetchPublic).mockImplementation(async (url) => {
    if (url === "https://publisher.example/cover.png")
      return { url, body: image, contentType: "image/png" };
    return {
      url,
      contentType: "text/html",
      body: Buffer.from(
        '<title>A verified game</title><meta property="og:image" content="/cover.png"><main>The publisher announces Q2 2027.<a href="/announcement">Release announcement</a><a href="https://127.0.0.1/private">Unsafe link</a></main>',
      ),
    };
  });
  await openRuntime();
});
afterEach(async () => {
  await runtime.close();
  await rm(directory, { recursive: true, force: true });
  vi.clearAllMocks();
});

async function research() {
  faux.setResponses([
    fauxAssistantMessage(
      [fauxToolCall("search_web", { query: "A verified game official release" })],
      { stopReason: "toolUse" },
    ),
    fauxAssistantMessage([fauxToolCall("read_page", { url: proposal.source })], {
      stopReason: "toolUse",
    }),
    fauxAssistantMessage([fauxToolCall("propose_game", proposal)], { stopReason: "toolUse" }),
    fauxAssistantMessage([fauxText("Ready to save.")]),
  ]);
  const opened = agentSnapshotSchema.parse(
    await runtime.execute({ action: "open", key: "new-game" }),
  );
  const request = {
    action: "send" as const,
    conversationId: opened.conversationId,
    requestId: crypto.randomUUID(),
    text: "Find facts and a cover",
    draft: { title: "A game", release: "unknown", source: "" },
    collection: ["A game"],
  };
  await runtime.execute(request);
  await harness.waitForIdle(BACKGROUND_CONTEXT);
  return { snapshot: await runtime.snapshot(opened.conversationId), request };
}

it("agent.research: searches, verifies, and presents a typed proposal without writing collection data or covers", async () => {
  const { snapshot, request } = await research();
  expect(snapshot.busy).toBe(false);
  expect(
    snapshot.messages.filter((message) => message.role === "user").map((message) => message.text),
  ).toEqual(["Find facts and a cover"]);
  const tools = snapshot.messages.flatMap((message) => message.tools ?? []);
  expect(tools.map((tool) => [tool.name, tool.status])).toEqual([
    ["search_web", "complete"],
    ["read_page", "complete"],
    ["propose_game", "complete"],
  ]);
  expect(tools.at(-1)?.data).toEqual({ proposal });
  expect(search).toHaveBeenCalledWith(
    "A verified game official release",
    expect.any(AbortSignal),
    expect.objectContaining({ provider: faux.provider.id }),
  );
  expect(tools[1]?.output).toContain(
    '"links":[{"title":"Release announcement","url":"https://publisher.example/announcement"}]',
  );
  expect(tools[0]?.output).toContain("https://publisher.example/game");
  expect(await readdir(directory)).toEqual([]);
  await runtime.execute(request);
  await harness.waitForIdle(BACKGROUND_CONTEXT);
  expect(faux.state.callCount).toBe(4);
});
it("agent.proposal: proposes several requested games in one message, each saved on its own", async () => {
  const other = {
    ...proposal,
    title: "Another verified game",
    source: "https://publisher.example/other",
    covers: [],
  };
  faux.setResponses([
    fauxAssistantMessage(
      [
        fauxToolCall("read_page", { url: proposal.source }),
        fauxToolCall("read_page", { url: other.source }),
      ],
      { stopReason: "toolUse" },
    ),
    fauxAssistantMessage(
      [fauxToolCall("propose_game", proposal), fauxToolCall("propose_game", other)],
      { stopReason: "toolUse" },
    ),
    fauxAssistantMessage([fauxText("Both are ready to save.")]),
  ]);
  const opened = agentSnapshotSchema.parse(await runtime.execute({ action: "open", key: "batch" }));
  await runtime.execute({
    action: "send",
    conversationId: opened.conversationId,
    requestId: crypto.randomUUID(),
    text: "Add both games",
    draft: null,
    collection: [],
  });
  await harness.waitForIdle(BACKGROUND_CONTEXT);
  const proposals = (await runtime.snapshot(opened.conversationId)).messages
    .flatMap((message) => message.tools ?? [])
    .filter((tool) => tool.name === "propose_game");
  expect(proposals.map((tool) => [tool.status, tool.data])).toEqual([
    ["complete", { proposal }],
    ["complete", { proposal: other }],
  ]);
  expect(
    await runtime.execute({
      action: "cover",
      conversationId: opened.conversationId,
      toolId: proposals[0]!.id,
      index: 0,
    }),
  ).toHaveProperty("cover");
});
it("agent.research: offers full-size page images with their alt text instead of blurred placeholders or small fallbacks", async () => {
  vi.mocked(fetchPublic).mockResolvedValue({
    url: proposal.source,
    contentType: "text/html",
    body: Buffer.from(
      '<main>Out now.<img aria-hidden="true" alt="Game" src="/hero.png?w=54&thumb=true"><img alt="ESRB Mature" src="/rating.png"><picture><source srcset="/banner-4000.jpg" media="(min-width: 3000px)"><source srcset="/banner-1600.jpg" media="(min-width: 1024px)"><noscript><img alt="Key art" src="/banner-100.jpg"></noscript></picture><img alt="Wallpaper" src="/wall-small.jpg" srcset="/wall-small.jpg 480w, /wall-large.jpg 1920w, /wall-medium.jpg 1280w"><noscript><img alt="Game hero" src="/hero.png"></noscript></main>',
    ),
  });
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall("read_page", { url: proposal.source })], {
      stopReason: "toolUse",
    }),
    fauxAssistantMessage([fauxText("Found the hero art.")]),
  ]);
  const opened = agentSnapshotSchema.parse(
    await runtime.execute({ action: "open", key: "images" }),
  );
  await runtime.execute({
    action: "send",
    conversationId: opened.conversationId,
    requestId: crypto.randomUUID(),
    text: "Find art",
    draft: null,
    collection: [],
  });
  await harness.waitForIdle(BACKGROUND_CONTEXT);
  const read = (await runtime.snapshot(opened.conversationId)).messages.flatMap(
    (message) => message.tools ?? [],
  )[0]!;
  expect(JSON.parse(read.output!).images).toEqual([
    { url: "https://publisher.example/rating.png", alt: "ESRB Mature", source: proposal.source },
    { url: "https://publisher.example/banner-4000.jpg", alt: "Key art", source: proposal.source },
    { url: "https://publisher.example/wall-large.jpg", alt: "Wallpaper", source: proposal.source },
    { url: "https://publisher.example/hero.png", alt: "Game hero", source: proposal.source },
  ]);
});
it("agent.steps: titles each step by its status and subject", async () => {
  const { snapshot } = await research();
  expect(
    snapshot.messages.flatMap((message) => message.tools ?? []).map((tool) => tool.label),
  ).toEqual([
    "Searched for “A verified game official release”",
    `Read ${new URL(proposal.source).hostname}`,
    `Proposed ${proposal.title}`,
  ]);
});
it("agent.persistence: researches another game after reset with the same model and search access", async () => {
  const first = await research();
  const reset = agentSnapshotSchema.parse(
    await runtime.execute({ action: "reset", conversationId: first.snapshot.conversationId }),
  );
  expect(reset.messages).toEqual([]);
  expect(reset.model).toBe(first.snapshot.model);
  expect(reset.thinkingLevel).toBe(first.snapshot.thinkingLevel);
  const second = await research();
  expect(second.snapshot.conversationId).toBe(first.snapshot.conversationId);
  expect(
    second.snapshot.messages.flatMap((message) => message.tools ?? []).map((tool) => tool.status),
  ).toEqual(["complete", "complete", "complete"]);
  expect(search).toHaveBeenCalledTimes(2);
  expect(search.mock.calls[1]?.[2]).toEqual(search.mock.calls[0]?.[2]);
});
it("agent.models: persists model effort through reopening and reset, rejecting unsupported selections", async () => {
  const opened = agentSnapshotSchema.parse(
    await runtime.execute({ action: "open", key: "collection" }),
  );
  expect(opened.thinkingLevel).toBe("medium");
  const configure = {
    action: "configure" as const,
    conversationId: opened.conversationId,
    model: opened.models.find((model) => model.id !== opened.model)!.id,
    thinkingLevel: "high" as const,
  };
  await runtime.execute(configure);
  expect((await runtime.snapshot(opened.conversationId)).model).toBe(configure.model);
  expect((await runtime.snapshot(opened.conversationId)).thinkingLevel).toBe("high");
  await runtime.execute({ action: "open", key: "collection" });
  expect((await runtime.snapshot(opened.conversationId)).thinkingLevel).toBe("high");
  await expect(runtime.execute({ ...configure, model: "other/not-scoped" })).rejects.toThrow(
    "scoped Pi model",
  );
  await expect(runtime.execute({ ...configure, thinkingLevel: "max" })).rejects.toThrow(
    "supported effort",
  );
  await runtime.execute({ action: "reset", conversationId: opened.conversationId });
  expect((await runtime.snapshot(opened.conversationId)).thinkingLevel).toBe("high");
});

it("agent.cover: downloads only a chosen candidate, normalizes it, and never overwrites another file", async () => {
  const { snapshot } = await research();
  const tool = snapshot.messages
    .flatMap((message) => message.tools ?? [])
    .find((tool) => tool.name === "propose_game")!;
  const request = {
    action: "cover" as const,
    conversationId: snapshot.conversationId,
    toolId: tool.id,
    index: 0,
  };
  const result = await runtime.execute(request);
  expect(result).toHaveProperty("cover");
  const files = await readdir(join(directory, "covers"));
  expect(files).toHaveLength(1);
  expect(files[0]).toMatch(/^agent-[a-f0-9]+\.webp$/);
  expect(
    (await sharp(await readFile(join(directory, "covers", files[0]!))).metadata()).format,
  ).toBe("webp");
  expect(await runtime.execute(request)).toEqual(result);
  expect(await readdir(join(directory, "covers"))).toEqual(files);
  await expect(runtime.execute({ ...request, toolId: "not-a-proposal" })).rejects.toThrow(
    "completed proposal",
  );
});
it("agent.cover: downsizes 4K key art to a 1600px WebP", async () => {
  const { snapshot } = await research();
  const tool = snapshot.messages
    .flatMap((message) => message.tools ?? [])
    .find((tool) => tool.name === "propose_game")!;
  vi.mocked(fetchPublic).mockResolvedValue({
    url: proposal.covers[0]!.url,
    body: await sharp({ create: { width: 3840, height: 2160, channels: 4, background: "red" } })
      .png()
      .toBuffer(),
    contentType: "image/png",
  });
  await runtime.execute({
    action: "cover",
    conversationId: snapshot.conversationId,
    toolId: tool.id,
    index: 0,
  });
  const [file] = await readdir(join(directory, "covers"));
  const metadata = await sharp(await readFile(join(directory, "covers", file!))).metadata();
  expect([metadata.format, metadata.width, metadata.height]).toEqual(["webp", 1600, 900]);
});
it("agent.proposal: refuses unsupported facts and fabricated image candidates", async () => {
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall("propose_game", proposal)], { stopReason: "toolUse" }),
    fauxAssistantMessage([fauxText("I could not verify that source.")]),
  ]);
  const opened = agentSnapshotSchema.parse(
    await runtime.execute({ action: "open", key: "unverified" }),
  );
  await runtime.execute({
    action: "send",
    conversationId: opened.conversationId,
    requestId: crypto.randomUUID(),
    text: "Research",
    draft: { title: "Game", release: "unknown", source: "" },
    collection: [],
  });
  await harness.waitForIdle(BACKGROUND_CONTEXT);
  const snapshot = await runtime.snapshot(opened.conversationId);
  expect(snapshot.messages.flatMap((message) => message.tools ?? [])[0]?.status).toBe("error");
  expect(await readdir(directory)).toEqual([]);
});
it("agent.cover: rejects SVG and invalid image bytes before creating a file", async () => {
  const { snapshot } = await research();
  const tool = snapshot.messages
    .flatMap((message) => message.tools ?? [])
    .find((tool) => tool.name === "propose_game")!;
  vi.mocked(fetchPublic).mockResolvedValue({
    url: proposal.covers[0]!.url,
    body: Buffer.from("<svg></svg>"),
    contentType: "image/svg+xml",
  });
  await expect(
    runtime.execute({
      action: "cover",
      conversationId: snapshot.conversationId,
      toolId: tool.id,
      index: 0,
    }),
  ).rejects.toThrow("SVG");
  vi.mocked(fetchPublic).mockResolvedValue({
    url: proposal.covers[0]!.url,
    body: Buffer.from("not an image"),
    contentType: "image/png",
  });
  await expect(
    runtime.execute({
      action: "cover",
      conversationId: snapshot.conversationId,
      toolId: tool.id,
      index: 0,
    }),
  ).rejects.toThrow();
  expect(await readdir(directory)).toEqual([]);
});
it("agent.cover: refuses thumbnails too small to use as a cover", async () => {
  const { snapshot } = await research();
  const tool = snapshot.messages
    .flatMap((message) => message.tools ?? [])
    .find((tool) => tool.name === "propose_game")!;
  vi.mocked(fetchPublic).mockResolvedValue({
    url: proposal.covers[0]!.url,
    body: await sharp({ create: { width: 100, height: 38, channels: 3, background: "red" } })
      .png()
      .toBuffer(),
    contentType: "image/png",
  });
  await expect(
    runtime.execute({
      action: "cover",
      conversationId: snapshot.conversationId,
      toolId: tool.id,
      index: 0,
    }),
  ).rejects.toThrow("only 100px wide");
  expect(await readdir(directory)).toEqual([]);
});
it("agent.research: stops a tool loop after 30 calls and allows a new follow-up", async () => {
  faux.setResponses(
    Array.from({ length: 31 }, () =>
      fauxAssistantMessage([fauxToolCall("search_web", { query: "A game official release" })], {
        stopReason: "toolUse",
      }),
    ),
  );
  const opened = agentSnapshotSchema.parse(
    await runtime.execute({ action: "open", key: "bounded" }),
  );
  const request = {
    action: "send" as const,
    conversationId: opened.conversationId,
    requestId: crypto.randomUUID(),
    text: "Research",
    draft: { title: "Game", release: "unknown", source: "" },
    collection: [],
  };
  await runtime.execute(request);
  await harness.waitForIdle(BACKGROUND_CONTEXT);
  const snapshot = await runtime.snapshot(opened.conversationId);
  expect(snapshot.busy).toBe(false);
  expect(search).toHaveBeenCalledTimes(30);
  expect(snapshot.messages.flatMap((message) => message.tools ?? []).at(-1)).toMatchObject({
    status: "error",
    output: expect.stringContaining("30 tool calls"),
  });
  faux.setResponses([
    fauxAssistantMessage([fauxToolCall("read_page", { url: proposal.source })], {
      stopReason: "toolUse",
    }),
    fauxAssistantMessage([fauxToolCall("propose_game", proposal)], { stopReason: "toolUse" }),
    fauxAssistantMessage([fauxText("Ready to save.")]),
  ]);
  await runtime.execute({
    ...request,
    requestId: crypto.randomUUID(),
    text: "Use this source instead",
  });
  await harness.waitForIdle(BACKGROUND_CONTEXT);
  expect(
    (await runtime.snapshot(opened.conversationId)).messages
      .flatMap((message) => message.tools ?? [])
      .at(-1)?.status,
  ).toBe("complete");
});

it("agent.persistence: Stop cancels an active model request without changing the game draft", async () => {
  const slow = fauxProvider({ models: [{ id: "primary", reasoning: true }], tokensPerSecond: 20 });
  models.setProvider(slow.provider);
  slow.setResponses([
    fauxAssistantMessage([
      fauxText("A long response that should be interrupted before it completes.".repeat(20)),
    ]),
  ]);
  const opened = agentSnapshotSchema.parse(
    await runtime.execute({ action: "open", key: "stoppable" }),
  );
  await runtime.execute({
    action: "send",
    conversationId: opened.conversationId,
    requestId: crypto.randomUUID(),
    text: "Research",
    draft: { title: "Game", release: "unknown", source: "" },
    collection: [],
  });
  expect((await runtime.snapshot(opened.conversationId)).busy).toBe(true);
  await expect(
    runtime.execute({
      action: "configure",
      conversationId: opened.conversationId,
      model: opened.model,
      thinkingLevel: "high",
    }),
  ).rejects.toThrow("Stop the agent");
  await runtime.execute({ action: "stop", conversationId: opened.conversationId });
  expect((await runtime.snapshot(opened.conversationId)).busy).toBe(false);
  expect(await readdir(directory)).toEqual([]);
});

it("agent.persistence: reopens the same draft conversation and its proposals from SQLite", async () => {
  await runtime.close();
  const database = join(directory, "agent.sqlite");
  await openRuntime(await openNodeSqliteStorage(database));
  const { snapshot } = await research();
  await runtime.execute({
    action: "configure",
    conversationId: snapshot.conversationId,
    model: snapshot.models.find((model) => model.id !== snapshot.model)!.id,
    thinkingLevel: "high",
  });
  await runtime.close();
  await openRuntime(await openNodeSqliteStorage(database));
  const reopened = agentSnapshotSchema.parse(
    await runtime.execute({ action: "open", key: "new-game" }),
  );
  expect(reopened.conversationId).toBe(snapshot.conversationId);
  expect(reopened.messages).toEqual(snapshot.messages);
  expect(reopened.thinkingLevel).toBe("high");
  expect(reopened.model).not.toBe(snapshot.model);
  await runtime.execute({ action: "reset", conversationId: reopened.conversationId });
  expect((await runtime.snapshot(reopened.conversationId)).messages).toEqual([]);
});
