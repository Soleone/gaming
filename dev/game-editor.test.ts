import { createServer, request, type Server } from "node:http";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vite-plus/test";
import { createGameEditor } from "./game-editor";

let directory: string;
let dataPath: string;
let coversDirectory: string;
let server: Server;
let base: string;

beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "gaming-editor-"));
  dataPath = join(directory, "games.json");
  coversDirectory = join(directory, "covers");
  await writeFile(dataPath, "[]\n");
  await mkdir(coversDirectory);
  const editor = createGameEditor(dataPath, coversDirectory);
  server = createServer((req, res) => {
    void editor(req, res, () => {
      res.writeHead(404);
      res.end();
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Could not start test server.");
  base = `http://127.0.0.1:${address.port}`;
});
afterEach(async () => {
  await new Promise<void>((resolve, reject) =>
    server.close((error) => (error ? reject(error) : resolve())),
  );
  await rm(directory, { recursive: true, force: true });
});
const game = {
  id: "test",
  title: "A game",
  cover: null,
  release: { precision: "quarter", year: 2007, quarter: 2 },
  source: null,
  hype: 4,
  review: { text: "A lovely surprise.", score: 9 },
};
async function session() {
  return (await fetch(`${base}/__dev/games`)).json();
}
async function save(token: string, revision: string, games: unknown, keepCover?: string) {
  return fetch(`${base}/__dev/games`, {
    method: "PUT",
    headers: { Origin: base, "Content-Type": "application/json", "X-Game-Editor": token },
    body: JSON.stringify({ revision, games, keepCover }),
  });
}

describe("local editor", () => {
  it("editor.save: adds, updates and removes games in the JSON source", async () => {
    const opened = await session();
    const added = await save(opened.token, opened.revision, [game]);
    expect(added.status).toBe(200);
    expect(JSON.parse(await readFile(dataPath, "utf8"))).toEqual([game]);
    const saved = await added.json();
    const updated = await save(saved.token, saved.revision, [{ ...game, title: "Updated" }]);
    expect(updated.status).toBe(200);
    const next = await updated.json();
    expect((await save(next.token, next.revision, [])).status).toBe(200);
    expect(JSON.parse(await readFile(dataPath, "utf8"))).toEqual([]);
  });
  it("editor.conflict: refuses to overwrite a file changed after opening", async () => {
    const opened = await session();
    await writeFile(dataPath, JSON.stringify([game]));
    expect((await save(opened.token, opened.revision, [])).status).toBe(409);
    expect(JSON.parse(await readFile(dataPath, "utf8"))).toEqual([game]);
  });
  it("editor.safety: rejects invalid data and missing session tokens without writing", async () => {
    const opened = await session();
    expect((await save("wrong", opened.revision, [game])).status).toBe(403);
    expect((await save(opened.token, opened.revision, [{ ...game, hype: 10 }])).status).toBe(400);
    expect((await save(opened.token, opened.revision, [game, game])).status).toBe(400);
    expect(await readFile(dataPath, "utf8")).toBe("[]\n");
  });
  it("agent.cleanup: a save removes agent covers that nothing references, and only those", async () => {
    const used = "agent-aaaaaaaaaaaaaaaaaaaaaaaa.webp";
    const drafted = "agent-bbbbbbbbbbbbbbbbbbbbbbbb.webp";
    const orphan = "agent-cccccccccccccccccccccccc.webp";
    for (const file of [used, drafted, orphan, "seed.jpg"])
      await writeFile(join(coversDirectory, file), "");
    const opened = await session();
    const saved = await save(
      opened.token,
      opened.revision,
      [{ ...game, cover: `/covers/${used}` }],
      `/covers/${drafted}`,
    );
    expect(saved.status).toBe(200);
    expect((await readdir(coversDirectory)).sort()).toEqual([used, drafted, "seed.jpg"].sort());
  });
  it("editor.safety: rejects cross-origin requests and DNS-rebinding hostnames", async () => {
    expect(
      (await fetch(`${base}/__dev/games`, { headers: { Origin: "https://evil.example" } })).status,
    ).toBe(403);
    const reboundStatus = await new Promise<number | undefined>((resolve, reject) => {
      request(`${base}/__dev/games`, { headers: { Host: "evil.example" } }, (response) => {
        response.resume();
        resolve(response.statusCode);
      })
        .on("error", reject)
        .end();
    });
    expect(reboundStatus).toBe(403);
    const opened = await session();
    expect(
      (
        await fetch(`${base}/__dev/games`, {
          method: "PUT",
          headers: {
            Origin: "https://evil.example",
            "Content-Type": "application/json",
            "X-Game-Editor": opened.token,
          },
          body: JSON.stringify({ revision: opened.revision, games: [] }),
        })
      ).status,
    ).toBe(403);
  });
  it("editor.safety: bounds input size, rejects malformed JSON, and limits routes", async () => {
    const opened = await session();
    const headers = {
      Origin: base,
      "Content-Type": "application/json",
      "X-Game-Editor": opened.token,
    };
    expect((await fetch(`${base}/__dev/games`, { method: "PUT", headers, body: "{" })).status).toBe(
      400,
    );
    expect(
      (await fetch(`${base}/__dev/games`, { method: "PUT", headers, body: "x".repeat(256_001) }))
        .status,
    ).toBe(413);
    expect((await fetch(`${base}/__dev/games`, { method: "DELETE" })).status).toBe(405);
    expect((await fetch(`${base}/unrelated`)).status).toBe(404);
    expect(await readFile(dataPath, "utf8")).toBe("[]\n");
  });
});
