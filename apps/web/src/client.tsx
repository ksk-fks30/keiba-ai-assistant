import "@vitejs/plugin-react/preamble";
import { createInertiaApp } from "@inertiajs/react";
import type { ComponentType } from "react";
import { createRoot } from "react-dom/client";
import "@keiba-ai-assistant/web/styles/app.css";

type PageModule = { default: ComponentType<Record<string, unknown>> };

const pages = import.meta.glob<PageModule>("./pages/**/*.tsx");

await createInertiaApp({
  resolve: async (name: string) => {
    const loadPage = pages[`./pages/${name}.tsx`];
    if (!loadPage) {
      throw new Error(`Page not found: ${name}`);
    }
    const page = await loadPage();
    return page.default;
  },
  setup: ({ el, App, props }) => {
    createRoot(el).render(<App {...props} />);
  }
});
