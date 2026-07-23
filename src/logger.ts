import fs from "node:fs";
import path from "node:path";

const logDir = process.env.LOG_DIR;
let stream: fs.WriteStream | undefined;

if (logDir) {
  fs.mkdirSync(logDir, { recursive: true });
  stream = fs.createWriteStream(path.join(logDir, "mcp-server.log"), { flags: "a" });
}

function write(level: "INFO" | "ERROR", args: unknown[]) {
  const line = `${new Date().toISOString()} [${level}] ${args.map(String).join(" ")}`;
  // Always stderr, never stdout: stdout carries the MCP protocol stream in stdio mode.
  console.error(line);
  stream?.write(line + "\n");
}

export function log(...args: unknown[]) {
  write("INFO", args);
}

export function logError(...args: unknown[]) {
  write("ERROR", args);
}
