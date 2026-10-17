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

const BASE_URL = "https://api.xiaomimimo.com/v1";
const MODELS_TTL_MS = 10 * 60 * 1000;

// Capability metadata for MiMo's live models (ids returned bare by /models).
// The 1M context windows are real, current figures cross-checked against the
// live ecosystem. buildModelList drops any not actually served, so adding a
// MiMo key reconciles this to whatever the API really exposes.
const CURATED: ModelInfo[] = [
  {
    id: "mimo-v2.5-pro",
    name: "MiMo V2.5 Pro",
    contextWindow: 1048576,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: false,
    costTier: "medium",
  },
  {
    id: "mimo-v2.5",
    name: "MiMo V2.5 (vision)",
    contextWindow: 1048576,
    maxOutputTokens: 16384,
    supportsStreaming: true,
    supportsToolCalls: true,
    supportsVision: true,
    costTier: "medium",
  },
];

export class MiMoProvider implements ModelProvider {
  readonly id = "mimo";
  private apiKey: string;
  private client: OpenAI | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({ apiKey: this.apiKey, baseURL: BASE_URL });
    }
    return this.client;
  }

  async listModels(): Promise<ModelInfo[]> {
    if (!this.apiKey) return CURATED;
    return withModelCache("mimo", MODELS_TTL_MS, async () => {
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
    if (!this.apiKey) return missingKeyError("MiMo", "MIMO_API_KEY");
    return streamOpenAICompatible(this.getClient(), req);
  }
}
