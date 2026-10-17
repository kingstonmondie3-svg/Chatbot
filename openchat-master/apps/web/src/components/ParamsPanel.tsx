import { useState, useEffect, useRef } from "react";
import type { ConversationParams } from "../stores/conversations";

interface ParamsPanelProps {
  params: ConversationParams;
  onChange: (params: ConversationParams) => void;
}

export function ParamsPanel({ params, onChange }: ParamsPanelProps) {
  const [temperature, setTemperature] = useState(params.temperature ?? 1.0);
  const [maxTokens, setMaxTokens] = useState(params.maxTokens ?? "");
  const [systemPrompt, setSystemPrompt] = useState(params.systemPrompt ?? "");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Sync from props when conversation changes
  useEffect(() => {
    setTemperature(params.temperature ?? 1.0);
    setMaxTokens(params.maxTokens?.toString() ?? "");
    setSystemPrompt(params.systemPrompt ?? "");
  }, [params]);

  const debouncedChange = (next: ConversationParams) => {
    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => onChange(next), 500);
  };

  const handleTemperatureChange = (val: number) => {
    setTemperature(val);
    debouncedChange({ temperature: val, maxTokens: maxTokens ? Number(maxTokens) : undefined, systemPrompt: systemPrompt || undefined });
  };

  const handleMaxTokensChange = (val: string) => {
    setMaxTokens(val);
    debouncedChange({ temperature, maxTokens: val ? Number(val) : undefined, systemPrompt: systemPrompt || undefined });
  };

  const handleSystemPromptChange = (val: string) => {
    setSystemPrompt(val);
    debouncedChange({ temperature, maxTokens: maxTokens ? Number(maxTokens) : undefined, systemPrompt: val || undefined });
  };

  return (
    <div className="border-b border-stone-200/80 bg-stone-100/50 px-4 py-3 dark:border-white/10 dark:bg-white/[0.03]">
      <div className="flex flex-wrap items-center gap-6">
        {/* Temperature */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Temperature
          </label>
          <input
            type="range"
            min={0}
            max={2}
            step={0.1}
            value={temperature}
            onChange={(e) => handleTemperatureChange(Number(e.target.value))}
            className="w-24"
          />
          <span className="w-8 text-xs text-stone-600 dark:text-stone-300">
            {temperature.toFixed(1)}
          </span>
        </div>

        {/* Max tokens */}
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
            Max tokens
          </label>
          <input
            type="number"
            min={1}
            max={128000}
            value={maxTokens}
            onChange={(e) => handleMaxTokensChange(e.target.value)}
            placeholder="auto"
            className="w-20 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5"
          />
        </div>

        {/* System prompt */}
        <div className="flex flex-1 items-center gap-2">
          <label className="text-xs font-medium text-stone-500 dark:text-stone-400">
            System prompt
          </label>
          <input
            type="text"
            value={systemPrompt}
            onChange={(e) => handleSystemPromptChange(e.target.value)}
            placeholder="Override system prompt..."
            className="flex-1 rounded-lg border border-stone-200 bg-white px-2 py-1 text-xs focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5"
          />
        </div>
      </div>
    </div>
  );
}
