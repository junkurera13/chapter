import { spawn, spawnSync } from "node:child_process";
import { basename, resolve } from "node:path";

const requiredFromConvex = ["CHAPTER_AGENT_SECRET", "OPENROUTER_API_KEY"] as const;
const childEnvironment = { ...process.env };

for (const name of requiredFromConvex) {
  if (childEnvironment[name]) continue;
  const result = spawnSync("npx", ["convex", "env", "get", name], {
    cwd: process.cwd(),
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  });
  const value = result.stdout.trim();
  if (result.status !== 0 || !value) {
    throw new Error(`${name} is not configured in the linked Convex development deployment.`);
  }
  childEnvironment[name] = value;
}

const [requestedCommand, ...args] = process.argv.slice(2);
if (!requestedCommand) throw new Error("Provide a command to run.");

const localBinary = resolve(
  process.cwd(),
  "node_modules",
  ".bin",
  basename(requestedCommand),
);
const child = spawn(localBinary, args, {
  cwd: process.cwd(),
  env: childEnvironment,
  stdio: "inherit",
});

child.once("error", (error) => {
  console.error(`Could not start ${requestedCommand}: ${error.message}`);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }
  process.exitCode = code ?? 1;
});
