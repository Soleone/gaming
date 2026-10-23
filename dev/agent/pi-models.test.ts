import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterEach, beforeEach, expect, it, vi } from "vite-plus/test";
import { openPiModels } from "./pi-models";

let directory: string;
const settings = {
  defaultProvider: "openai",
  defaultModel: "gpt-5.5",
  defaultThinkingLevel: "max",
  enabledModels: ["openai/gpt-5.5:high", "personal/local-test"],
  modelThinkingLevels: { "openai/gpt-5.5": "medium" },
  extensions: ["!**"],
};
beforeEach(async () => {
  directory = await mkdtemp(join(tmpdir(), "gaming-pi-models-"));
  vi.stubEnv("PI_CODING_AGENT_DIR", directory);
  await writeFile(join(directory, "settings.json"), JSON.stringify(settings));
  await writeFile(
    join(directory, "auth.json"),
    JSON.stringify({ openai: { type: "api_key", key: "test-key" } }),
  );
  await writeFile(
    join(directory, "models.json"),
    JSON.stringify({
      providers: {
        personal: {
          baseUrl: "http://localhost:9999/v1",
          api: "openai-completions",
          apiKey: "local-test-key",
          models: [{ id: "local-test", name: "Local model", reasoning: false }],
        },
      },
    }),
  );
});
afterEach(async () => {
  vi.unstubAllEnvs();
  await rm(directory, { recursive: true, force: true });
});

it("agent.models: lists only Pi-scoped models, including custom models, with suffix and capability-aware defaults", async () => {
  const configuration = await openPiModels();
  expect(configuration.choices.map((choice) => choice.id)).toEqual([
    "openai/gpt-5.5",
    "personal/local-test",
  ]);
  expect(configuration.choices[0]?.defaultThinking).toBe("high");
  expect(configuration.choices[1]).toMatchObject({
    defaultThinking: "off",
    thinkingLevels: ["off"],
  });
  expect(JSON.stringify(configuration.choices)).not.toContain("local-test-key");
  expect(configuration.model).toEqual({ provider: "openai", modelId: "gpt-5.5" });
});
it("agent.models: honors per-model defaults and offers only the saved default when Pi has no scope", async () => {
  await writeFile(
    join(directory, "settings.json"),
    JSON.stringify({ ...settings, enabledModels: undefined }),
  );
  const configuration = await openPiModels();
  expect(configuration.choices).toHaveLength(1);
  expect(configuration.choices[0]?.defaultThinking).toBe("medium");
  expect(
    JSON.parse(await readFile(join(directory, "settings.json"), "utf8")).defaultThinkingLevel,
  ).toBe("max");
});
it("agent.models: reports unavailable scope entries rather than silently replacing them with provider models", async () => {
  await writeFile(
    join(directory, "settings.json"),
    JSON.stringify({
      ...settings,
      enabledModels: [...settings.enabledModels, "plugin-only/not-loaded"],
    }),
  );
  const configuration = await openPiModels();
  expect(configuration.choices).toHaveLength(2);
  expect(configuration.unavailableModels).toEqual(["plugin-only/not-loaded"]);
});

it("agent.credentials: rejects models.json commands before creating the Pi model runtime", async () => {
  await writeFile(
    join(directory, "models.json"),
    JSON.stringify({ providers: { personal: { apiKey: "!echo should-not-run" } } }),
  );
  await expect(openPiModels()).rejects.toThrow("Command-based Pi configuration");
});
