import { describe, it, expect, vi, beforeEach } from "vitest";
import { useAuthStore } from "./auth";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  // Reset store to initial state
  useAuthStore.setState({ user: null, isLoading: true, error: null });
});

describe("auth store", () => {
  describe("fetchUser", () => {
    it("sets user on 200 response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ user: { id: "1", email: "test@example.com" } }),
          { status: 200 },
        ),
      );
      await useAuthStore.getState().fetchUser();
      const state = useAuthStore.getState();
      expect(state.user).toEqual({ id: "1", email: "test@example.com" });
      expect(state.isLoading).toBe(false);
    });

    it("sets user to null on 401", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 401 }));
      await useAuthStore.getState().fetchUser();
      const state = useAuthStore.getState();
      expect(state.user).toBeNull();
      expect(state.isLoading).toBe(false);
    });
  });

  describe("login", () => {
    it("sets user on success", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ user: { id: "1", email: "test@example.com" } }),
          { status: 200 },
        ),
      );
      await useAuthStore.getState().login("test@example.com", "password");
      expect(useAuthStore.getState().user).toEqual({
        id: "1",
        email: "test@example.com",
      });
      expect(useAuthStore.getState().error).toBeNull();
    });

    it("sets error on failure", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ error: "Invalid email or password" }),
          { status: 401 },
        ),
      );
      await useAuthStore.getState().login("test@example.com", "wrong");
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().error).toBe("Invalid email or password");
    });
  });

  describe("signup", () => {
    it("sets user on success", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(
          JSON.stringify({ user: { id: "1", email: "new@example.com" } }),
          { status: 201 },
        ),
      );
      await useAuthStore.getState().signup("new@example.com", "password123");
      expect(useAuthStore.getState().user).toEqual({
        id: "1",
        email: "new@example.com",
      });
    });
  });

  describe("logout", () => {
    it("clears user", async () => {
      useAuthStore.setState({ user: { id: "1", email: "test@example.com" } });
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ ok: true }), { status: 200 }),
      );
      await useAuthStore.getState().logout();
      expect(useAuthStore.getState().user).toBeNull();
    });
  });
});
