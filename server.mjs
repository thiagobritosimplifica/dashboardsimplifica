// Production server for TanStack Start (Node).
// The build produces dist/server/server.js exporting a fetch handler,
// and static client assets in dist/client. This serves both.
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import handler from "./dist/server/server.js";

const app = new Hono();

// Serve built client assets (JS/CSS/images) from dist/client.
app.use("/*", serveStatic({ root: "./dist/client" }));

// Everything else goes to the TanStack Start SSR handler.
app.all("/*", (c) => handler.fetch(c.req.raw));

const port = Number(process.env.PORT) || 3000;
serve({ fetch: app.fetch, port, hostname: "0.0.0.0" }, (info) => {
  console.log(`Server running on http://0.0.0.0:${info.port}`);
});
