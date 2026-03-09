import posthog from "posthog-js";
import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

const phKey = import.meta.env.VITE_POSTHOG_KEY;
if (phKey) {
  posthog.init(phKey, {
    api_host: "https://us.i.posthog.com",
    person_profiles: "identified_only",
  });
}

createRoot(document.getElementById("root")!).render(<App />);
