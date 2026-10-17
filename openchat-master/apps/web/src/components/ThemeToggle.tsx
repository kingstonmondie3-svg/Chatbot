import { useThemeStore } from "../stores/theme";

const options = [
  { value: "light" as const, label: "Light", icon: "☀" },
  { value: "dark" as const, label: "Dark", icon: "☾" },
  { value: "system" as const, label: "System", icon: "⚙" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useThemeStore();

  return (
    <div className="flex rounded-lg border border-stone-200/80 p-0.5 dark:border-white/10">
      {options.map((opt) => (
        <button
          key={opt.value}
          onClick={() => setTheme(opt.value)}
          className={`rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
            theme === opt.value
              ? "bg-stone-200 text-stone-900 dark:bg-white/10 dark:text-stone-100"
              : "text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          }`}
          title={opt.label}
        >
          <span className="mr-1">{opt.icon}</span>
          {opt.label}
        </button>
      ))}
    </div>
  );
}
