export type ContentPart =
  | { type: "text"; text: string }
  | { type: "image"; data: string; mimeType: string };

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema object
}

export interface ModelInfo {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsToolCalls: boolean;
  supportsVision: boolean;
  costTier?: "low" | "medium" | "high";
  pricing?: { inputPer1k: number; outputPer1k: number };
}

export type GenerationEvent =
  | { type: "text"; delta: string }
  | { type: "reasoning"; delta: string }
  | { type: "tool_call"; id: string; name: string; args: unknown }
  | { type: "tool_result"; toolCallId: string; name: string; result: string; isError: boolean }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "done"; finishReason: string }
  | { type: "error"; message: string }
  | {
      type: "artifact";
      id: string;
      artifactType: string;
      title: string;
      language?: string;
      versionNumber: number;
    };

export interface ToolCallRecord {
  id: string;
  name: string;
  args: unknown;
}

export interface GenerationRequest {
  model: string;
  messages: Array<{
    role: "system" | "user" | "assistant" | "tool";
    content: string | ContentPart[];
    toolCallId?: string;
    toolName?: string;
    toolMetadata?: {
      toolCalls?: ToolCallRecord[];
      toolCallId?: string;
      toolName?: string;
      // DeepSeek/MiMo thinking mode: the reasoning from a tool-call turn must be
      // replayed on the assistant message in every subsequent request, or the
      // API rejects it with 400. Only set for assistant turns that have toolCalls.
      reasoningContent?: string;
    } | null;
  }>;
  tools?: ToolDefinition[];
  temperature?: number;
  maxTokens?: number;
  stop?: string[];
}

export interface ModelProvider {
  id: string;
  listModels(): Promise<ModelInfo[]>;
  stream(req: GenerationRequest): AsyncIterable<GenerationEvent>;
}
