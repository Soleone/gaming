import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { setTimeout } from "node:timers/promises";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { PiCredentials, piModel } from "./pi-credentials";

let directory: string;
let path: string;
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "gaming-pi-auth-"));
  path = join(directory, "auth.json");
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

it("agent.credentials: reads Pi OAuth credentials and lists metadata without exposing secrets", async () => {
  const credential = {
    type: "oauth",
    access: "test-access",
    refresh: "test-refresh",
    expires: 1,
    accountId: "account",
  };
  await writeFile(path, JSON.stringify({ provider: credential }));
  const store = new PiCredentials(path);
  expect(await store.read("provider")).toEqual(credential);
  expect(await store.list()).toEqual([{ providerId: "provider", type: "oauth" }]);
  expect(await store.read("missing")).toBeUndefined();
});
it("agent.credentials: queues concurrent provider discovery without exhausting file-lock retries", async () => {
  await writeFile(path, JSON.stringify({ provider: { type: "api_key", key: "test-key" } }));
  const store = new PiCredentials(path);
  const results = await Promise.all(Array.from({ length: 100 }, () => store.read("provider")));
  expect(results).toHaveLength(100);
  expect(results.every((value) => value?.type === "api_key")).toBe(true);
});

it("agent.credentials: serializes refreshes across store instances and preserves unrelated providers", async () => {
  await writeFile(
    path,
    JSON.stringify({ a: { type: "api_key", key: "0" }, b: { type: "api_key", key: "untouched" } }),
  );
  const first = new PiCredentials(path);
  const second = new PiCredentials(path);
  const increment = async (current: Awaited<ReturnType<typeof first.read>>) => {
    await setTimeout(25);
    return {
      type: "api_key" as const,
      key: String(Number(current?.type === "api_key" ? current.key : 0) + 1),
    };
  };
  await Promise.all([first.modify("a", increment), second.modify("a", increment)]);
  expect(await first.read("a")).toEqual({ type: "api_key", key: "2" });
  expect(await first.read("b")).toEqual({ type: "api_key", key: "untouched" });
  expect((await stat(path)).mode & 0o777).toBe(0o600);
  await second.delete("a");
  expect(await first.read("a")).toBeUndefined();
});
it("agent.credentials: leaves credentials unchanged when refresh fails or is cancelled", async () => {
  const original = JSON.stringify({ a: { type: "api_key", key: "original" } });
  await writeFile(path, original);
  const store = new PiCredentials(path);
  await expect(
    store.modify("a", async () => {
      throw new Error("refresh failed");
    }),
  ).rejects.toThrow("refresh failed");
  const controller = new AbortController();
  await expect(
    store.modify(
      "a",
      async () => {
        controller.abort();
        return { type: "api_key", key: "should-not-save" };
      },
      { signal: controller.signal },
    ),
  ).rejects.toThrow();
  expect(await readFile(path, "utf8")).toBe(original);
});
it("agent.credentials: does not expose malformed credential contents in errors", async () => {
  await writeFile(path, "a-secret-token-that-is-not-json");
  const store = new PiCredentials(path);
  await expect(store.read("provider")).rejects.toThrow("auth.json is invalid");
  try {
    await store.read("provider");
  } catch (error) {
    expect(String(error)).not.toContain("a-secret-token");
  }
});

it("agent.credentials: refuses to execute configured credential commands", async () => {
  await writeFile(path, JSON.stringify({ a: { type: "api_key", key: "!echo do-not-execute" } }));
  const store = new PiCredentials(path);
  expect(await store.list()).toEqual([{ providerId: "a", type: "api_key" }]);
  await expect(store.read("a")).rejects.toThrow("Command-based");
});
it("agent.credentials: selects Pi's default model or an explicit model without modifying settings", async () => {
  vi.stubEnv("PI_CODING_AGENT_DIR", directory);
  const settings = JSON.stringify({
    defaultProvider: "openai-codex",
    defaultModel: "a-model",
    unrelated: true,
  });
  await writeFile(join(directory, "settings.json"), settings);
  expect(await piModel()).toEqual({ provider: "openai-codex", modelId: "a-model" });
  expect(await piModel("openrouter/vendor/model")).toEqual({
    provider: "openrouter",
    modelId: "vendor/model",
  });
  await expect(piModel("invalid")).rejects.toThrow("provider/model-id");
  expect(await readFile(join(directory, "settings.json"), "utf8")).toBe(settings);
});
