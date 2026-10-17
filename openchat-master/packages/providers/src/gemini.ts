import { GoogleGenerativeAI } from "@google/generative-ai";
import type {
  ModelProvider,
  ModelInfo,
  GenerationRequest,
  GenerationEvent,
} from "@openchat/shared";

const MODELS: ModelInfo[] = [
  {
    id: "gemini-2.5-pro",
    name: "Gemini 2.5 Pro",
    contextWindow: 1_000_000,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    costTier: "medium",
    pricing: { inputPer1k: 1.25, outputPer1k: 10.0 },
  },
  {
    id: "gemini-2.5-flash",
    name: "Gemini 2.5 Flash",
    contextWindow: 1_000_000,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    costTier: "low",
    pricing: { inputPer1k: 0.15, outputPer1k: 0.6 },
  },
  {
    id: "gemini-2.0-flash",
    name: "Gemini 2.0 Flash",
    contextWindow: 1_000_000,
    maxOutputTokens: 8192,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    costTier: "low",
    pricing: { inputPer1k: 0.1, outputPer1k: 0.4 },
  },
];

export class GeminiProvider implements ModelProvider {
  readonly id = "gemini";
  private apiKey: string;
  private client: GoogleGenerativeAI | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getClient(): GoogleGenerativeAI {
    if (!this.client) {
      this.client = new GoogleGenerativeAI(this.apiKey);
    }
    return this.client;
  }

  async listModels(): Promise<ModelInfo[]> {
    return MODELS;
  }

  async *stream(req: GenerationRequest): AsyncIterable<GenerationEvent> {
    try {
      const genAI = this.getClient();
      const sysMsg = req.messages.find((m) => m.role === "system");
      const model = genAI.getGenerativeModel({
        model: req.model,
        systemInstruction:
          typeof sysMsg?.content === "string" ? sysMsg.content : undefined,
      });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const contents: any[] = req.messages
        .filter((m) => m.role !== "system")
        .map((m) => {
          // Tool result messages → functionResponse part
          if (m.role === "tool") {
            return {
              role: "user",
              parts: [{
                functionResponse: {
                  name: m.toolName ?? "unknown",
                  response: {
                    content: typeof m.content === "string" ? m.content : JSON.stringify(m.content),
                  },
                },
              }],
            };
          }
          // Assistant messages with tool calls → functionCall parts
          if (m.role === "assistant" && m.toolMetadata?.toolCalls?.length) {
            return {
              role: "model",
              parts: m.toolMetadata.toolCalls.map((tc) => ({
                functionCall: {
                  name: tc.name,
                  args: tc.args,
                },
              })),
            };
          }
          // Regular messages
          const parts =
            typeof m.content === "string"
              ? [{ text: m.content }]
              : m.content.map((p) =>
                  p.type === "text"
                    ? { text: p.text }
                    : { inlineData: { mimeType: p.mimeType, data: p.data } },
                );
          return {
            role: m.role === "assistant" ? "model" : "user",
            parts,
          };
        });

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const tools: any[] | undefined = req.tools?.map((t) => ({
        functionDeclarations: [{
          name: t.name,
          description: t.description,
          parameters: t.parameters,
        }],
      }));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = await (model as any).generateContentStream({
        contents,
        generationConfig: {
          temperature: req.temperature,
          maxOutputTokens: req.maxTokens,
          stopSequences: req.stop,
        },
        ...(tools?.length ? { tools } : {}),
      });

      let inputTokens = 0;
      let outputTokens = 0;
      let hasFunctionCalls = false;

      for await (const chunk of result.stream) {
        const text = chunk.text();
        if (text) {
          yield { type: "text", delta: text };
        }

        // Check for function calls in the chunk
        const parts = chunk.candidates?.[0]?.content?.parts ?? [];
        for (const part of parts) {
          if (part.functionCall) {
            hasFunctionCalls = true;
            yield {
              type: "tool_call",
              id: `gemini-${Date.now()}-${Math.random().toString(36).slice(2)}`,
              name: part.functionCall.name,
              args: part.functionCall.args ?? {},
            };
          }
        }

        const usage = chunk.usageMetadata;
        if (usage) {
          inputTokens = usage.promptTokenCount ?? 0;
          outputTokens = usage.candidatesTokenCount ?? 0;
        }
      }

      yield { type: "done", finishReason: hasFunctionCalls ? "tool_calls" : "stop" };
      yield { type: "usage", inputTokens, outputTokens };
    } catch (err) {
      yield { type: "error", message: String(err) };
    }
  }
}
