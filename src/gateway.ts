import { createServer, request } from "node:http";
const buckets = new Map<string, { count: number; until: number }>();
const server = createServer(async (req, res) => {
  try {
    const ip = req.socket.remoteAddress || "local",
      now = Date.now();
    for (const [key, bucket] of buckets) if (bucket.until < now) buckets.delete(key);
    const bucket = buckets.get(ip) || { count: 0, until: now + 60000 };
    buckets.set(ip, bucket);
    bucket.count++;
    if (bucket.count > 600) {
      res.writeHead(429, { "Retry-After": "60" });
      return res.end('{"error":"Quá nhiều yêu cầu."}');
    }
    if (!req.url?.startsWith("/api/")) {
      res.writeHead(404);
      return res.end();
    }
    const chunks: Buffer[] = [];
    let size = 0;
    for await (const chunk of req) {
      size += chunk.length;
      if (size > 32768) {
        res.writeHead(413);
        return res.end('{"error":"Nội dung quá lớn."}');
      }
      chunks.push(chunk);
    }
    if (res.destroyed) return;
    const headers = { ...req.headers };
    delete headers["x-forwarded-for"];
    delete headers["x-forwarded-host"];
    delete headers["x-forwarded-proto"];
    const proxy = request({ hostname: "127.0.0.1", port: 5191, path: req.url, method: req.method, headers, timeout: 60000 }, (upstream) => {
      if (res.destroyed) {
        upstream.destroy();
        return;
      }
      res.writeHead(upstream.statusCode || 502, { ...upstream.headers, "X-DXOS-Gateway": "development", "X-Content-Type-Options": "nosniff" });
      upstream.on("error", () => res.destroy());
      upstream.pipe(res);
    });
    res.once("close", () => {
      if (!res.writableEnded) proxy.destroy();
    });
    proxy.on("timeout", () => proxy.destroy());
    proxy.on("error", () => {
      if (res.destroyed) return;
      if (!res.headersSent) res.writeHead(502, { "Content-Type": "application/json" });
      res.end('{"error":"Lõi số chưa sẵn sàng."}');
    });
    proxy.end(Buffer.concat(chunks));
  } catch {
    if (!res.destroyed) {
      if (!res.headersSent) res.writeHead(400, { "Content-Type": "application/json" });
      res.end('{"error":"Yêu cầu bị gián đoạn."}');
    }
  }
});
server.listen(5193, "127.0.0.1", () => console.log("Development API gateway: http://127.0.0.1:5193"));
process.on("SIGTERM", () => server.close());
