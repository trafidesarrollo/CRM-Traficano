import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

// Unregister any stale service workers in development to avoid blank screens
if (import.meta.env.DEV && "serviceWorker" in navigator) {
  navigator.serviceWorker.getRegistrations().then((regs) => {
    for (const reg of regs) reg.unregister();
  });
}

const rootEl = document.getElementById("root");
if (rootEl) {
  createRoot(rootEl).render(<App />);
}
