import { readFileSync, existsSync } from "node:fs";
import { setTimeout as delay } from "node:timers/promises";
import { ModelRegistry, type ModelRuntime } from "@earendil-works/pi-coding-agent";
import type { ModelRef } from "@earendil-works/pi-durable";
import { createJiti } from "jiti";
import { z } from "zod";
import { publicUrl } from "./public-web";

// The pinned package ships its host-neutral search API as TypeScript, not a built JS export.
// Load just that API through Jiti, never the extension entry point or general Pi tools.
const loader = createJiti(import.meta.url);
type SearchEngine = {
  normalizeSearchProviderSelection(value: unknown): unknown;
  search(
    query: string,
    options: {
      provider: unknown;
      numResults: number;
      extensionContext: {
        modelRegistry: ModelRegistry;
        model: ReturnType<ModelRuntime["getModel"]>;
      };
      signal: AbortSignal;
    },
  ): Promise<{
    provider: string;
    answer: string;
    results: { title: string; url: string; snippet: string }[];
  }>;
};
const configSchema = z
  .object({
    provider: z.unknown().optional(),
    searchProvider: z.unknown().optional(),
    searchRouting: z.unknown().optional(),
    exaApiKey: z.string().optional(),
    webSearch: z.object({ enabled: z.boolean().optional() }).passthrough().optional(),
    tools: z
      .object({ webSearch: z.object({ enabled: z.boolean().optional() }).optional() })
      .passthrough()
      .optional(),
  })
  .passthrough();

function searchFailure(error: unknown) {
  const structured = z
    .object({
      kind: z
        .enum([
          "quota",
          "auth",
          "network",
          "transient",
          "invalid-response",
          "invalid-request",
          "unsupported",
          "credential",
          "config",
          "aborted",
          "unknown",
        ])
        .optional(),
      status: z.number().int().min(100).max(599).optional(),
    })
    .safeParse(error);
  // Explicit provider selection can throw plain Errors, not SearchProviderErrors.
  // Inspect their text locally, but never expose provider bodies or credentials.
  const message = error instanceof Error ? error.message : "";
  const http = message.match(/\b(?:error|status|http)\s+([45]\d{2})\b|\((429)\)/i);
  const status = structured.data?.status ?? (http ? Number(http[1] ?? http[2]) : undefined);
  let kind = structured.data?.kind;
  if (!kind) {
    if (status === 401 || status === 403) kind = "auth";
    else if (
      status === 402 ||
      status === 429 ||
      /rate.?limit|quota|too many requests/i.test(message)
    )
      kind = "quota";
    else if (status === 408 || status === 425 || (status !== undefined && status >= 500))
      kind = "transient";
    else if (status === 400 || status === 422) kind = "invalid-request";
    else if (
      /no results|empty response|empty content|no parseable|invalid json|no web_search_call/i.test(
        message,
      )
    )
      kind = "invalid-response";
    else if (
      /fetch failed|network|econnreset|econnrefused|enotfound|etimedout|timed out|socket/i.test(
        message,
      )
    )
      kind = "network";
    else kind = "unknown";
  }
  return { kind, status };
}

export async function createPiSearch(models: ModelRuntime) {
  const { getWebSearchConfigPath } = await loader.import<{ getWebSearchConfigPath: () => string }>(
    import.meta.resolve("pi-web-access/utils.ts"),
  );
  const path = getWebSearchConfigPath();
  let config: z.infer<typeof configSchema>;
  try {
    config = configSchema.parse(existsSync(path) ? JSON.parse(readFileSync(path, "utf8")) : {});
  } catch {
    // Parser errors can contain fragments of a configuration containing API keys.
    throw new Error("Pi's web-search.json is invalid. Repair it in Pi and restart the dev server.");
  }
  for (const [key, value] of Object.entries(config)) {
    if (
      /(ApiKey|ApiToken)$/.test(key) &&
      typeof value === "string" &&
      value.trimStart().startsWith("!")
    )
      throw new Error(
        "Command-based web-search credentials are not supported by the game agent. Use Pi login or environment credentials.",
      );
  }
  const enabled = config.tools?.webSearch?.enabled ?? config.webSearch?.enabled ?? true;
  const engine = await loader.import<SearchEngine>(
    import.meta.resolve("pi-web-access/gemini-search.ts"),
  );
  let provider: unknown;
  try {
    provider = engine.normalizeSearchProviderSelection(
      config.searchProvider ??
        config.provider ??
        (config.searchRouting
          ? "auto"
          : config.exaApiKey || process.env.EXA_API_KEY
            ? "exa"
            : "openai"),
    );
  } catch {
    throw new Error(
      "Invalid search provider in Pi's web-search.json. Repair it in Pi and restart the dev server.",
    );
  }
  const modelRegistry = new ModelRegistry(models);

  return async (query: string, signal?: AbortSignal, model?: ModelRef) => {
    if (!enabled) throw new Error("Web search is disabled in Pi's web-search.json.");
    const timeout = AbortSignal.timeout(60_000);
    const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;
    abort.throwIfAborted();
    let result: Awaited<ReturnType<SearchEngine["search"]>>;
    let activeProvider = provider;
    let retried = false;
    for (;;) {
      try {
        result = await engine.search(query, {
          provider: activeProvider,
          numResults: 6,
          extensionContext: {
            modelRegistry,
            model: model ? models.getModel(model.provider, model.modelId) : undefined,
          },
          signal: abort,
        });
        if (!result.results.length) throw new Error("Search provider returned no results.");
        break;
      } catch (error) {
        abort.throwIfAborted();
        const failure = searchFailure(error);
        if (
          activeProvider === "exa" &&
          ["quota", "invalid-response", "network", "transient", "unsupported"].includes(
            failure.kind,
          )
        ) {
          activeProvider = "openai";
          continue;
        }
        if (!retried && ["invalid-response", "network", "transient"].includes(failure.kind)) {
          retried = true;
          await delay(250, undefined, { signal: abort });
          continue;
        }
        const hints: Record<string, string> = {
          auth: "The search provider rejected its credentials. Check that provider's login or API key.",
          credential: "Search credentials are unavailable. Check the configured search provider.",
          quota:
            "The search provider is rate-limiting requests or its quota is exhausted. Wait, configure its API key, or choose another search provider in Pi.",
          "invalid-response":
            "The search provider returned no usable results after one retry. Try a broader game title or paste an official source URL.",
          network:
            "Could not reach the search provider after one retry. Check the connection and try again.",
          transient:
            "The search provider is temporarily unavailable after one retry. Try again shortly.",
        };
        throw new Error(
          `Pi web search failed (${typeof activeProvider === "string" ? activeProvider : "configured route"}, ${failure.kind}${failure.status ? `, HTTP ${failure.status}` : ""}). ${hints[failure.kind] ?? "The search provider could not complete the request. Check its configuration or try again."}`,
        );
      }
    }
    abort.throwIfAborted();
    const urls = new Set<string>();
    const results = result.results
      .flatMap((item) => {
        let url: string;
        try {
          url = publicUrl(item.url).href;
        } catch {
          return [];
        }
        if (urls.has(url)) return [];
        urls.add(url);
        return [{ title: item.title.slice(0, 200), url, snippet: item.snippet.slice(0, 1000) }];
      })
      .slice(0, 6);
    if (!results.length)
      throw new Error(
        "Web search returned no usable public HTTPS sources. Try a more specific game title.",
      );
    return { provider: result.provider, answer: result.answer.slice(0, 8000), results };
  };
}

export type GameWebSearch = Awaited<ReturnType<typeof createPiSearch>>;
