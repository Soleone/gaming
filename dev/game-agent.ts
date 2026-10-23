import type { IncomingMessage, ServerResponse } from "node:http";
import { loadEnv } from "vite-plus";
import { z } from "zod";
import { agentRequestSchema } from "../src/games/agent-protocol";
import { createLocalAccess, HttpError, localOrigin, readJson } from "./local-access";
import type { GamingRuntime } from "./agent/runtime";

type OpenRuntime = () => Promise<GamingRuntime>;

export function createGameAgent(
  root: string,
  mode: string,
  open: OpenRuntime = async () => {
    const { openGamingAgent } = await import("./agent/runtime");
    return openGamingAgent(root, loadEnv(mode, root, "GAME_AGENT_"));
  },
) {
  const access = createLocalAccess();
  let runtime: Promise<GamingRuntime> | undefined;
  let closed = false;
  function getRuntime() {
    if (closed)
      throw new HttpError(503, "The agent is shutting down. Reopen it after the server restarts.");
    runtime ??= open().catch((error) => {
      runtime = undefined;
      throw error;
    });
    return runtime;
  }
  return {
    async handle(req: IncomingMessage, res: ServerResponse, next: () => void) {
      const url = new URL(req.url ?? "/", "http://localhost");
      if (url.pathname !== "/__dev/agent") return next();
      const respond = (status: number, body: unknown) => {
        res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
        res.end(JSON.stringify(body));
      };
      try {
        localOrigin(req);
        if (req.method === "GET") {
          const id = url.searchParams.get("conversationId");
          if (id === null) return respond(200, { token: access.token });
          if (req.headers["x-gaming-agent"] !== access.token)
            throw new HttpError(403, "Open the agent in this browser before using it.");
          const conversationId = z.coerce.number().int().positive().safe().parse(id);
          return respond(200, await (await getRuntime()).snapshot(conversationId));
        }
        if (req.method !== "POST") throw new HttpError(405, "Use GET or POST.");
        access.check(req);
        const request = agentRequestSchema.parse(await readJson(req));
        return respond(200, await (await getRuntime()).execute(request));
      } catch (error) {
        if (error instanceof HttpError) return respond(error.status, { error: error.message });
        if (error instanceof z.ZodError)
          return respond(400, {
            error: "Invalid agent request. Check the supplied fields and try again.",
          });
        if (error instanceof Error && error.name === "ConversationBusy")
          return respond(409, {
            error: "The agent is still working. Stop it or wait for the current request.",
          });
        console.error("Gaming agent request:", error);
        return respond(500, {
          error:
            error instanceof Error
              ? error.message
              : "The agent could not continue. Check the development terminal.",
        });
      }
    },
    async close() {
      closed = true;
      if (runtime) await (await runtime).close();
    },
  };
}
