import { readFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import { clampThinkingLevel, getSupportedThinkingLevels } from "@earendil-works/pi-ai";
import { ModelRuntime, resolveModelScopeWithDiagnostics } from "@earendil-works/pi-coding-agent";
import { z } from "zod";
import { thinkingLevelSchema, type AgentModelChoice } from "../../src/games/agent-protocol";
import { PiCredentials, piModel } from "./pi-credentials";

const settingsSchema = z.object({
  enabledModels: z.array(z.string()).optional(),
  defaultThinkingLevel: thinkingLevelSchema.default("medium"),
  modelThinkingLevels: z.record(z.string(), thinkingLevelSchema).default({}),
});

async function readConfiguration(path: string): Promise<unknown> {
  try {
    return JSON.parse(await readFile(path, "utf8"), (_key, value: unknown) => {
      // ModelRuntime can execute configuration commands. This host deliberately cannot.
      if (
        basename(path) === "models.json" &&
        typeof value === "string" &&
        value.trimStart().startsWith("!")
      )
        throw new Error("Command-based Pi configuration is not supported by the game agent.");
      return value;
    });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") return {};
    if (error instanceof SyntaxError)
      throw new Error("Invalid Pi configuration JSON. Repair it in Pi and retry.");
    throw error;
  }
}

export async function openPiModels(override?: string) {
  const credentials = new PiCredentials();
  const directory = dirname(credentials.path);
  const settings = settingsSchema.parse(await readConfiguration(join(directory, "settings.json")));
  const modelsPath = join(directory, "models.json");
  await readConfiguration(modelsPath);
  const models = await ModelRuntime.create({ credentials, modelsPath, allowModelNetwork: false });
  if (models.getError())
    throw new Error("Could not load Pi's models.json. Repair it in Pi and retry.");
  const preferred = await piModel(override);
  const preferredId = `${preferred.provider}/${preferred.modelId}`;
  // Without a scope, offer the Pi default only, never the whole provider catalog.
  const patterns = settings.enabledModels?.length ? [...settings.enabledModels] : [preferredId];
  if (override && !patterns.includes(preferredId)) patterns.unshift(preferredId);
  const { scopedModels, diagnostics } = await resolveModelScopeWithDiagnostics(patterns, models);
  const unavailableModels = diagnostics
    .filter((item) => item.code === "no-match")
    .flatMap((item) => (item.pattern ? [item.pattern] : []));
  const choices: AgentModelChoice[] = scopedModels.map(({ model, thinkingLevel }) => {
    const id = `${model.provider}/${model.id}`;
    return {
      id,
      name: model.name,
      defaultThinking: clampThinkingLevel(
        model,
        thinkingLevel ?? settings.modelThinkingLevels[id] ?? settings.defaultThinkingLevel,
      ),
      thinkingLevels: getSupportedThinkingLevels(model),
    };
  });
  if (!choices.length)
    throw new Error(
      "No scoped Pi models have usable credentials. Check /scoped-models and /login in Pi.",
    );
  if (override && !choices.some((choice) => choice.id === preferredId))
    throw new Error("GAME_AGENT_MODEL is not an available Pi model. Check its ID and Pi login.");
  const selected = choices.find((choice) => choice.id === preferredId) ?? choices[0]!;
  const slash = selected.id.indexOf("/");
  return {
    models,
    choices,
    unavailableModels,
    model: { provider: selected.id.slice(0, slash), modelId: selected.id.slice(slash + 1) },
  };
}
