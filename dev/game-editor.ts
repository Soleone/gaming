import { createHash, randomBytes } from "node:crypto";
import { readFile, rename, writeFile, rm } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { Plugin } from "vite-plus";
import { z } from "zod";
import { gamesSchema } from "../src/games/model";
import { HttpError, localOrigin } from "./local-access";
import { createGameAgent } from "./game-agent";

const saveSchema = z.object({ revision: z.string(), games: gamesSchema }).strict();
const revisionOf = (text: string) => createHash("sha256").update(text).digest("hex");

// The only writable path is supplied by the server, never by a request.
export function createGameEditor(dataPath: string) {
  const token = randomBytes(32).toString("hex");
  let writing = false;
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    if (req.url?.split("?")[0] !== "/__dev/games") return next();
    const respond = (status: number, body: object) => {
      res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
      res.end(JSON.stringify(body));
    };
    let ownsWrite = false;
    let temporary: string | undefined;
    try {
      const origin = localOrigin(req);
      if (req.method === "GET") {
        const text = await readFile(dataPath, "utf8");
        return respond(200, {
          games: gamesSchema.parse(JSON.parse(text)),
          revision: revisionOf(text),
          token,
        });
      }
      if (req.method !== "PUT") return respond(405, { error: "Use GET or PUT." });
      if (
        req.headers.origin !== origin ||
        req.headers["x-game-editor"] !== token ||
        req.headers["content-type"] !== "application/json"
      ) {
        return respond(403, { error: "Open the editor in this browser before saving." });
      }
      if (writing) return respond(409, { error: "Another save is in progress. Try again." });
      const chunks: Buffer[] = [];
      let size = 0;
      for await (const chunk of req) {
        size += Buffer.byteLength(chunk);
        if (size > 256_000)
          return respond(413, { error: "The game file must be smaller than 256 KB." });
        chunks.push(Buffer.from(chunk));
      }
      const parsed = saveSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      if (!parsed.success)
        return respond(400, { error: parsed.error.issues.map((issue) => issue.message).join(" ") });
      // Claim the writer after reading the body, before the first filesystem await.
      if (writing) return respond(409, { error: "Another save is in progress. Try again." });
      writing = ownsWrite = true;
      const current = await readFile(dataPath, "utf8");
      if (parsed.data.revision !== revisionOf(current)) {
        return respond(409, {
          error:
            "games.json changed since you opened the editor. Close and reopen it to load the latest data; your draft is still here to copy.",
        });
      }
      const text = `${JSON.stringify(parsed.data.games, null, 2)}\n`;
      temporary = `${dataPath}.${randomBytes(8).toString("hex")}.tmp`;
      await writeFile(temporary, text, { flag: "wx" });
      await rename(temporary, dataPath);
      return respond(200, { games: parsed.data.games, revision: revisionOf(text), token });
    } catch (error) {
      if (error instanceof HttpError) return respond(error.status, { error: error.message });
      if (error instanceof SyntaxError)
        return respond(400, { error: "Invalid JSON. Check the game data and try again." });
      console.error("Game editor:", error);
      return respond(500, {
        error:
          "Could not read or save games.json. Check the development terminal and file permissions.",
      });
    } finally {
      if (ownsWrite) writing = false;
      if (temporary) await rm(temporary, { force: true });
    }
  };
}

export function gameEditorPlugin(dataPath: string): Plugin {
  return {
    name: "local-game-editor",
    apply: "serve",
    configureServer(server) {
      const editor = createGameEditor(dataPath);
      const agent = createGameAgent(server.config.root, server.config.mode);
      server.middlewares.use((req, res, next) => {
        void editor(req, res, () => {
          void agent.handle(req, res, next);
        });
      });
      server.httpServer?.once("close", () => {
        void agent
          .close()
          .catch((error) =>
            server.config.logger.error(`Could not close the gaming agent: ${String(error)}`),
          );
      });
    },
  };
}
