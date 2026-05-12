/**
 * Flow Log — shared log directory for persisting flow streaming output.
 *
 * Creates a temp directory per tool-call invocation so thinking/output
 * transcripts survive across overlay open/close cycles and can be
 * inspected after flow completion.
 */

import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

/** Create a shared log directory for this flow tool invocation. */
export function createFlowLogDir(): string {
  const base = path.join(os.tmpdir(), `pi-agent-flow-logs-${Date.now()}`);
  fs.mkdirSync(base, { recursive: true });
  return base;
}

/** Resolve the log file path for a given flow. */
export function getFlowLogPath(dir: string, flowType: string, flowIndex: number): string {
  const safeName = `${flowType}_${flowIndex}`.replace(/[^a-zA-Z0-9_-]/g, "_");
  return path.join(dir, `${safeName}.log`);
}

/** Append a JSON entry to a flow's log file. */
export function writeFlowLogEntry(dir: string, flowType: string, flowIndex: number, entry: { type: string; text: string }): void {
  const filePath = getFlowLogPath(dir, flowType, flowIndex);
  try {
    fs.appendFileSync(filePath, JSON.stringify(entry) + "\n", { encoding: "utf-8" });
  } catch {
    // best-effort
  }
}

/** Remove the log directory and all files within it. */
export function cleanupFlowLogDir(dir: string): void {
  if (!dir) return;
  try {
    fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // best-effort
  }
}
