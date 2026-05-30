/** @jsxImportSource hono/jsx */
import { serializePage, type PageObject, type RootView } from "@hono/inertia";
import { renderToString } from "hono/jsx/dom/server";

export const rootView: RootView = (page: PageObject): string => {
  const serializedPage = serializePage(page);

  return `<!doctype html>${renderToString(
    <html lang="ja">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>keiba-ai-assistant</title>
        <script type="module" src="/@vite/client" />
        <script type="module" src="/src/client.tsx" />
      </head>
      <body>
        <script
          data-page="app"
          type="application/json"
          dangerouslySetInnerHTML={{ __html: serializedPage }}
        />
        <div id="app" />
      </body>
    </html>
  )}`;
};
