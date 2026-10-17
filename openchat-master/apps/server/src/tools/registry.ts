import type { ToolDefinition } from "@openchat/shared";
import type { Tool } from "./types.js";

const tools = new Map<string, Tool>();

export function registerTool(tool: Tool): void {
  tools.set(tool.getDefinition().name, tool);
}

export function getTool(name: string): Tool | undefined {
  return tools.get(name);
}

export function getAllTools(): Tool[] {
  return Array.from(tools.values());
}

export function getToolDefinitions(): ToolDefinition[] {
  return getAllTools().map((t) => t.getDefinition());
}
