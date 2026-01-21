import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Disable console.log globally for performance
// Set window.ENABLE_LOGGING = true in browser console to re-enable
if (!import.meta.env.DEV || !(window as any).ENABLE_LOGGING) {
  const noop = () => {};
  console.log = noop;
}

createRoot(document.getElementById("root")!).render(<App />);
