export interface ExportMessage {
  role: string;
  content: string;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function formatConversationMarkdown(
  title: string | null,
  messages: ExportMessage[],
): string {
  const header = `# ${title || "Conversation"}`;

  const sections: string[] = [];

  for (const msg of messages) {
    if (msg.role === "system" || msg.role === "tool") continue;
    if (!msg.content) continue;

    sections.push(`## ${capitalize(msg.role)}\n\n${msg.content}`);
  }

  if (sections.length === 0) return header + "\n";

  return header + "\n\n---\n\n" + sections.join("\n\n---\n\n") + "\n";
}
