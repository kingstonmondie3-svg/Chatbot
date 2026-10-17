import { render, screen, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import App from "./App";

// Mock fetch for all tests
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  // Default: /api/auth/me returns 401 (not logged in)
  mockFetch.mockImplementation((url: string) => {
    if (url === "/api/auth/me") {
      return Promise.resolve(new Response(null, { status: 401 }));
    }
    if (url === "/api/settings") {
      return Promise.resolve(
        new Response(JSON.stringify({ theme: "system" }), { status: 200 }),
      );
    }
    return Promise.resolve(new Response(JSON.stringify({}), { status: 200 }));
  });
});

describe("App", () => {
  it("redirects to login when not authenticated", async () => {
    await act(async () => {
      render(<App />);
    });
    // LoginPage is lazy-loaded, so wait for its chunk to resolve and render.
    expect(
      await screen.findByRole("heading", { name: /log in to openchat/i }),
    ).toBeInTheDocument();
  });
});
