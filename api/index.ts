import type { IncomingMessage, ServerResponse } from "http";

export default function handler(req: IncomingMessage & { body?: any }, res: ServerResponse) {
  res.setHeader("Content-Type", "application/json");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 200;
    res.end();
    return;
  }

  res.statusCode = 200;
  res.end(JSON.stringify({ ok: true, method: req.method, url: req.url }));
}
