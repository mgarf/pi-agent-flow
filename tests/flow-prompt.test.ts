import { describe, it, expect } from "vitest";
import { computeActiveTools } from "../src/flow-prompt.js";

describe("computeActiveTools", () => {
  const baseExisting = [
    "read",
    "write",
    "edit",
    "bash",
    "find",
    "grep",
    "ls",
    "flow",
    "web",
    "memory",
    "memory_search",
  ];

  it("excludes always-excluded tools (read, write, edit, batch)", () => {
    const result = computeActiveTools(baseExisting, [], true);
    expect(result).not.toContain("read");
    expect(result).not.toContain("write");
    expect(result).not.toContain("edit");
    expect(result).not.toContain("batch");
  });

  it("excludes bash in optimize mode", () => {
    const result = computeActiveTools(baseExisting, [], true);
    expect(result).not.toContain("bash");
    // Other non-mutation tools still present
    expect(result).toContain("find");
    expect(result).toContain("grep");
    expect(result).toContain("ls");
    expect(result).toContain("memory");
    expect(result).toContain("memory_search");
  });

  it("includes bash in non-optimize mode", () => {
    const result = computeActiveTools(baseExisting, [], false);
    expect(result).toContain("bash");
    expect(result).toContain("find");
    expect(result).toContain("grep");
    expect(result).toContain("ls");
  });


  it("always adds flow tools (flow, web, ask_user)", () => {
    const result = computeActiveTools([], [], true);
    expect(result).toContain("flow");
    expect(result).toContain("web");
    expect(result).toContain("ask_user");
  });

  it("adds batch_read in optimize mode", () => {
    const result = computeActiveTools(baseExisting, [], true);
    expect(result).toContain("batch_read");
  });

  it("does not add batch_read in non-optimize mode", () => {
    const result = computeActiveTools(baseExisting, [], false);
    expect(result).not.toContain("batch_read");
  });

  it("respects user-configured excludeTools", () => {
    const result = computeActiveTools(baseExisting, ["bash", "find"], true);
    expect(result).not.toContain("bash");
    expect(result).not.toContain("find");
    // Other tools still present
    expect(result).toContain("grep");
    expect(result).toContain("ls");
  });

  it("excludeTools is case-insensitive", () => {
    const result = computeActiveTools(baseExisting, ["BASH", "Find"], true);
    expect(result).not.toContain("bash");
    expect(result).not.toContain("find");
  });

  it("returns sorted unique array", () => {
    const result = computeActiveTools(baseExisting, [], true);
    const sorted = [...result].sort();
    expect(result).toEqual(sorted);
    expect(result).toHaveLength(new Set(result).size);
  });

  it("deduplicates tools already in existingTools", () => {
    // flow and web are already in baseExisting
    const result = computeActiveTools(baseExisting, [], true);
    expect(result.filter((t) => t === "flow")).toHaveLength(1);
    expect(result.filter((t) => t === "web")).toHaveLength(1);
  });
});
