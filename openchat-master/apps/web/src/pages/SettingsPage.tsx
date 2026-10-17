import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

interface Settings {
  theme: string;
  customInstructions: string | null;
  defaultModel: string | null;
  memoryEnabled: boolean;
  responseStyle: string;
}

const RESPONSE_STYLES = [
  { value: "concise", label: "Concise", description: "Brief and to the point" },
  { value: "balanced", label: "Balanced", description: "Default balanced approach" },
  { value: "detailed", label: "Detailed", description: "Thorough with examples" },
  { value: "formal", label: "Formal", description: "Professional tone" },
];

export function SettingsPage() {
  const navigate = useNavigate();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [customInstructions, setCustomInstructions] = useState("");
  const [responseStyle, setResponseStyle] = useState("balanced");
  const [memoryEnabled, setMemoryEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((res) => res.json())
      .then((data: Settings) => {
        setSettings(data);
        setCustomInstructions(data.customInstructions ?? "");
        setResponseStyle(data.responseStyle ?? "balanced");
        setMemoryEnabled(data.memoryEnabled);
      })
      .catch(() => {});
  }, []);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customInstructions: customInstructions || null,
          responseStyle,
          memoryEnabled,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch {
      // ignore
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Loading settings...
        </p>
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      {/* Header */}
      <div className="shrink-0 border-b border-stone-200/80 px-6 py-4 dark:border-white/10">
        <h2 className="font-serif text-lg font-semibold text-stone-900 dark:text-stone-100">
          Settings
        </h2>
        <p className="text-sm text-stone-500 dark:text-stone-400">
          Customize how OpenChat behaves.
        </p>
      </div>

      {/* Content — min-h-0 lets this flex child actually scroll instead of
          overflowing the frame when its content is taller than the viewport. */}
      <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
        <div className="mx-auto max-w-2xl space-y-8">
          {/* Custom Instructions */}
          <section>
            <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100">
              Custom Instructions
            </h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              These instructions are added to every conversation's system prompt.
            </p>
            <textarea
              value={customInstructions}
              onChange={(e) => setCustomInstructions(e.target.value)}
              placeholder="e.g., Always respond in Spanish. Be concise."
              className="mt-2 w-full rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-900 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-100"
              rows={4}
            />
          </section>

          {/* Memory */}
          <section>
            <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100">
              Memory
            </h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              When enabled, OpenChat remembers facts from your conversations to
              personalize responses.
            </p>
            <div className="mt-3 flex items-center justify-between rounded-xl border border-stone-200/80 p-4 dark:border-white/10">
              <div>
                <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                  Memory {memoryEnabled ? "enabled" : "disabled"}
                </p>
                <p className="text-xs text-stone-500 dark:text-stone-400">
                  {memoryEnabled
                    ? "OpenChat will remember facts from conversations."
                    : "OpenChat will not remember or recall any facts."}
                </p>
              </div>
              <button
                onClick={() => setMemoryEnabled(!memoryEnabled)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  memoryEnabled
                    ? "bg-brand-600"
                    : "bg-stone-300 dark:bg-white/15"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition-transform ${
                    memoryEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
            <button
              onClick={() => navigate("/memory")}
              className="mt-2 text-sm text-brand-600 transition-colors hover:text-brand-700 dark:text-brand-400 dark:hover:text-brand-300"
            >
              View and manage memories
            </button>
          </section>

          {/* Response Style */}
          <section>
            <h3 className="text-sm font-medium text-stone-900 dark:text-stone-100">
              Response Style
            </h3>
            <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
              Control how verbose and formal the AI's responses are.
            </p>
            <div className="mt-3 space-y-2">
              {RESPONSE_STYLES.map((style) => (
                <label
                  key={style.value}
                  className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 transition-colors ${
                    responseStyle === style.value
                      ? "border-brand-500 bg-brand-50 dark:border-brand-400/50 dark:bg-brand-500/10"
                      : "border-stone-200/80 hover:bg-stone-100/60 dark:border-white/10 dark:hover:bg-white/5"
                  }`}
                >
                  <input
                    type="radio"
                    name="responseStyle"
                    value={style.value}
                    checked={responseStyle === style.value}
                    onChange={(e) => setResponseStyle(e.target.value)}
                    className="h-4 w-4 border-stone-300 text-brand-600 focus:ring-brand-500"
                  />
                  <div>
                    <p className="text-sm font-medium text-stone-900 dark:text-stone-100">
                      {style.label}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {style.description}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </section>

          {/* Save button */}
          <div className="flex justify-end border-t border-stone-200/80 pt-4 dark:border-white/10">
            <button
              onClick={handleSave}
              disabled={isSaving}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {isSaving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
