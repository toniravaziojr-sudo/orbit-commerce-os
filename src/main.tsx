import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initReactInstanceGuard } from "@/lib/reactInstanceGuard";

// Initialize React Instance Guard BEFORE rendering anything
// This detects multiple React instances that cause #300 errors
const guardStatus = initReactInstanceGuard();
if (!guardStatus.ok) {
  console.error('[main.tsx] React Instance Guard detected issues:', guardStatus);
}

createRoot(document.getElementById("root")!).render(<App />);
