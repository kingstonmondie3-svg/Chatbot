import Anthropic from "@anthropic-ai/sdk";
import type {
  ModelProvider,
  ModelInfo,
  GenerationRequest,
  GenerationEvent,
} from "@openchat/shared";

const MODELS: ModelInfo[] = [
  {
    id: "claude-sonnet-4-20250514",
    name: "Claude Sonnet 4",
    contextWindow: 200_000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    costTier: "medium",
    pricing: { inputPer1k: 3.0, outputPer1k: 15.0 },
  },
  {
    id: "claude-haiku-35-20241022",
    name: "Claude 3.5 Haiku",
    contextWindow: 200_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    costTier: "low",
    pricing: { inputPer1k: 0.8, outputPer1k: 4.0 },
  },
];

export class AnthropicProvider implements ModelProvider {
  readonly id = "anthropic";
  private apiKey: string;
  private client: Anthropic | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getClient(): Anthropic {
    if (!this.client) {
      this.client = new Anthropic({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async listModels(): Promise<ModelInfo[]> {
    return MODELS;
  }

  async *stream(req: GenerationRequest): AsyncIterable<GenerationEvent> {
    try {
      const client = this.getClient();

      const systemMessage = req.messages.find((m) => m.role === "system");
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messages: any[] = req.messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          // Tool result messages → user message with tool_result content block
          if (m.role === "tool") {
            return {
              role: "user" as const,
              content: [{
                type: "tool_result" as const,
                tool_use_id: m.toolCallId,
                content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
              }],
            };
          }
          // Assistant messages with tool calls → include tool_use content blocks
          if (m.role === "assistant" && m.toolMetadata?.toolCalls?.length) {
            const blocks: Anthropic.ContentBlockParam[] = [];
            if (typeof m.content === "string" && m.content) {
              blocks.push({ type: "text" as const, text: m.content });
            }
            for (const tc of m.toolMetadata.toolCalls) {
              blocks.push({
                type: "tool_use" as const,
                id: tc.id,
                name: tc.name,
                input: tc.args,
              } as Anthropic.ToolUseBlock);
            }
            return { role: "assistant" as const, content: blocks };
          }
          // Regular messages
          if (typeof m.content === "string") {
            return { role: m.role as "user" | "assistant", content: m.content };
          }
          const content = m.content.map((p) =>
            p.type === "text"
              ? { type: "text" as const, text: p.text }
              : {
                  type: "image" as const,
                  source: {
                    type: "base64" as const,
                    media_type: p.mimeType as
                      | "image/jpeg"
                      | "image/png"
                      | "image/gif"
                      | "image/webp",
                    data: p.data,
                  },
                },
          );
          return {
            role: m.role as "user" | "assistant",
            content: content as Anthropic.ContentBlockParam[],
          };
        });

      const model = MODELS.find((m) => m.id === req.model);
      const maxTokens = req.maxTokens ?? model?.maxOutputTokens ?? 4096;

      const systemContent =
        typeof systemMessage?.content === "string"
          ? systemMessage.content
          : undefined;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools: any[] | undefined = req.tools?.map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.parameters,
      }));

      const stream = client.messages.stream({
        model: req.model,
        max_tokens: maxTokens,
        temperature: req.temperature,
        stop_sequences: req.stop,
        system: systemContent,
        messages,
        ...(tools?.length ? { tools } : {}),
      });

      let inputTokens = 0;
      let outputTokens = 0;
      let stopReason: string | null = null;
      const toolUseBlocks = new Map<
        number,
        { id: string; name: string; json: string }
      >();

      for await (const event of stream) {
        // Text deltas
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "text_delta"
        ) {
          yield { type: "text", delta: event.delta.text };
        }

        // Tool use block start
        if (
          event.type === "content_block_start" &&
          event.content_block.type === "tool_use"
        ) {
          toolUseBlocks.set(event.index, {
            id: event.content_block.id,
            name: event.content_block.name,
            json: "",
          });
        }

        // Tool use input JSON deltas
        if (
          event.type === "content_block_delta" &&
          event.delta.type === "input_json_delta"
        ) {
          const block = toolUseBlocks.get(event.index);
          if (block) {
            block.json += event.delta.partial_json;
          }
        }

        if (event.type === "message_delta") {
          if (event.usage) {
            outputTokens = event.usage.output_tokens;
          }
          stopReason = event.delta.stop_reason ?? "end_turn";
        }

        if (event.type === "message_start" && event.message.usage) {
          inputTokens = event.message.usage.input_tokens;
        }
      }

      // Yield tool_call events if the model requested tool use
      if (stopReason === "tool_use") {
        for (const tc of toolUseBlocks.values()) {
          let parsedArgs: unknown;
          try {
            parsedArgs = JSON.parse(tc.json);
          } catch {
            parsedArgs = tc.json;
          }
          yield {
            type: "tool_call",
            id: tc.id,
            name: tc.name,
            args: parsedArgs,
          };
        }
      }

      if (stopReason) {
        yield { type: "done", finishReason: stopReason };
      }

      yield { type: "usage", inputTokens, outputTokens };
    } catch (err) {
      yield { type: "error", message: String(err) };
    }
  }
}
