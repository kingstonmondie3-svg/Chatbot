import { Hono } from "hono";
import { getAllProviders } from "@openchat/providers";
import { authMiddleware, type Env } from "./middleware.js";

const app = new Hono<Env>();

app.use("/*", authMiddleware);

app.get("/", async (c) => {
  const providers = getAllProviders();
  // allSettled so one unreachable/slow provider can't stall or fail the whole
  // catalog. Each provider's listModels already has its own timeout + cache.
  const settled = await Promise.allSettled(
    providers.map(async (p) => {
      const models = await p.listModels();
      return models.map((m) => ({ ...m, providerId: p.id }));
    }),
  );
  const flat = settled.flatMap((r) => (r.status === "fulfilled" ? r.value : []));
  return c.json(flat);
});

export default app;
