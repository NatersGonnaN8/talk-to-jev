/**
 * IP parsing, CIDR checks (IPv4 and IPv6, no libraries) and the real client
 * address for rate limits. Ported from the booking page's netutil.mjs and
 * security.mjs, which were proven against a real Traefik behind Cloudflare.
 */
import net from "node:net";

export type ParsedIp = { v: 4 | 6; n: bigint };
export type Cidr = { v: 4 | 6; prefix: bigint; shift: bigint };

function v4ToBigInt(s: string): bigint {
  return s.split(".").reduce((acc, part) => (acc << 8n) | BigInt(+part), 0n);
}

/** "1.2.3.4", "::1", "::ffff:1.2.3.4" -> { v, n } or null. IPv4-mapped IPv6 becomes plain IPv4. */
export function parseIp(text: unknown): ParsedIp | null {
  if (typeof text !== "string") return null;
  let s = text.trim();
  if (s.startsWith("[") && s.endsWith("]")) s = s.slice(1, -1);
  const kind = net.isIP(s);
  if (kind === 4) return { v: 4, n: v4ToBigInt(s) };
  if (kind !== 6) return null;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(s);
  if (mapped && net.isIP(mapped[1]) === 4) return { v: 4, n: v4ToBigInt(mapped[1]) };
  s = s.split("%")[0]; // drop a zone id (fe80::1%eth0)
  const v4tail = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4tail) {
    const n = v4ToBigInt(v4tail[1]);
    s =
      s.slice(0, -v4tail[1].length) +
      ((n >> 16n) & 0xffffn).toString(16) +
      ":" +
      (n & 0xffffn).toString(16);
  }
  const halves = s.split("::");
  const head = halves[0] ? halves[0].split(":") : [];
  const tail = halves.length > 1 && halves[1] ? halves[1].split(":") : [];
  const missing = 8 - head.length - tail.length;
  const groups = halves.length > 1 ? [...head, ...Array(missing).fill("0"), ...tail] : head;
  if (groups.length !== 8) return null;
  let n = 0n;
  for (const g of groups) n = (n << 16n) | BigInt(parseInt(g, 16));
  return { v: 6, n };
}

/** "10.0.0.0/8" -> matcher. Throws on a bad entry so a typo in config is loud. */
export function parseCidr(text: string): Cidr {
  const [addr, bitsText] = String(text).trim().split("/");
  const ip = parseIp(addr);
  if (!ip) throw new Error(`bad IP range "${text}"`);
  const max = ip.v === 4 ? 32 : 128;
  const bits = bitsText === undefined ? max : Number(bitsText);
  if (!Number.isInteger(bits) || bits < 0 || bits > max) {
    throw new Error(`bad IP range "${text}"`);
  }
  const shift = BigInt(max - bits);
  return { v: ip.v, prefix: ip.n >> shift, shift };
}

export function parseCidrList(text: string | undefined): Cidr[] {
  return String(text || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .map(parseCidr);
}

export function inRanges(ipText: unknown, ranges: Cidr[]): boolean {
  const ip = parseIp(ipText);
  if (!ip) return false;
  return ranges.some((r) => r.v === ip.v && ip.n >> r.shift === r.prefix);
}

/** Rate-limit key. IPv4 is the address; IPv6 is bucketed by /64 so one host cannot rotate through its /64. */
export function ipKey(ipText: unknown): string {
  const ip = parseIp(ipText);
  if (!ip) return "unknown";
  if (ip.v === 4) return [24n, 16n, 8n, 0n].map((s) => (ip.n >> s) & 255n).join(".");
  return "v6:" + (ip.n >> 64n).toString(16);
}

/** Cloudflare's published proxy ranges (https://www.cloudflare.com/ips-v4 and /ips-v6, fetched 2026-10-17). */
export const CLOUDFLARE_RANGES = [
  "173.245.48.0/20", "103.21.244.0/22", "103.22.200.0/22", "103.31.4.0/22", "141.101.64.0/18", "108.162.192.0/18",
  "190.93.240.0/20", "188.114.96.0/20", "197.234.240.0/22", "198.41.128.0/17", "162.158.0.0/15", "104.16.0.0/13",
  "104.24.0.0/14", "172.64.0.0/13", "131.0.72.0/22",
  "2400:cb00::/32", "2606:4700::/32", "2803:f800::/32", "2405:b500::/32", "2405:8100::/32", "2a06:98c0::/29", "2c0f:f248::/32",
].join(",");

export const PRIVATE_RANGES =
  "127.0.0.0/8,10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,::1/128,fc00::/7";

export type NetConfig = { trustedProxies: Cidr[]; cloudflareRanges: Cidr[] };

type ReqLike = {
  socket: { remoteAddress?: string | undefined };
  headers: Record<string, string | string[] | undefined>;
};

/**
 * The visitor's address, for rate limits only.
 *
 * We sit behind Traefik behind Cloudflare. Anyone can send
 * "CF-Connecting-IP: 1.2.3.4" straight to the server, so that header is
 * believed only when BOTH hold:
 *   1. the TCP peer is our own proxy (a private or loopback address), and
 *   2. the address Traefik saw (the LAST entry of X-Forwarded-For, which
 *      Traefik adds itself) is a Cloudflare address.
 * If only (1) holds we use the address Traefik saw. If neither, the TCP peer.
 * A forged header therefore never helps.
 */
export function clientIp(req: ReqLike, cfg: NetConfig): string {
  const peer = req.socket.remoteAddress || "unknown";
  if (!inRanges(peer, cfg.trustedProxies)) return peer;
  const xff = req.headers["x-forwarded-for"];
  const last = typeof xff === "string" ? (xff.split(",").pop() ?? "").trim() : "";
  if (!parseIp(last)) return peer;
  if (inRanges(last, cfg.cloudflareRanges)) {
    const cf = req.headers["cf-connecting-ip"];
    if (typeof cf === "string" && parseIp(cf.trim())) return cf.trim();
  }
  return last;
}
