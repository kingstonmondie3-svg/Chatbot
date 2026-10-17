import type { ToolDefinition } from "@openchat/shared";

/**
 * Text-protocol tool calling for models without native function calling
 * (many open / free models). The model is told to emit a fenced `tool_call`
 * block; we parse those blocks out of the stream, run the tools, and feed the
 * results back as plain text. Crucially the protocol text is filtered out of
 * what the user sees — so a model that can't do native tools still searches the
 * web cleanly instead of leaking raw `web_search` + JSON into the transcript.
 */

const OPEN = "```tool_call";
const FENCE = "```";

export interface ParsedToolCall {
  name: string;
  args: Record<string, unknown>;
}

/** Build the system instructions describing the text protocol + available tools. */
export function buildToolProtocolPrompt(tools: ToolDefinition[]): string {
  const list = tools
    .map(
      (t) =>
        `- ${t.name}: ${t.description}\n  parameters (JSON Schema): ${JSON.stringify(t.parameters)}`,
    )
    .join("\n");

  return `# Tools

You can call tools to get information you don't have. To call a tool, output a fenced code block with the info string \`tool_call\` containing ONLY a JSON object, then stop and wait for the result:

\`\`\`tool_call
{"name": "web_search", "args": {"query": "your search query"}}
\`\`\`

Rules:
- Emit the block by itself with no other text on those lines. You may call one tool at a time.
- After you emit a tool_call block, STOP — do not write the result yourself or guess it. The real result will be provided to you, then you continue.
- Never fabricate tool output or URLs. Only use what the tool returns.
- When you have enough information, answer the user normally in prose (no block).

Available tools:
${list}`;
}

/**
 * Streaming filter: feed it text deltas, it returns only the text that is safe
 * to show the user (everything outside `tool_call` blocks) and collects the
 * parsed calls. Designed so a block split across many deltas is never leaked,
 * while ordinary code fences (```js, ```python, …) pass through untouched.
 */
export class ToolProtocolStream {
  private buf = "";
  private inside = false;
  readonly calls: ParsedToolCall[] = [];

  /** Feed a text delta; returns text safe to display now. */
  push(delta: string): string {
    this.buf += delta;
    return this.drain(false);
  }

  /** Signal end of stream; returns any remaining safe text. */
  flush(): string {
    return this.drain(true);
  }

  private drain(end: boolean): string {
    let out = "";
    for (;;) {
      if (!this.inside) {
        const i = this.buf.indexOf(OPEN);
        if (i === -1) {
          // No (complete) open marker. Emit everything except a trailing
          // fragment that could be the start of the marker arriving next.
          const hold = end ? 0 : trailingPrefixLen(this.buf, OPEN);
          out += this.buf.slice(0, this.buf.length - hold);
          this.buf = this.buf.slice(this.buf.length - hold);
          return out;
        }
        out += this.buf.slice(0, i);
        this.buf = this.buf.slice(i + OPEN.length);
        this.inside = true;
      } else {
        const j = this.buf.indexOf(FENCE);
        if (j === -1) {
          if (end) {
            // Unterminated block at stream end — parse what we have, drop it.
            this.tryParse(this.buf);
            this.buf = "";
            this.inside = false;
          }
          return out;
        }
        this.tryParse(this.buf.slice(0, j));
        this.buf = this.buf.slice(j + FENCE.length);
        this.inside = false;
      }
    }
  }

  private tryParse(body: string): void {
    const text = body.trim();
    if (!text) return;
    try {
      const obj = JSON.parse(text) as { name?: unknown; args?: unknown; arguments?: unknown };
      if (typeof obj.name === "string") {
        const rawArgs = obj.args ?? obj.arguments ?? {};
        this.calls.push({
          name: obj.name,
          args: (typeof rawArgs === "object" && rawArgs !== null ? rawArgs : {}) as Record<
            string,
            unknown
          >,
        });
      }
    } catch {
      // Malformed block — ignore rather than surface noise to the user.
    }
  }
}

/** Length of the longest suffix of `buf` that is a prefix of `marker`. */
function trailingPrefixLen(buf: string, marker: string): number {
  const max = Math.min(buf.length, marker.length - 1);
  for (let n = max; n > 0; n--) {
    if (buf.endsWith(marker.slice(0, n))) return n;
  }
  return 0;
}

/** Render executed tool results as plain text to feed back to a protocol model. */
export function formatToolResultsForPrompt(
  results: Array<{ name: string; content: string }>,
): string {
  const blocks = results
    .map((r) => `Result of ${r.name}:\n${r.content}`)
    .join("\n\n");
  return `${blocks}\n\nUse these tool results to answer the user. If you need another tool, emit another tool_call block; otherwise answer now in prose.`;
}
