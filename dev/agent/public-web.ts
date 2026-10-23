import { lookup } from "node:dns/promises";
import { request } from "node:https";
import ipaddr from "ipaddr.js";
import {
  awaitWithContext,
  BACKGROUND_CONTEXT,
  withAbortSignal,
} from "@earendil-works/chord/context";

export function publicUrl(value: string) {
  const url = new URL(value);
  if (
    url.protocol !== "https:" ||
    url.username ||
    url.password ||
    (url.port && url.port !== "443")
  ) {
    throw new Error("Only public HTTPS URLs without credentials are allowed.");
  }
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (ipaddr.isValid(host) && ipaddr.process(host).range() !== "unicast") {
    throw new Error("Private and reserved network addresses are not allowed.");
  }
  return url;
}

export function publicAddress(address: string) {
  if (!ipaddr.isValid(address) || ipaddr.process(address).range() !== "unicast") {
    throw new Error("Private and reserved network addresses are not allowed.");
  }
}

type WebResponse = { url: string; body: Buffer; contentType: string };

/** Resolve and pin a public IP on every redirect, so DNS cannot rebind to a local service. */
export async function fetchPublic(
  value: string,
  maxBytes = 1_500_000,
  signal?: AbortSignal,
): Promise<WebResponse> {
  const timeout = AbortSignal.timeout(15_000);
  const abort = signal ? AbortSignal.any([signal, timeout]) : timeout;
  let url = publicUrl(value);
  for (let redirects = 0; redirects <= 3; redirects++) {
    abort.throwIfAborted();
    const hostname = url.hostname.replace(/^\[|\]$/g, "");
    const addresses = await awaitWithContext(
      lookup(hostname, { all: true }),
      withAbortSignal(abort, BACKGROUND_CONTEXT),
    );
    abort.throwIfAborted();
    if (!addresses.length) throw new Error("The source has no network address.");
    addresses.forEach(({ address }) => publicAddress(address));
    const address = addresses[0]!;
    const result = await new Promise<WebResponse | { redirect: string }>((resolve, reject) => {
      const req = request(
        url,
        {
          signal: abort,
          agent: false,
          family: address.family,
          lookup: (_host, _options, callback) => callback(null, address.address, address.family),
          headers: {
            "User-Agent": "SoleoneGaming/0.1 (personal game collection research)",
            Accept: "text/html,application/json,image/*;q=0.8",
            "Accept-Encoding": "identity",
          },
        },
        (res) => {
          const status = res.statusCode ?? 500;
          if (status >= 300 && status < 400 && res.headers.location) {
            res.resume();
            return resolve({ redirect: res.headers.location });
          }
          if (status !== 200) {
            res.resume();
            return reject(new Error(`Source returned HTTP ${status}. Try another source.`));
          }
          if (Number(res.headers["content-length"]) > maxBytes) {
            res.destroy();
            return reject(new Error("The source is larger than the download limit."));
          }
          const chunks: Buffer[] = [];
          let size = 0;
          res.on("data", (chunk: Buffer) => {
            size += chunk.length;
            if (size > maxBytes) {
              reject(new Error("The source is larger than the download limit."));
              res.destroy();
            } else chunks.push(chunk);
          });
          res.on("error", reject);
          res.on("end", () =>
            resolve({
              url: url.href,
              body: Buffer.concat(chunks),
              contentType: res.headers["content-type"] ?? "",
            }),
          );
        },
      );
      req.on("error", reject);
      req.end();
    });
    if (!("redirect" in result)) return result;
    url = publicUrl(new URL(result.redirect, url).href);
  }
  throw new Error("The source redirected too many times.");
}
