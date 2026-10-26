import { spawn } from "node:child_process";
const children = [
  ["node", ["--experimental-strip-types", "src/gateway.ts"]],
  ["node", ["--experimental-strip-types", "src/core/server.ts"]],
  ["npm", ["run", "dev:portal"]],
].map(([bin, args]) => spawn(bin, args, { stdio: "inherit", detached: true }));
let stopping = false;
const stop = (code = 0) => {
  if (stopping) return;
  stopping = true;
  process.exitCode = code;
  children.forEach((p) => {
    try {
      process.kill(-p.pid, "SIGTERM");
    } catch {}
  });
};
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
children.forEach((p) => p.on("exit", (code) => stop(code ?? 0)));
