import type { ToolDefinition } from "@openchat/shared";

export interface ToolExecutionContext {
  conversationId: string;
  userId: string;
  signal?: AbortSignal;
}

export interface Tool {
  getDefinition(): ToolDefinition;
  execute(
    args: Record<string, unknown>,
    context: ToolExecutionContext,
  ): Promise<string>;
}
