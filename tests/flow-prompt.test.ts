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
    const result = computeActiveTools(baseExisting, { both: ["bash", "find"] }, true);
    expect(result).not.toContain("bash");
    expect(result).not.toContain("find");
    // Other tools still present
    expect(result).toContain("grep");
    expect(result).toContain("ls");
  });

  it("excludeTools is case-insensitive", () => {
    const result = computeActiveTools(baseExisting, { both: ["BASH", "Find"] }, true);
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

describe("computeActiveTools granular exclusions", () => {
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

  it("excludes tools in both mode regardless of optimize", () => {
    const resultOpt = computeActiveTools(baseExisting, { both: ["find"] }, true);
    expect(resultOpt).not.toContain("find");
    const resultNonOpt = computeActiveTools(baseExisting, { both: ["find"] }, false);
    expect(resultNonOpt).not.toContain("find");
  });

  it("excludes optimize-only tools only in optimize mode", () => {
    const resultOpt = computeActiveTools(baseExisting, { optimize: ["grep"] }, true);
    expect(resultOpt).not.toContain("grep");
    const resultNonOpt = computeActiveTools(baseExisting, { optimize: ["grep"] }, false);
    expect(resultNonOpt).toContain("grep");
  });

  it("excludes nonOptimize-only tools only in non-optimize mode", () => {
    const resultOpt = computeActiveTools(baseExisting, { nonOptimize: ["ls"] }, true);
    expect(resultOpt).toContain("ls");
    const resultNonOpt = computeActiveTools(baseExisting, { nonOptimize: ["ls"] }, false);
    expect(resultNonOpt).not.toContain("ls");
  });

  it("combines both, optimize, and nonOptimize exclusions correctly", () => {
    const resultOpt = computeActiveTools(baseExisting, {
      both: ["find"],
      optimize: ["grep"],
      nonOptimize: ["ls"],
    }, true);
    expect(resultOpt).not.toContain("find");
    expect(resultOpt).not.toContain("grep");
    expect(resultOpt).toContain("ls");

    const resultNonOpt = computeActiveTools(baseExisting, {
      both: ["find"],
      optimize: ["grep"],
      nonOptimize: ["ls"],
    }, false);
    expect(resultNonOpt).not.toContain("find");
    expect(resultNonOpt).toContain("grep");
    expect(resultNonOpt).not.toContain("ls");
  });

  it("handles undefined excludeTools", () => {
    const result = computeActiveTools(baseExisting, undefined, false);
    expect(result).toContain("bash");
    expect(result).toContain("find");
    expect(result).toContain("grep");
  });

  it("handles empty object excludeTools", () => {
    const result = computeActiveTools(baseExisting, {}, false);
    expect(result).toContain("bash");
    expect(result).toContain("find");
    expect(result).toContain("grep");
  });

  it("handles partial object (only optimize key)", () => {
    const resultOpt = computeActiveTools(baseExisting, { optimize: ["find"] }, true);
    expect(resultOpt).not.toContain("find");
    const resultNonOpt = computeActiveTools(baseExisting, { optimize: ["find"] }, false);
    expect(resultNonOpt).toContain("find");
  });

  it("handles partial object (only both key)", () => {
    const resultOpt = computeActiveTools(baseExisting, { both: ["find"] }, true);
    expect(resultOpt).not.toContain("find");
    const resultNonOpt = computeActiveTools(baseExisting, { both: ["find"] }, false);
    expect(resultNonOpt).not.toContain("find");
  });

  it("is case-insensitive for granular exclusions", () => {
    const result = computeActiveTools(baseExisting, { both: ["FIND", "Grep"] }, true);
    expect(result).not.toContain("find");
    expect(result).not.toContain("grep");
  });
});
