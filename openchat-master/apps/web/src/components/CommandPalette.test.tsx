import { render, screen, fireEvent, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { CommandPalette } from "./CommandPalette";
import { useUIStore } from "../stores/ui";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => {
  mockFetch.mockReset();
  // /api/conversations returns a bare array of conversations.
  mockFetch.mockImplementation(() =>
    Promise.resolve(new Response(JSON.stringify([]), { status: 200 })),
  );
  useUIStore.setState({ commandPaletteOpen: false, sidebarOpen: false });
});

function renderPalette() {
  return render(
    <MemoryRouter>
      <CommandPalette />
    </MemoryRouter>,
  );
}

describe("CommandPalette", () => {
  it("is hidden until opened", () => {
    renderPalette();
    expect(screen.queryByPlaceholderText(/search conversations/i)).toBeNull();
  });

  it("opens on Cmd/Ctrl+K and filters commands by query", async () => {
    renderPalette();

    await act(async () => {
      fireEvent.keyDown(window, { key: "k", metaKey: true });
    });

    const input = await screen.findByPlaceholderText(/search conversations/i);
    expect(input).toBeInTheDocument();
    // Static command is present.
    expect(screen.getByText("Go to Settings")).toBeInTheDocument();

    await act(async () => {
      fireEvent.change(input, { target: { value: "memory" } });
    });

    expect(screen.getByText("Go to Memory")).toBeInTheDocument();
    expect(screen.queryByText("Go to Settings")).toBeNull();
  });

  it("closes on Escape", async () => {
    renderPalette();
    await act(async () => {
      fireEvent.keyDown(window, { key: "k", ctrlKey: true });
    });
    const input = await screen.findByPlaceholderText(/search conversations/i);
    await act(async () => {
      fireEvent.keyDown(input, { key: "Escape" });
    });
    expect(screen.queryByPlaceholderText(/search conversations/i)).toBeNull();
  });
});
