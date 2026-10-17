/**
 * Some models (notably DeepSeek V4) sometimes emit tool calls as their own
 * special-token markup inside the *content* stream instead of via the standard
 * OpenAI `tool_calls` field, e.g.:
 *
 *   <｜｜DSML｜｜tool_calls><｜｜DSML｜｜invoke name="web_search">
 *     <｜｜DSML｜｜parameter name="query" string="true">latest news</｜｜DSML｜｜parameter>
 *   </｜｜DSML｜｜invoke></｜｜DSML｜｜tool_calls>
 *
 * Left alone this raw markup leaks into the chat transcript. This module detects
 * that markup in the streamed text, suppresses it from what the user sees, and
 * parses it into real tool calls. Detection keys on DeepSeek's fullwidth-pipe
 * special token (U+FF5C) / the `DSML` tag, which never occur in normal prose, so
 * ordinary text and code fences pass through untouched.
 */

const FULLWIDTH_PIPE = "｜"; // ｜ — DeepSeek special-token delimiter

export interface ParsedToolCall {
  name: string;
  args: Record<string, unknown>;
}

// An opening tag that starts a leaked tool-call block. Keyed tightly so it can't
// fire on ordinary prose that merely contains a fullwidth pipe or angle bracket:
//   - a `DSML` tag (DeepSeek's markup), or
//   - an `invoke name=…` tag, or
//   - a fullwidth-pipe special token that references a tool call
//     (e.g. `<｜tool▁calls▁begin｜>`).
// Even so, the filter is fail-safe: text is only suppressed if a tool call is
// actually parsed out of the captured block (see flush()).
const OPENING_RE = new RegExp(
  `<[^>]*DSML[^>]*>|<[^>]*invoke\\s+name=[^>]*>|<[^>]*${FULLWIDTH_PIPE}[^>]*tool[^>]*>`,
  "i",
);

function coerce(value: string): unknown {
  const trimmed = value.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (typeof parsed === "number" || typeof parsed === "boolean" || typeof parsed === "object") {
      return parsed;
    }
  } catch {
    /* not JSON — keep as string */
  }
  return trimmed;
}

/** Parse `invoke name=…` / `parameter name=…` markup out of a captured block. */
export function parseLeakedToolCalls(block: string): ParsedToolCall[] {
  const calls: ParsedToolCall[] = [];

  const readParams = (scope: string): Record<string, unknown> => {
    const args: Record<string, unknown> = {};
    const paramRe = /parameter\s+name="([^"]+)"[^>]*>([\s\S]*?)<\/[^>]*parameter>/gi;
    let p: RegExpExecArray | null;
    while ((p = paramRe.exec(scope)) !== null) {
      args[p[1]] = coerce(p[2]);
    }
    return args;
  };

  const invokeRe = /invoke\s+name="([^"]+)"([\s\S]*?)<\/[^>]*invoke>/gi;
  let m: RegExpExecArray | null;
  while ((m = invokeRe.exec(block)) !== null) {
    calls.push({ name: m[1], args: readParams(m[2]) });
  }

  // Fallback: an invoke whose closing tag never arrived (truncated stream).
  if (calls.length === 0) {
    const nameMatch = block.match(/invoke\s+name="([^"]+)"/i);
    if (nameMatch) calls.push({ name: nameMatch[1], args: readParams(block) });
  }

  return calls;
}

/**
 * Streaming filter: feed text deltas, get back only the text safe to display.
 * Once a leaked tool-call block opens, the rest of the turn's text is buffered
 * (models emit the block and stop) and parsed at flush.
 */
export class LeakedToolCallStream {
  private buf = "";
  private block = "";
  private triggered = false;
  readonly calls: ParsedToolCall[] = [];

  push(delta: string): string {
    if (this.triggered) {
      this.block += delta;
      return "";
    }
    this.buf += delta;

    const match = OPENING_RE.exec(this.buf);
    if (match) {
      const safe = this.buf.slice(0, match.index);
      this.block = this.buf.slice(match.index);
      this.buf = "";
      this.triggered = true;
      return safe;
    }

    // No opening yet — emit everything except a trailing fragment that could be
    // the start of an opening token (so a marker split across deltas can't leak).
    const hold = this.heldTailLength();
    const safe = this.buf.slice(0, this.buf.length - hold);
    this.buf = this.buf.slice(this.buf.length - hold);
    return safe;
  }

  flush(): string {
    if (this.triggered) {
      const parsed = parseLeakedToolCalls(this.block);
      if (parsed.length === 0) {
        // False positive: the opening marker matched but the block held no
        // parseable tool call. Emit the captured text rather than swallowing it
        // — otherwise a stray "<…｜…tool…>" in normal output would silently eat
        // the rest of the model's answer, surfacing as an empty response.
        const rest = this.block;
        this.block = "";
        this.triggered = false;
        return rest;
      }
      this.calls.push(...parsed);
      this.block = "";
      return "";
    }
    const rest = this.buf;
    this.buf = "";
    return rest;
  }

  /** Hold back a trailing unclosed `<…` only if it looks like a marker prefix. */
  private heldTailLength(): number {
    const lastLt = this.buf.lastIndexOf("<");
    if (lastLt === -1) return 0;
    if (this.buf.indexOf(">", lastLt) !== -1) return 0; // tag already closed
    const tail = this.buf.slice(lastLt);
    const looksLikeMarker =
      tail === "<" ||
      tail === "</" ||
      tail.includes(FULLWIDTH_PIPE) ||
      /DSML/i.test(tail);
    return looksLikeMarker ? tail.length : 0;
  }
}
