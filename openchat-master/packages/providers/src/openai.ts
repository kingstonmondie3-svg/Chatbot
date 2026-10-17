import OpenAI from "openai";
import type {
  ModelProvider,
  ModelInfo,
  GenerationRequest,
  GenerationEvent,
} from "@openchat/shared";
import {
  streamOpenAICompatible,
  fetchLiveModelIds,
  buildModelList,
  withModelCache,
  missingKeyError,
} from "./openai-compat.js";

const MODELS_TTL_MS = 10 * 60 * 1000;

// Curated entries carry rich capability metadata; any newer models the account
// has access to are discovered live and appended (see listModels).
const CURATED: ModelInfo[] = [
  {
    id: "gpt-4o-mini",
    name: "GPT-4o Mini",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    costTier: "low",
  },
  {
    id: "gpt-4o",
    name: "GPT-4o",
    contextWindow: 128000,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    costTier: "medium",
  },
  {
    id: "gpt-4-turbo",
    name: "GPT-4 Turbo",
    contextWindow: 128000,
    maxOutputTokens: 4096,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    costTier: "high",
  },
];

// Keep chat/completion models; drop embeddings, audio, image, moderation, etc.
function isChatModel(id: string): boolean {
  if (/embedding|whisper|tts|dall-e|moderation|audio|realtime|image|search|transcribe/i.test(id)) {
    return false;
  }
  return /^(gpt-|chatgpt-|o[0-9])/i.test(id);
}

export class OpenAIProvider implements ModelProvider {
  readonly id = "openai";
  private apiKey: string;
  private client: OpenAI | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.apiKey });
    }
    return this.client;
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.apiKey) return CURATED;
    return withModelCache("openai", MODELS_TTL_MS, async () => {
      const liveIds = await fetchLiveModelIds(this.getClient());
      return buildModelList({
        curated: CURATED,
        liveIds,
        filter: isChatModel,
        defaults: {
          contextWindow: 128000,
          maxOutputTokens: 16384,
          supportsStreaming: true,
          supportsToolCalls: true,
          supportsVision: true,
        },
      });
    });
  }

  stream(req: GenerationRequest): AsyncIterable<GenerationEvent> {
    if (!this.apiKey) return missingKeyError("OpenAI", "OPENAI_API_KEY");
    return streamOpenAICompatible(this.getClient(), req);
  }
}
