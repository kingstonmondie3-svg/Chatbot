import { describe, it, expect } from "vitest";
import type { ModelProvider } from "@openchat/shared";

describe("@openchat/providers", () => {
  it("re-exports ModelProvider from @openchat/shared", () => {
    const provider: ModelProvider = {
      id: "test-provider",
      listModels: async () => [],
      stream: async function* () {},
    };
    expect(provider.id).toBe("test-provider");
  });
});
