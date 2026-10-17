import { useState } from "react";

export interface ToolCall {
  id: string;
  name: string;
  args: unknown;
  result?: string;
  status?: "calling" | "complete" | "error";
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4 text-brand-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  );
}
function CodeIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
    </svg>
  );
}
function ToolIcon() {
  return (
    <svg className="h-4 w-4 text-stone-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
  );
}
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin text-brand-500" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
function CheckIcon() {
  return (
    <svg className="h-4 w-4 text-emerald-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
    </svg>
  );
}
function ErrorIcon() {
  return (
    <svg className="h-4 w-4 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function iconFor(name: string) {
  if (name === "web_search") return <SearchIcon />;
  if (name === "run_code") return <CodeIcon />;
  return <ToolIcon />;
}
function verbFor(name: string) {
  if (name === "web_search") return "Searched the web";
  if (name === "run_code") return "Ran code";
  return `Used ${name}`;
}

/**
 * Renders one or many tool calls as a single compact, collapsible row. Looping
 * agents can fire the same tool repeatedly; grouping keeps the transcript clean
 * (e.g. "Searched the web · 6×") instead of stacking a card per call.
 */
export function ToolCallGroup({ calls, isStreaming }: { calls: ToolCall[]; isStreaming?: boolean }) {
  const [expanded, setExpanded] = useState(false);
  if (calls.length === 0) return null;

  const names = new Set(calls.map((c) => c.name));
  const sameKind = names.size === 1;
  const headerIcon = sameKind ? iconFor(calls[0].name) : <ToolIcon />;
  const label = sameKind ? verbFor(calls[0].name) : `Used ${calls.length} tools`;
  const countSuffix = sameKind && calls.length > 1 ? ` · ${calls.length}×` : "";

  const anyError = calls.some((c) => c.status === "error");
  const anyCalling = calls.some((c) => c.status === "calling");
  const statusIcon =
    isStreaming && anyCalling ? <Spinner /> : anyError ? <ErrorIcon /> : <CheckIcon />;

  return (
    <div className="my-2 rounded-xl border border-stone-200 dark:border-white/10">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-sm text-stone-600 transition-colors hover:bg-stone-200/50 dark:text-stone-300 dark:hover:bg-white/5"
        aria-expanded={expanded}
      >
        {headerIcon}
        <span>
          {label}
          {countSuffix}
        </span>
        {statusIcon}
        <svg
          className={`ml-auto h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (
        <div className="space-y-3 border-t border-stone-200 px-3 py-2.5 text-xs dark:border-white/10">
          {calls.map((c, i) => (
            <CallDetail key={c.id || i} call={c} />
          ))}
        </div>
      )}
    </div>
  );
}

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** Parse a web_search tool result, returning null if it isn't recognizable. */
function parseSearch(result?: string): { results?: SearchResult[]; error?: string } | null {
  if (!result) return null;
  try {
    const parsed = JSON.parse(result);
    if (parsed && (Array.isArray(parsed.results) || typeof parsed.error === "string")) {
      return parsed;
    }
  } catch {
    /* not JSON — fall through */
  }
  return null;
}

/** Renders one tool call: web_search gets polished source cards; others get raw JSON. */
function CallDetail({ call }: { call: ToolCall }) {
  const search = call.name === "web_search" ? parseSearch(call.result) : null;
  const query = (call.args as { query?: string } | null)?.query;

  return (
    <div>
      <div className="mb-1.5 flex items-center gap-1.5 font-medium text-stone-500 dark:text-stone-400">
        {iconFor(call.name)}
        <span>{call.name}</span>
        {call.name === "web_search" && query && (
          <span className="truncate font-normal text-stone-400 dark:text-stone-500">— “{query}”</span>
        )}
      </div>

      {search ? (
        search.error ? (
          <div className="rounded-lg bg-red-50 px-2.5 py-1.5 text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {search.error}
          </div>
        ) : (
          <ol className="space-y-1.5">
            {search.results?.map((r, idx) => (
              <li key={idx}>
                <a
                  href={r.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group/src block rounded-lg border border-stone-200 bg-white px-2.5 py-1.5 transition-colors hover:border-brand-300 hover:bg-brand-50/50 dark:border-white/10 dark:bg-white/[0.03] dark:hover:border-brand-500/40 dark:hover:bg-brand-500/10"
                >
                  <div className="flex items-center gap-1.5">
                    <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded bg-stone-100 text-[10px] font-semibold text-stone-500 dark:bg-white/10 dark:text-stone-400">
                      {idx + 1}
                    </span>
                    <span className="truncate font-medium text-stone-800 group-hover/src:text-brand-700 dark:text-stone-100 dark:group-hover/src:text-brand-300">
                      {r.title}
                    </span>
                  </div>
                  {r.snippet && (
                    <p className="mt-0.5 line-clamp-2 text-stone-500 dark:text-stone-400">{r.snippet}</p>
                  )}
                  {domainOf(r.url) && (
                    <span className="mt-0.5 block truncate text-[11px] text-stone-400 dark:text-stone-500">
                      {domainOf(r.url)}
                    </span>
                  )}
                </a>
              </li>
            ))}
          </ol>
        )
      ) : (
        <>
          <pre className="overflow-x-auto rounded-lg bg-stone-100 p-2 dark:bg-white/5">
            {JSON.stringify(call.args, null, 2)}
          </pre>
          {call.result && (
            <pre className="mt-1 max-h-40 overflow-auto rounded-lg bg-stone-100 p-2 dark:bg-white/5">
              {call.result}
            </pre>
          )}
        </>
      )}
    </div>
  );
}
