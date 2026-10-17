import type { ModelProvider } from "@openchat/shared";
import { OpenAIProvider } from "./openai.js";
import { GeminiProvider } from "./gemini.js";
import { AnthropicProvider } from "./anthropic.js";
import { DeepSeekProvider } from "./deepseek.js";
import { MiMoProvider } from "./mimo.js";
import { OpenRouterProvider } from "./openrouter.js";

export type { ModelProvider, ModelInfo, GenerationEvent, GenerationRequest } from "@openchat/shared";

let _openai: OpenAIProvider | null = null;
let _gemini: GeminiProvider | null = null;
let _anthropic: AnthropicProvider | null = null;
let _deepseek: DeepSeekProvider | null = null;
let _mimo: MiMoProvider | null = null;
let _openrouter: OpenRouterProvider | null = null;

function getOpenAI(): OpenAIProvider {
  if (!_openai) {
    _openai = new OpenAIProvider(process.env.OPENAI_API_KEY ?? "");
  }
  return _openai;
}

function getGemini(): GeminiProvider {
  if (!_gemini) {
    _gemini = new GeminiProvider(process.env.GOOGLE_API_KEY ?? "");
  }
  return _gemini;
}

function getAnthropic(): AnthropicProvider {
  if (!_anthropic) {
    _anthropic = new AnthropicProvider(process.env.ANTHROPIC_API_KEY ?? "");
  }
  return _anthropic;
}

function getDeepSeek(): DeepSeekProvider {
  if (!_deepseek) {
    _deepseek = new DeepSeekProvider(process.env.DEEPSEEK_API_KEY ?? "");
  }
  return _deepseek;
}

function getMiMo(): MiMoProvider {
  if (!_mimo) {
    _mimo = new MiMoProvider(process.env.MIMO_API_KEY ?? "");
  }
  return _mimo;
}

function getOpenRouter(): OpenRouterProvider {
  if (!_openrouter) {
    _openrouter = new OpenRouterProvider(process.env.OPENROUTER_API_KEY ?? "");
  }
  return _openrouter;
}

const PROVIDER_MAP: Record<string, () => ModelProvider> = {
  openai: getOpenAI,
  gemini: getGemini,
  anthropic: getAnthropic,
  deepseek: getDeepSeek,
  mimo: getMiMo,
  openrouter: getOpenRouter,
};

export function getProvider(id: string): ModelProvider {
  const factory = PROVIDER_MAP[id];
  if (!factory) {
    throw new Error(`Unknown provider: ${id}`);
  }
  return factory();
}

export function resolveProvider(model: string): ModelProvider {
  // OpenRouter model ids are namespaced "vendor/model" (e.g.
  // "meta-llama/llama-3.1-8b-instruct:free"); the slash is the reliable signal.
  if (model.includes("/")) return getProvider("openrouter");
  if (model.startsWith("gpt-") || model.startsWith("chatgpt-") || /^o[0-9]/.test(model))
    return getProvider("openai");
  if (model.startsWith("gemini-")) return getProvider("gemini");
  if (model.startsWith("claude-")) return getProvider("anthropic");
  if (model.startsWith("deepseek-")) return getProvider("deepseek");
  if (model.startsWith("mimo-")) return getProvider("mimo");
  // Default to openai for unknown models
  return getProvider("openai");
}

export function getAllProviders(): ModelProvider[] {
  return Object.values(PROVIDER_MAP).map((f) => f());
}

export { chunkText, embedText, embedBatch, embeddingsConfigured } from "./embeddings.js";
