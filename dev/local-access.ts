import { randomBytes } from "node:crypto";
import type { IncomingMessage } from "node:http";
import { isIP } from "node:net";

export class HttpError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function localOrigin(req: IncomingMessage) {
  const address = req.socket.remoteAddress;
  const loopback = address === "::1" || address === "127.0.0.1" || address === "::ffff:127.0.0.1";
  let origin: URL;
  try {
    origin = new URL(`http://${req.headers.host}`);
  } catch {
    throw new HttpError(403, "The editor is available on localhost only.");
  }
  const host = origin.hostname;
  if (
    !loopback ||
    !(host === "localhost" || host === "[::1]" || (isIP(host) === 4 && host === "127.0.0.1"))
  ) {
    throw new HttpError(403, "The editor is available on localhost only.");
  }
  if (
    (req.headers.origin && req.headers.origin !== origin.origin) ||
    req.headers["sec-fetch-site"] === "cross-site"
  ) {
    throw new HttpError(403, "Cross-origin editing is not allowed.");
  }
  return origin.origin;
}

export function createLocalAccess() {
  const token = randomBytes(32).toString("hex");
  return {
    token,
    check(req: IncomingMessage) {
      const origin = localOrigin(req);
      if (
        req.headers.origin !== origin ||
        req.headers["x-gaming-agent"] !== token ||
        req.headers["content-type"] !== "application/json"
      ) {
        throw new HttpError(403, "Open the agent in this browser before using it.");
      }
    },
  };
}

export async function readJson(req: IncomingMessage) {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of req) {
    size += Buffer.byteLength(chunk);
    if (size > 32_000) throw new HttpError(413, "The agent request is too large.");
    chunks.push(Buffer.from(chunk));
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8")) as unknown;
  } catch {
    throw new HttpError(400, "Invalid JSON.");
  }
}
