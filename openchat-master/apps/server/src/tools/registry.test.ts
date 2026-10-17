import { describe, it, expect } from "vitest";
import type { ToolDefinition } from "@openchat/shared";
import type { Tool, ToolExecutionContext } from "./types.js";
import {
  registerTool,
  getTool,
  getAllTools,
  getToolDefinitions,
} from "./registry.js";

function makeTool(name: string): Tool {
  const def: ToolDefinition = {
    name,
    description: `Test tool: ${name}`,
    parameters: { type: "object", properties: {} },
  };
  return {
    getDefinition: () => def,
    execute: async (_args: Record<string, unknown>, _ctx: ToolExecutionContext) =>
      `result from ${name}`,
  };
}

// The registry uses a module-level Map, so we need to work around
// state leaking between tests. We re-import with a fresh module
// by clearing the map via getAllTools + re-registering.
// For simplicity, these tests use unique tool names.
describe("tool registry", () => {
  it("registers and retrieves a tool", () => {
    const tool = makeTool("test_a");
    registerTool(tool);
    expect(getTool("test_a")).toBe(tool);
  });

  it("returns undefined for unknown tool", () => {
    expect(getTool("nonexistent")).toBeUndefined();
  });

  it("getAllTools returns all registered tools", () => {
    const tool = makeTool("test_b");
    registerTool(tool);
    const all = getAllTools();
    expect(all.length).toBeGreaterThanOrEqual(1);
    expect(all).toContain(tool);
  });

  it("getToolDefinitions returns definitions", () => {
    registerTool(makeTool("test_c"));
    const defs = getToolDefinitions();
    const names = defs.map((d) => d.name);
    expect(names).toContain("test_c");
  });
});
