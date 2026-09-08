import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Configure API base URL (without /api path, as it's already in the route definitions)
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
// Remove /api suffix if present, as setBaseUrl prepends it to paths starting with /
const baseUrl = apiUrl.replace(/\/api\/?$/, "");
setBaseUrl(baseUrl);

// Safeguard against Google Translate and browser extensions crashing React with removeChild/insertBefore
if (typeof window !== "undefined") {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function <T extends Node>(child: T): T {
    if (child.parentNode !== this) {
      console.warn("Safeguard: Ignored removeChild on non-child node (browser extension / translator)", child);
      return child;
    }
    return originalRemoveChild.call(this, child) as T;
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function <T extends Node>(newNode: T, referenceNode: Node | null): T {
    if (referenceNode && referenceNode.parentNode !== this) {
      console.warn("Safeguard: Ignored insertBefore with mismatched parent (browser extension / translator)", referenceNode);
      return newNode;
    }
    return originalInsertBefore.call(this, newNode, referenceNode) as T;
  };
}

createRoot(document.getElementById("root")!).render(<App />);
