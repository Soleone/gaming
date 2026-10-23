import { expect, it } from "vite-plus/test";
import { fetchPublic, publicAddress, publicUrl } from "./public-web";

it("agent.network: rejects local, reserved, credential-bearing and non-HTTPS URLs", () => {
  for (const value of [
    "http://example.com",
    "file:///etc/passwd",
    "https://user:password@example.com",
    "https://127.0.0.1",
    "https://2130706433",
    "https://0x7f000001",
    "https://[::1]",
    "https://[::ffff:127.0.0.1]",
    "https://10.0.0.1",
    "https://169.254.169.254",
    "https://example.com:8443",
    "https://192.0.2.1",
    "https://[2001:db8::1]",
  ])
    expect(() => publicUrl(value), value).toThrow();
  expect(publicUrl("https://publisher.example/game").href).toBe("https://publisher.example/game");
});
it("agent.network: rejects private DNS answers including mapped IPv6 and carrier-grade NAT", () => {
  for (const address of [
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "100.64.0.1",
    "0.0.0.0",
    "224.0.0.1",
    "::1",
    "fc00::1",
    "fe80::1",
    "::ffff:192.168.1.1",
  ]) {
    expect(() => publicAddress(address), address).toThrow();
  }
  expect(() => publicAddress("1.1.1.1")).not.toThrow();
  expect(() => publicAddress("2606:4700:4700::1111")).not.toThrow();
});
it("agent.network: refuses a hostname resolving to loopback before making an HTTP request", async () => {
  await expect(fetchPublic("https://localhost/source")).rejects.toThrow("Private and reserved");
});
