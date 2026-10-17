import "./env.js"; // must be first: loads .env before modules read process.env
import { Hono } from "hono";
import { serve } from "@hono/node-server";
import auth from "./auth.js";
import settings from "./settings.js";
import conversations from "./conversations.js";
import artifacts from "./artifacts.js";
import models from "./models.js";
import uploads from "./uploads.js";
import projects from "./projects.js";
import projectFiles from "./project-files.js";
import memory from "./memory.js";
import { registerAllTools } from "./tools/index.js";
import type { Env } from "./middleware.js";

await registerAllTools();

const app = new Hono<Env>();

app.get("/api/health", (c) => {
  return c.json({ ok: true });
});

app.route("/api/auth", auth);
app.route("/api/settings", settings);
app.route("/api/conversations", conversations);
app.route("/api/conversations", artifacts);
app.route("/api/models", models);
app.route("/api/uploads", uploads);
app.route("/api/projects", projects);
app.route("/api/projects", projectFiles);
app.route("/api/memory", memory);

const port = Number(process.env.PORT) || 3001;

// Don't bind a port under the test runner: index.test.ts imports this module
// only for the `app` export, and binding would crash with EADDRINUSE when a dev
// server already holds the port.
if (!process.env.VITEST) {
  serve({ fetch: app.fetch, port }, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}

export default app;
