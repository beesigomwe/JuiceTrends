import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";

const faviconHref = `${import.meta.env.BASE_URL}favicon.png`;
for (const rel of ["icon", "apple-touch-icon"] as const) {
  const el = document.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (el) el.href = faviconHref;
}

createRoot(document.getElementById("root")!).render(<App />);
