import { describe, it, expect } from "vitest";
import { CodeExecutionTool } from "./code-execution.js";
import type { ToolExecutionContext } from "./types.js";

const ctx: ToolExecutionContext = {
  conversationId: "conv-1",
  userId: "user-1",
};

describe("CodeExecutionTool", () => {
  it("returns a valid tool definition", () => {
    const tool = new CodeExecutionTool();
    const def = tool.getDefinition();

    expect(def.name).toBe("run_code");
    expect(def.description).toContain("sandboxed");
    const params = def.parameters as { properties: { language: unknown; code: unknown } };
    expect(params.properties.language).toBeDefined();
    expect(params.properties.code).toBeDefined();
  });

  it("returns error for missing language", async () => {
    const tool = new CodeExecutionTool();
    const output = await tool.execute({ code: "print(1)" }, ctx);
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
    expect(parsed.error).toContain("language");
  });

  it("returns error for missing code", async () => {
    const tool = new CodeExecutionTool();
    const output = await tool.execute({ language: "python" }, ctx);
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
    expect(parsed.error).toContain("code");
  });

  it("returns error for invalid language type", async () => {
    const tool = new CodeExecutionTool();
    const output = await tool.execute({ language: 123, code: "x" }, ctx);
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
  });

  it("returns error when code execution is disabled", async () => {
    // The default env doesn't have dockerode installed, so it should
    // return an error about missing dockerode or disabled execution
    const tool = new CodeExecutionTool();
    const output = await tool.execute(
      { language: "python", code: "print(1)" },
      ctx,
    );
    const parsed = JSON.parse(output);
    // Either code execution is disabled or dockerode is missing
    expect(parsed.error).toBeDefined();
  });
});
