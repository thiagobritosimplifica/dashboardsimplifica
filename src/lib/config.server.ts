import process from "node:process";

// Server-only config. The .server.ts suffix prevents Vite from bundling
// this file into the client — values here never reach the browser.
//
// On Cloudflare Workers, env binds at REQUEST time. Module-scope reads
// (e.g. `const x = process.env.X`) resolve to undefined — always read
// process.env INSIDE a function or handler.
//
// When to use which env-access pattern:
//   - .server.ts module (this file): server-only helpers reused across
//     handlers. Wrap reads in a function so they run per-request.
//   - inline process.env inside a createServerFn handler: one-off reads
//     not reused elsewhere.
//   - import.meta.env.VITE_FOO: PUBLIC config readable from both client
//     and server (analytics IDs, public URLs). Define in .env with the
//     VITE_ prefix. Never put secrets here — they ship to the browser.

export function getServerConfig() {
  return {
    nodeEnv: process.env.NODE_ENV,
    // Add server-only values here, e.g.:
    //   databaseUrl: process.env.DATABASE_URL,
    //   stripeSecretKey: process.env.STRIPE_SECRET_KEY,
  };
}

// GoHighLevel / LeadConnector API config (same integration used in N8N).
// Override via env vars in production; the fallbacks keep dev working out of the box.
export function getGhlConfig() {
  return {
    token: process.env.GHL_API_TOKEN || "pit-09e6afd8-7e3d-4a32-afbe-055852044003",
    locationId: process.env.GHL_LOCATION_ID || "pvmcGFlxStEMBSMGNVHH",
    apiVersion: "2021-07-28",
    baseUrl: "https://services.leadconnectorhq.com",
  };
}

// Goals persistence via the Google Apps Script web app bound to the sheet.
// The dashboard READS goals from the METAS_DASH_CONFIG tab (public CSV) and
// WRITES them by POSTing to this web app (which runs as the sheet owner).
export function getMetasConfig() {
  return {
    writeUrl:
      process.env.METAS_WRITE_URL ||
      "https://script.google.com/macros/s/AKfycbxXi43DmtB0EgukrStFyFgA0OZs7Euglg9KFeKOO0WnHAY5v97r1vwvdfZkl7z_oMzN/exec",
    token: process.env.METAS_WRITE_TOKEN || "troque-por-uma-senha-sua",
  };
}
