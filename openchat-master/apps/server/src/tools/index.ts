export type { Tool, ToolExecutionContext } from "./types.js";
export {
  registerTool,
  getTool,
  getAllTools,
  getToolDefinitions,
} from "./registry.js";

import { WebSearchTool } from "./web-search.js";
import { CodeExecutionTool, isCodeExecutionAvailable } from "./code-execution.js";
import { SearchConversationsTool } from "./search-conversations.js";
import { registerTool } from "./registry.js";

export async function registerAllTools(): Promise<void> {
  registerTool(new WebSearchTool());
  // Only offer run_code if it can actually run (config on + dockerode present),
  // so the model doesn't repeatedly call a tool that always errors and clutter
  // the transcript with failed "Executed code" rows.
  if (await isCodeExecutionAvailable()) {
    registerTool(new CodeExecutionTool());
  }
  registerTool(new SearchConversationsTool());
}
