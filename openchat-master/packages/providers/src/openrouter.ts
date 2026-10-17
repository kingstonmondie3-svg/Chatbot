import OpenAI from "openai";
import type {
  ModelProvider,
  ModelInfo,
  GenerationRequest,
  GenerationEvent,
} from "@openchat/shared";
import { streamOpenAICompatible, withModelCache, missingKeyError } from "./openai-compat.js";

const BASE_URL = "https://openrouter.ai/api/v1";
const MODELS_TTL_MS = 10 * 60 * 1000; // 10 minutes

/** Subset of the OpenRouter `/models` payload we rely on. */
interface OpenRouterModel {
  id: string;
  name?: string;
  context_length?: number;
  architecture?: {
    input_modalities?: string[];
    output_modalities?: string[];
  };
  pricing?: {
    prompt?: string;
    completion?: string;
  };
  top_provider?: {
    max_completion_tokens?: number | null;
    context_length?: number | null;
  };
  supported_parameters?: string[];
}

function isFree(m: OpenRouterModel): boolean {
  if (m.id.endsWith(":free")) return true;
  const prompt = Number(m.pricing?.prompt ?? "0");
  const completion = Number(m.pricing?.completion ?? "0");
  return prompt === 0 && completion === 0;
}

function costTierFor(m: OpenRouterModel): "low" | "medium" | "high" {
  if (isFree(m)) return "low";
  const outPer1k = Number(m.pricing?.completion ?? "0") * 1000;
  if (outPer1k < 1) return "low";
  if (outPer1k < 10) return "medium";
  return "high";
}

function toModelInfo(m: OpenRouterModel): ModelInfo {
  const free = isFree(m);
  const ctx = m.context_length ?? m.top_provider?.context_length ?? 8192;
  const baseName = m.name ?? m.id;
  return {
    id: m.id,
    name: free && !/free/i.test(baseName) ? `${baseName} · free` : baseName,
    contextWindow: ctx,
    maxOutputTokens: m.top_provider?.max_completion_tokens ?? Math.min(ctx, 8192),
    supportsStreaming: true,
    supportsToolCalls: m.supported_parameters?.includes("tools") ?? false,
    supportsVision: m.architecture?.input_modalities?.includes("image") ?? false,
    costTier: costTierFor(m),
    pricing: {
      inputPer1k: Number(m.pricing?.prompt ?? "0") * 1000,
      outputPer1k: Number(m.pricing?.completion ?? "0") * 1000,
    },
  };
}

/**
 * OpenRouter aggregates hundreds of models behind one OpenAI-compatible API.
 * Listing is public (no key needed); the user's key is only required to run a
 * completion. Free models are surfaced first so they're easy to find.
 */
export class OpenRouterProvider implements ModelProvider {
  readonly id = "openrouter";
  private apiKey: string;
  private client: OpenAI | null = null;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private getClient(): OpenAI {
    if (!this.client) {
      this.client = new OpenAI({
        apiKey: this.apiKey,
        baseURL: BASE_URL,
        // OpenRouter uses these for attribution / rankings; harmless if unset.
        defaultHeaders: {
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL ?? "https://openchat.local",
          "X-Title": "OpenChat",
        },
      });
    }
    return this.client;
  }

  async listModels(): Promise<ModelInfo[]> {
    return withModelCache("openrouter", MODELS_TTL_MS, async () => {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 6000);
      try {
        const res = await fetch(`${BASE_URL}/models`, {
          headers: this.apiKey ? { Authorization: `Bearer ${this.apiKey}` } : {},
          signal: controller.signal,
        });
        if (!res.ok) return [];
        const body = (await res.json()) as { data?: OpenRouterModel[] };
        // Default to free-only so the picker stays focused on no-cost models;
        // set OPENROUTER_FREE_ONLY=false to also list paid models.
        const freeOnly = (process.env.OPENROUTER_FREE_ONLY ?? "true").toLowerCase() !== "false";
        const models = (body.data ?? [])
          // Keep text-output (chat) models. Drops media generators like Lyria
          // (output ["text","audio"]) that can't hold a conversation.
          .filter((m) => {
            const out = m.architecture?.output_modalities;
            if (!out) return true;
            return out.includes("text") && !out.some((o) => o === "audio" || o === "image" || o === "video");
          })
          .filter((m) => !freeOnly || isFree(m))
          .map(toModelInfo);
        // Free first, then alphabetically — keeps the long list navigable.
        models.sort((a, b) => {
          const aFree = (a.pricing?.outputPer1k ?? 0) === 0 && (a.pricing?.inputPer1k ?? 0) === 0;
          const bFree = (b.pricing?.outputPer1k ?? 0) === 0 && (b.pricing?.inputPer1k ?? 0) === 0;
          if (aFree !== bFree) return aFree ? -1 : 1;
          return a.name.localeCompare(b.name);
        });
        return models;
      } catch {
        return [];
      } finally {
        clearTimeout(timeout);
      }
    });
  }

  stream(req: GenerationRequest): AsyncIterable<GenerationEvent> {
    if (!this.apiKey) return missingKeyError("OpenRouter", "OPENROUTER_API_KEY");
    return streamOpenAICompatible(this.getClient(), req);
  }
}
