import { describe, it, expect, vi, beforeAll, afterAll } from "vitest";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { 
	createFlowLogDir, 
	getFlowLogPath, 
	writeFlowLogEntry, 
	cleanupFlowLogDir 
} from "../src/flow-log.js";

describe("flow-log.ts", () => {
	let logDir: string;

	beforeAll(async () => {
		logDir = createFlowLogDir();
	});

	afterAll(async () => {
		cleanupFlowLogDir(logDir);
	});

	it("creates a directory with a timestamp in its name", async () => {
		expect(logDir).toContain("pi-agent-flow-logs-");
		// Verify it actually exists
		const exists = await fs.access(logDir).then(() => true).catch(() => false);
		expect(exists).toBe(true);
	});

	it("resolves correct log file path for a flow", () => {
		const filePath = getFlowLogPath(logDir, "test-flow", 1);
		expect(filePath).toBe(path.join(logDir, "test-flow_1.log"));
	});

	it("writes and appends entries as JSON lines", async () => {
		const flowType = "test-flow";
		const index = 0;
		const entry1 = { type: "thinking", text: "hello" };
		const entry2 = { type: "output", text: " world" };

		writeFlowLogEntry(logDir, flowType, index, entry1);
		writeFlowLogEntry(logDir, flowType, index, entry2);

		const filePath = getFlowLogPath(logDir, flowType, index);
		const content = await fs.readFile(filePath, "utf-8");
		const lines = content.trim().split("\n");

		expect(lines).toHaveLength(2);
		expect(JSON.parse(lines[0])).toEqual(entry1);
		expect(JSON.parse(lines[1])).toEqual(entry2);
	});

	it("cleans up the directory and its contents", async () => {
		const newDir = createFlowLogDir();
		const filePath = getFlowLogPath(newDir, "cleanup-test", 0);
		await fs.writeFile(filePath, "test content");

		cleanupFlowLogDir(newDir);

		const exists = await fs.access(newDir).then(() => true).catch(() => false);
		expect(exists).toBe(false);
	});
});
