import { createServer, request, type Server } from "node:http";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { createGameAgent } from "./game-agent";
import type { AgentSnapshot } from "../src/games/agent-protocol";

let server: Server;
let base: string;
let agent: ReturnType<typeof createGameAgent>;
const snapshot: AgentSnapshot = {
  conversationId: 1,
  model: "faux/test",
  thinkingLevel: "medium",
  unavailableModels: [],
  models: [
    { id: "faux/test", name: "Test model", defaultThinking: "medium", thinkingLevels: ["medium"] },
  ],
  busy: false,
  messages: [],
};
const runtime = {
  snapshot: vi.fn(async () => snapshot),
  execute: vi.fn(async () => snapshot),
  close: vi.fn(async () => {}),
};
const open = vi.fn(async () => runtime);
beforeEach(async () => {
  vi.clearAllMocks();
  agent = createGameAgent("/unused", "test", open);
  server = createServer((req, res) => {
    void agent.handle(req, res, () => {
      res.writeHead(404);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No test server address.");
  base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve) => server.close(() => resolve()));
  await agent.close();
});
async function token() {
  return (await (await fetch(`${base}/__dev/agent`)).json()).token as string;
}
async function post(body: unknown, auth = "missing", origin = base) {
  return fetch(`${base}/__dev/agent`, {
    method: "POST",
    headers: { Origin: origin, "Content-Type": "application/json", "X-Gaming-Agent": auth },
    body: JSON.stringify(body),
  });
}

it("agent.safety: initializes lazily and requires the per-server token for conversations", async () => {
  const auth = await token();
  expect(open).not.toHaveBeenCalled();
  expect((await post({ action: "open", key: "game" })).status).toBe(403);
  expect((await fetch(`${base}/__dev/agent?conversationId=1`)).status).toBe(403);
  const response = await post({ action: "open", key: "game" }, auth);
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual(snapshot);
  expect(open).toHaveBeenCalledTimes(1);
  expect(
    (await fetch(`${base}/__dev/agent?conversationId=1`, { headers: { "X-Gaming-Agent": auth } }))
      .status,
  ).toBe(200);
  expect(open).toHaveBeenCalledTimes(1);
});
it("agent.safety: refuses cross-origin and DNS-rebinding requests before opening the runtime", async () => {
  const auth = await token();
  expect((await post({ action: "open", key: "game" }, auth, "https://evil.example")).status).toBe(
    403,
  );
  expect(
    (await fetch(`${base}/__dev/agent`, { headers: { "Sec-Fetch-Site": "cross-site" } })).status,
  ).toBe(403);
  const rebound = await new Promise<number | undefined>((resolve, reject) => {
    request(`${base}/__dev/agent`, { headers: { Host: "evil.example" } }, (response) => {
      response.resume();
      resolve(response.statusCode);
    })
      .on("error", reject)
      .end();
  });
  expect(rebound).toBe(403);
  expect(open).not.toHaveBeenCalled();
});
it("agent.safety: validates and bounds requests and never accepts file paths or URLs to download", async () => {
  const auth = await token();
  expect(
    (
      await post(
        { action: "cover", conversationId: 1, url: "https://localhost", path: "../../bad" },
        auth,
      )
    ).status,
  ).toBe(400);
  expect((await post({ action: "open", key: "../bad" }, auth)).status).toBe(400);
  expect((await post({ action: "open", key: "x".repeat(32_001) }, auth)).status).toBe(413);
  expect((await fetch(`${base}/__dev/agent`, { method: "DELETE" })).status).toBe(405);
  expect((await fetch(`${base}/unrelated`)).status).toBe(404);
  expect(open).not.toHaveBeenCalled();
});
