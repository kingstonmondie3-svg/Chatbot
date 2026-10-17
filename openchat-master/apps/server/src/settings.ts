import { Hono } from "hono";
import { eq } from "drizzle-orm";
import { settingsUpdateSchema } from "@openchat/shared";
import { db } from "./db.js";
import { userSettings } from "../../../drizzle/schema.js";
import { authMiddleware, type Env } from "./middleware.js";

const settings = new Hono<Env>();

settings.use("/*", authMiddleware);

settings.get("/", async (c) => {
  const user = c.get("user");

  const [row] = await db
    .select()
    .from(userSettings)
    .where(eq(userSettings.userId, user.id))
    .limit(1);

  if (!row) {
    return c.json({ error: "Settings not found" }, 404);
  }

  return c.json({
    theme: row.theme,
    customInstructions: row.customInstructions,
    defaultModel: row.defaultModel,
    memoryEnabled: row.memoryEnabled,
    responseStyle: row.responseStyle,
  });
});

settings.patch("/", async (c) => {
  const user = c.get("user");
  const body = await c.req.json();
  const parsed = settingsUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json(
      { error: "Validation failed", fields: parsed.error.flatten().fieldErrors },
      400,
    );
  }

  const updates = parsed.data;
  if (Object.keys(updates).length === 0) {
    const [row] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, user.id))
      .limit(1);
    return c.json(row);
  }

  const [updated] = await db
    .update(userSettings)
    .set(updates)
    .where(eq(userSettings.userId, user.id))
    .returning();

  return c.json({
    theme: updated.theme,
    customInstructions: updated.customInstructions,
    defaultModel: updated.defaultModel,
    memoryEnabled: updated.memoryEnabled,
    responseStyle: updated.responseStyle,
  });
});

export default settings;
