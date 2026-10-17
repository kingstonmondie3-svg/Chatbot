import { describe, it, expect } from "vitest";
import app from "./index.js";

describe("Server", () => {
  it("GET /api/health returns { ok: true }", async () => {
    const res = await app.request("/api/health");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
