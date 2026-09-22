/**
 * Double-click entry for Talk to Jev.
 * Windows: Talk-to-Jev.cmd. macOS: Talk-to-Jev.command.
 * Reuses 127.0.0.1:5182. Does not start a second server when health is already up.
 */
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const origin = "http://127.0.0.1:5182";
const url = `${origin}/`;
const skipBrowser = process.env.TALK_TO_JEV_OPEN === "0";

function npm(args) {
  const bin = process.platform === "win32" ? "npm.cmd" : "npm";
  return spawn(bin, args, { cwd: root, stdio: "inherit" });
}

function exitCode(child) {
  return new Promise((resolve) => {
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function health() {
  try {
    const res = await fetch(`${origin}/api/health`, {
      signal: AbortSignal.timeout(1500),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function openBrowser() {
  if (skipBrowser) {
    console.log(`browser skipped (${url})`);
    return;
  }
  if (process.platform === "win32") {
    spawn("cmd", ["/c", "start", "", url], {
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    }).unref();
    return;
  }
  if (process.platform === "darwin") {
    spawn("open", [url], { detached: true, stdio: "ignore" }).unref();
    return;
  }
  console.log(url);
}

const nodeMajor = Number(process.versions.node.split(".")[0]);
if (!Number.isFinite(nodeMajor) || nodeMajor < 20) {
  console.error(`Talk to Jev needs Node.js 20 or newer. This is ${process.version}.`);
  console.error("https://nodejs.org");
  process.exit(1);
}

if (await health()) {
  console.log(`Talk to Jev is already running. Opening ${url}`);
  openBrowser();
  process.exit(0);
}

if (!existsSync(join(root, "node_modules"))) {
  console.log("First run: npm install");
  const installCode = await exitCode(npm(["install"]));
  if (installCode !== 0) process.exit(installCode);
}

console.log(`Starting Talk to Jev at ${url}`);
const child = npm(["run", "dev"]);
let opened = false;

const poll = setInterval(async () => {
  if (opened) return;
  if (await health()) {
    opened = true;
    clearInterval(poll);
    console.log(`Opening ${url}`);
    openBrowser();
  }
}, 500);

function stopChild() {
  clearInterval(poll);
  if (!child.killed) child.kill();
}

process.on("SIGINT", () => {
  stopChild();
  process.exit(0);
});
process.on("SIGTERM", () => {
  stopChild();
  process.exit(0);
});

const code = await exitCode(child);
clearInterval(poll);
if (!opened) {
  console.error("Talk to Jev did not stay up. Port 5182 is this app only (strictPort).");
}
process.exit(code);
