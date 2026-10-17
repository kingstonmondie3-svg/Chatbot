export interface SSEEvent {
  event: string;
  data: string;
}

export async function* parseSSEStream(
  reader: ReadableStreamDefaultReader<Uint8Array>,
): AsyncGenerator<SSEEvent> {
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    // Split on double newline (SSE event boundary)
    const blocks = buffer.split("\n\n");
    // Keep the last incomplete block in the buffer
    buffer = blocks.pop() ?? "";

    for (const block of blocks) {
      if (!block.trim()) continue;

      let event = "message";
      let data = "";

      for (const line of block.split("\n")) {
        if (line.startsWith("event: ")) {
          event = line.slice(7);
        } else if (line.startsWith("data: ")) {
          data = line.slice(6);
        }
      }

      if (data) {
        yield { event, data };
      }
    }
  }

  // Process any remaining buffer
  if (buffer.trim()) {
    let event = "message";
    let data = "";
    for (const line of buffer.split("\n")) {
      if (line.startsWith("event: ")) {
        event = line.slice(7);
      } else if (line.startsWith("data: ")) {
        data = line.slice(6);
      }
    }
    if (data) {
      yield { event, data };
    }
  }
}
