import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.js";
import { useThemeStore } from "./stores/theme";
import "./index.css";

// Initialize theme before React renders to prevent flash
useThemeStore.getState().initTheme();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
