import assert from "node:assert/strict";
import { test } from "node:test";
import {
  CLOUDFLARE_RANGES,
  PRIVATE_RANGES,
  clientIp,
  inRanges,
  ipKey,
  parseCidr,
  parseCidrList,
  parseIp,
} from "./netutil.ts";

const cfg = {
  trustedProxies: parseCidrList(PRIVATE_RANGES),
  cloudflareRanges: parseCidrList(CLOUDFLARE_RANGES),
};

function req(peer: string, headers: Record<string, string> = {}) {
  return { socket: { remoteAddress: peer }, headers };
}

test("parseIp handles v4, v6, mapped v4 and rejects junk", () => {
  assert.equal(parseIp("1.2.3.4")?.v, 4);
  assert.equal(parseIp("::1")?.v, 6);
  assert.deepEqual(parseIp("::ffff:1.2.3.4"), parseIp("1.2.3.4"));
  assert.equal(parseIp("not an ip"), null);
  assert.equal(parseIp("999.1.1.1"), null);
  assert.equal(parseIp(undefined), null);
});

test("parseCidr is loud on a typo", () => {
  assert.throws(() => parseCidr("10.0.0.0/99"));
  assert.throws(() => parseCidr("nope/8"));
});

test("Cloudflare and private ranges match the right addresses", () => {
  const cf = parseCidrList(CLOUDFLARE_RANGES);
  assert.ok(inRanges("173.245.48.10", cf));
  assert.ok(inRanges("2606:4700::1", cf));
  assert.ok(!inRanges("8.8.8.8", cf));
  const priv = parseCidrList(PRIVATE_RANGES);
  assert.ok(inRanges("172.18.0.5", priv));
  assert.ok(inRanges("::1", priv));
  assert.ok(!inRanges("172.32.0.1", priv));
});

test("clientIp: a forged CF-Connecting-IP from a direct public peer is ignored", () => {
  const ip = clientIp(req("203.0.113.9", { "cf-connecting-ip": "1.1.1.1" }), cfg);
  assert.equal(ip, "203.0.113.9");
});

test("clientIp: private peer but last hop is not Cloudflare, so the CF header is ignored", () => {
  const ip = clientIp(
    req("172.18.0.2", {
      "x-forwarded-for": "9.9.9.9, 203.0.113.50",
      "cf-connecting-ip": "1.1.1.1",
    }),
    cfg,
  );
  assert.equal(ip, "203.0.113.50");
});

test("clientIp: private peer and the last hop is Cloudflare, so CF-Connecting-IP is trusted", () => {
  const ip = clientIp(
    req("172.18.0.2", {
      "x-forwarded-for": "173.245.48.10",
      "cf-connecting-ip": "198.51.100.7",
    }),
    cfg,
  );
  assert.equal(ip, "198.51.100.7");
});

test("clientIp: only the LAST forwarded hop counts (a spoofed first hop cannot pick the bucket)", () => {
  const ip = clientIp(
    req("172.18.0.2", { "x-forwarded-for": "173.245.48.10, 203.0.113.50" }),
    cfg,
  );
  assert.equal(ip, "203.0.113.50");
});

test("clientIp: junk headers fall back to the peer", () => {
  assert.equal(clientIp(req("172.18.0.2", { "x-forwarded-for": "garbage" }), cfg), "172.18.0.2");
  assert.equal(clientIp(req("172.18.0.2"), cfg), "172.18.0.2");
  assert.equal(
    clientIp(
      req("172.18.0.2", { "x-forwarded-for": "173.245.48.10", "cf-connecting-ip": "garbage" }),
      cfg,
    ),
    "173.245.48.10",
  );
});

test("ipKey buckets IPv6 by /64", () => {
  assert.equal(ipKey("2001:db8:1:2:aaaa::1"), ipKey("2001:db8:1:2:bbbb::9"));
  assert.notEqual(ipKey("2001:db8:1:2::1"), ipKey("2001:db8:1:3::1"));
  assert.equal(ipKey("1.2.3.4"), "1.2.3.4");
  assert.equal(ipKey("junk"), "unknown");
});
