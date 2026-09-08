import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setBaseUrl } from "@workspace/api-client-react";

// Configure API base URL (without /api path, as it's already in the route definitions)
const apiUrl = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
// Remove /api suffix if present, as setBaseUrl prepends it to paths starting with /
const baseUrl = apiUrl.replace(/\/api\/?$/, "");
setBaseUrl(baseUrl);

createRoot(document.getElementById("root")!).render(<App />);
