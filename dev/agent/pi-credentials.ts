import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { dirname, join } from "node:path";
import { homedir } from "node:os";
import lockfile from "proper-lockfile";
import { z } from "zod";
import type { AuthOperationOptions, Credential, CredentialStore } from "@earendil-works/pi-ai";

const credentialSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("api_key"),
      key: z.string().optional(),
      env: z.record(z.string(), z.string()).optional(),
    })
    .passthrough(),
  z
    .object({
      type: z.literal("oauth"),
      access: z.string(),
      refresh: z.string(),
      expires: z.number().finite(),
    })
    .passthrough(),
]);
const credentialsSchema = z.record(z.string(), credentialSchema);

const piDirectory = () => process.env.PI_CODING_AGENT_DIR ?? join(homedir(), ".pi", "agent");

/** Uses the same auth.json.lock convention as Pi, including during rotated-token refresh. */
export class PiCredentials implements CredentialStore {
  readonly path: string;
  private pending = Promise.resolve();
  constructor(path = join(piDirectory(), "auth.json")) {
    this.path = path;
  }

  private locked<T>(
    fn: (data: Record<string, Credential>, check: () => void) => Promise<T>,
    options?: AuthOperationOptions,
  ) {
    // Pi checks providers concurrently. Queue this process before taking the shared file lock.
    const next = this.pending.then(() => this.withFileLock(fn, options));
    this.pending = next.then(
      () => undefined,
      () => undefined,
    );
    return next;
  }

  private async withFileLock<T>(
    fn: (data: Record<string, Credential>, check: () => void) => Promise<T>,
    options?: AuthOperationOptions,
  ) {
    options?.signal?.throwIfAborted();
    await mkdir(dirname(this.path), { recursive: true, mode: 0o700 });
    let compromised: Error | undefined;
    const release = await lockfile.lock(this.path, {
      realpath: false,
      stale: 30_000,
      retries: { retries: 10, minTimeout: 20, maxTimeout: 1000 },
      onCompromised: (error) => {
        compromised = error;
      },
    });
    try {
      options?.signal?.throwIfAborted();
      let text: string;
      try {
        text = await readFile(this.path, "utf8");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        text = "{}";
      }
      let data: Record<string, Credential>;
      try {
        data = credentialsSchema.parse(JSON.parse(text.replace(/^\uFEFF/, "")));
      } catch {
        // JSON parser errors can include fragments of the credential file.
        throw new Error("Pi's auth.json is invalid. Repair it or sign in through Pi, then retry.");
      }
      const check = () => {
        options?.signal?.throwIfAborted();
        if (compromised) throw compromised;
      };
      check();
      return await fn(data, check);
    } finally {
      if (!compromised) await release();
    }
  }

  read(provider: string, options?: AuthOperationOptions): Promise<Credential | undefined> {
    return this.locked(async (data) => {
      const credential = data[provider];
      if (credential?.type === "api_key" && credential.key?.trimStart().startsWith("!")) {
        throw new Error(
          "Command-based Pi credentials are not supported here. Use a Pi OAuth login or an environment API key.",
        );
      }
      if (credential?.type === "api_key" && credential.key) {
        return {
          ...credential,
          key: credential.env?.[credential.key] ?? process.env[credential.key] ?? credential.key,
        };
      }
      return credential;
    }, options);
  }

  list(options?: AuthOperationOptions) {
    return this.locked(
      async (data) =>
        Object.entries(data).map(([providerId, credential]) => ({
          providerId,
          type: credential.type,
        })),
      options,
    );
  }

  private async save(data: Record<string, Credential>, check: () => void) {
    const temporary = `${this.path}.${randomUUID()}.tmp`;
    try {
      check();
      await writeFile(temporary, `${JSON.stringify(data, null, 2)}\n`, { flag: "wx", mode: 0o600 });
      check();
      await rename(temporary, this.path);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  modify(
    provider: string,
    fn: (current: Credential | undefined) => Promise<Credential | undefined>,
    options?: AuthOperationOptions,
  ) {
    return this.locked(async (data, check) => {
      const next = await fn(data[provider]);
      if (next !== undefined) {
        data[provider] = next;
        await this.save(data, check);
      }
      return data[provider];
    }, options);
  }

  delete(provider: string, options?: AuthOperationOptions) {
    return this.locked(async (data, check) => {
      delete data[provider];
      await this.save(data, check);
    }, options);
  }
}

export async function piModel(override?: string) {
  if (override) {
    const slash = override.indexOf("/");
    if (slash < 1 || slash === override.length - 1)
      throw new Error("GAME_AGENT_MODEL must be provider/model-id.");
    return { provider: override.slice(0, slash), modelId: override.slice(slash + 1) };
  }
  let settings: unknown;
  try {
    settings = JSON.parse(await readFile(join(piDirectory(), "settings.json"), "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const parsed = z
    .object({ defaultProvider: z.string().min(1), defaultModel: z.string().min(1) })
    .safeParse(settings);
  if (!parsed.success)
    throw new Error(
      "Choose a default model in Pi, or set GAME_AGENT_MODEL=provider/model-id in .env.local.",
    );
  return { provider: parsed.data.defaultProvider, modelId: parsed.data.defaultModel };
}
