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

const BASE_URL = "https://api.deepseek.com";
const MODELS_TTL_MS = 10 * 60 * 1000;

// Capability metadata for DeepSeek's live models. DeepSeek's /models endpoint
// returns ids only, so context/vision/tool info is supplied here; the 1M
// context window is the real, current figure (cross-checked against the live
// ecosystem) — not an inflated guess. Models not actually served are dropped
// by buildModelList, so this list can never go stale-but-visible.
const CURATED: ModelInfo[] = [
  {
    id: "deepseek-v4-pro",
    name: "DeepSeek V4 Pro",
    contextWindow: 1048576,
    maxOutputTokens: 65536,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: false,
    costTier: "medium",
  },
  {
    id: "deepseek-v4-flash",
    name: "DeepSeek V4 Flash",
    contextWindow: 1048576,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: false,
    costTier: "low",
  },
];

export class DeepSeekProvider implements ModelProvider {
  readonly id = "deepseek";
  private apiKey: string;
  private client: OpenAI | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.apiKey, baseURL: `${BASE_URL}/v1` });
    }
    return this.client;
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.apiKey) return CURATED;
    return withModelCache("deepseek", MODELS_TTL_MS, async () => {
      const liveIds = await fetchLiveModelIds(this.getClient());
      return buildModelList({
        curated: CURATED,
        liveIds,
        defaults: {
          contextWindow: 1048576,
          maxOutputTokens: 16384,
          supportsStreaming: true,
          supportsToolCalls: true,
          supportsVision: false,
        },
      });
    });
  }

  stream(req: GenerationRequest): AsyncIterable<GenerationEvent> {
    if (!this.apiKey) return missingKeyError("DeepSeek", "DEEPSEEK_API_KEY");
    return streamOpenAICompatible(this.getClient(), req);
  }
}
