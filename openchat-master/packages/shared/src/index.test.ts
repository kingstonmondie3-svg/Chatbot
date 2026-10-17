import { describe, it, expect } from "vitest";
import type { ModelInfo, GenerationEvent, ModelProvider } from "./index.js";

describe("@openchat/shared", () => {
  it("exports ModelInfo type", () => {
    const model: ModelInfo = {
      id: "test-model",
      name: "Test Model",
      contextWindow: 4096,
      maxOutputTokens: 1024,
      supportsStreaming: true,
      supportsToolCalls: false,
      supportsVision: false,
    };
    expect(model.id).toBe("test-model");
  });

  it("exports GenerationEvent type", () => {
    const event: GenerationEvent = { type: "text", delta: "hello" };
    expect(event.type).toBe("text");
  });

  it("exports ModelProvider interface shape", () => {
    // Verify the interface is importable and has the expected shape
    const provider: ModelProvider = {
      id: "test",
      listModels: async () => [],
      stream: async function* () {},
    };
    expect(provider.id).toBe("test");
  });
});
