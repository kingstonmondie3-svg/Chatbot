import type { ToolDefinition } from "@openchat/shared";
import type { Tool, ToolExecutionContext } from "./types.js";

const CODE_EXECUTION_ENABLED = process.env.CODE_EXECUTION_ENABLED !== "false";

/**
 * Whether the run_code tool can actually execute: enabled by config and the
 * optional `dockerode` dependency is installed. Used to decide whether to offer
 * the tool to the model at all — offering a tool that always errors just makes
 * the model retry and clutters the transcript with failed "Executed code" rows.
 */
export async function isCodeExecutionAvailable(): Promise<boolean> {
  if (!CODE_EXECUTION_ENABLED) return false;
  const dockerodeModule = "dockerode";
  try {
    await import(dockerodeModule);
    return true;
  } catch {
    return false;
  }
}

export class CodeExecutionTool implements Tool {
  getDefinition(): ToolDefinition {
    return {
      name: "run_code",
      description:
        "Execute code in a sandboxed environment. Supports Python and JavaScript. No network access, no host filesystem access. Use for data analysis, calculations, and file generation.",
      parameters: {
        type: "object",
        properties: {
          language: {
            type: "string",
            enum: ["python", "javascript"],
            description: "Programming language",
          },
          code: {
            type: "string",
            description: "The code to execute",
          },
        },
        required: ["language", "code"],
      },
    };
  }

  async execute(
    args: Record<string, unknown>,
    _context: ToolExecutionContext,
  ): Promise<string> {
    if (!CODE_EXECUTION_ENABLED) {
      return JSON.stringify({
        error: "Code execution is not enabled on this server",
      });
    }

    const language = args.language;
    const code = args.code;

    if (!language || typeof language !== "string") {
      return JSON.stringify({ error: "Missing or invalid language parameter" });
    }
    if (!code || typeof code !== "string") {
      return JSON.stringify({ error: "Missing or invalid code parameter" });
    }

    try {
      return await executeInSandbox(language, code);
    } catch (err) {
      return JSON.stringify({ error: String(err) });
    }
  }
}

const MEMORY_LIMIT = 512 * 1024 * 1024; // 512MB
const CPU_LIMIT = 1_000_000_000; // 1 CPU (nanoseconds)
const WALL_CLOCK_TIMEOUT_MS = 30_000; // 30 seconds
const MAX_OUTPUT_BYTES = 100_000; // 100KB
const SANDBOX_IMAGE = process.env.SANDBOX_IMAGE ?? "openchat-sandbox:latest";
const DOCKER_SOCKET = process.env.DOCKER_SOCKET ?? "/var/run/docker.sock";

async function executeInSandbox(
  language: string,
  code: string,
): Promise<string> {
  // Dynamic import to avoid hard dependency on dockerode when code execution is disabled
  const dockerodeModule = "dockerode";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Docker: any;
  try {
    const mod = await import(dockerodeModule);
    Docker = mod.default;
  } catch {
    return JSON.stringify({
      error: "Code execution requires dockerode. Install it with: pnpm add dockerode",
    });
  }
  const docker = new Docker({ socketPath: DOCKER_SOCKET });

  const command =
    language === "python"
      ? ["python3", "-c", code]
      : ["node", "-e", code];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let container: any;
  try {
    container = await docker.createContainer({
      Image: SANDBOX_IMAGE,
      Cmd: command,
      HostConfig: {
        NetworkMode: "none",
        Memory: MEMORY_LIMIT,
        CpuQuota: CPU_LIMIT,
        ReadonlyRootfs: true,
        Tmpfs: { "/tmp": "size=50m" },
        CapDrop: ["ALL"],
        SecurityOpt: ["no-new-privileges"],
      },
      StopTimeout: 5,
      Env: ["HOME=/tmp"],
    });

    await container.start();

    const result = await Promise.race([
      container.wait(),
      new Promise<{ StatusCode: number }>((_, reject) =>
        setTimeout(
          () => reject(new Error("Timeout")),
          WALL_CLOCK_TIMEOUT_MS,
        ),
      ),
    ]);

    const logs = await container.logs({
      stdout: true,
      stderr: true,
      tail: 1000,
    });
    const output = logs.toString("utf-8").slice(0, MAX_OUTPUT_BYTES);
    const exitCode = (result as { StatusCode: number }).StatusCode;

    return JSON.stringify({ stdout: output, exitCode, timedOut: false });
  } catch (err) {
    if (err instanceof Error && err.message === "Timeout") {
      return JSON.stringify({
        stdout: "",
        exitCode: -1,
        timedOut: true,
        error: "Execution timed out (30s limit)",
      });
    }
    return JSON.stringify({ stdout: "", exitCode: -1, error: String(err) });
  } finally {
    if (container) {
      try {
        await container.kill();
      } catch {
        /* already stopped */
      }
      try {
        await container.remove();
      } catch {
        /* already removed */
      }
    }
  }
}
