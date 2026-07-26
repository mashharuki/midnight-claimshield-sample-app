import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const manifest = JSON.parse(
  readFileSync(new URL("../package.json", import.meta.url)),
);
const bunMatch = /^bun@(.+)$/.exec(manifest.packageManager ?? "");

if (!bunMatch) {
  throw new Error("package.json must declare packageManager as bun@<version>");
}

const run = (command, args) =>
  execFileSync(command, args, {
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

const installedBun = run("bun", ["--version"]);
if (installedBun !== bunMatch[1]) {
  throw new Error(
    `Bun ${bunMatch[1]} is required by packageManager, but ${installedBun} is installed.`,
  );
}

if (process.argv.includes("--container")) {
  console.log(`Bun ${installedBun} matches packageManager.`);
  process.exit(0);
}

const compactVersions = run("compact", ["list"]);
if (!compactVersions.includes("0.30.0")) {
  throw new Error(
    "Compact 0.30.0 must be installed. Run: compact update 0.30.0",
  );
}
run("docker", ["version"]);
run("docker", ["compose", "version"]);
run("docker", ["info"]);
run("docker", [
  "compose",
  "-f",
  "pkgs/cli/proof-server.yml",
  "config",
  "--quiet",
]);
run("docker", [
  "compose",
  "-f",
  "pkgs/cli/standalone.yml",
  "config",
  "--quiet",
]);
run("docker", [
  "compose",
  "-f",
  "pkgs/cli/standalone.browser.yml",
  "config",
  "--quiet",
]);

console.log(`Environment prerequisites verified with Bun ${installedBun}.`);
