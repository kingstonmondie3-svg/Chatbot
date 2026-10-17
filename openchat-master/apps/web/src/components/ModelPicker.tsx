import { useEffect } from "react";
import { useConversationsStore } from "../stores/conversations";

interface ModelWithProvider {
  id: string;
  name: string;
  contextWindow: number;
  maxOutputTokens: number;
  supportsStreaming: boolean;
  supportsToolCalls: boolean;
  supportsVision: boolean;
  costTier?: "low" | "medium" | "high";
  pricing?: { inputPer1k: number; outputPer1k: number };
  providerId?: string;
}

interface ModelPickerProps {
  value: string;
  onChange: (model: string) => void;
}

export function ModelPicker({ value, onChange }: ModelPickerProps) {
  const { models, fetchModels } = useConversationsStore();

  useEffect(() => {
    if (models.length === 0) {
      fetchModels();
    }
  }, [models.length, fetchModels]);

  // Group by provider
  const grouped = (models as ModelWithProvider[]).reduce<Record<string, ModelWithProvider[]>>((acc, m) => {
    const key = m.providerId ?? "unknown";
    (acc[key] ??= []).push(m);
    return acc;
  }, {});

  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="cursor-pointer rounded-lg border border-stone-200 bg-white px-3 py-1.5 text-sm font-medium text-stone-700 transition-colors hover:border-stone-300 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-200"
    >
      {Object.entries(grouped).map(([provider, providerModels]) => (
        <optgroup key={provider} label={provider.charAt(0).toUpperCase() + provider.slice(1)}>
          {providerModels.map((m) => (
            <option key={m.id} value={m.id}>
              {m.name}
              {m.contextWindow >= 1000000
                ? ` (${Math.round(m.contextWindow / 1000000)}M ctx)`
                : ` (${Math.round(m.contextWindow / 1000)}k ctx)`}
              {m.costTier ? ` [${m.costTier}]` : ""}
            </option>
          ))}
        </optgroup>
      ))}
      {models.length === 0 && <option value={value}>{value}</option>}
    </select>
  );
}
