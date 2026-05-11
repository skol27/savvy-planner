import { createReadStream, existsSync } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer } from "node:http";
import { extname, join, normalize } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import worker from "../dist/server/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const clientDir = join(root, "dist/client");
const port = Number(process.env.PORT || 4300);
const host = process.env.HOST || "127.0.0.1";

const mime = {
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
};

function assetPath(pathname) {
  const decoded = decodeURIComponent(pathname);
  const safePath = normalize(decoded).replace(/^(\.\.[/\\])+/, "");
  return join(clientDir, safePath);
}

async function serveAsset(req, res) {
  const file = assetPath(new URL(req.url, `http://${req.headers.host}`).pathname);
  if (!file.startsWith(clientDir) || !existsSync(file) || !(await stat(file)).isFile()) {
    res.writeHead(404);
    res.end("Not found");
    return;
  }
  res.writeHead(200, { "content-type": mime[extname(file)] || "application/octet-stream" });
  createReadStream(file).pipe(res);
}

async function serveWorker(req, res) {
  const url = `http://${req.headers.host}${req.url}`;
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : req;
  const request = new Request(url, {
    method: req.method,
    headers: req.headers,
    body,
    duplex: body ? "half" : undefined,
  });
  const response = await worker.fetch(request, {}, {});
  res.writeHead(response.status, Object.fromEntries(response.headers.entries()));
  if (response.body) {
    Readable.fromWeb(response.body).pipe(res);
  } else {
    res.end();
  }
}

createServer(async (req, res) => {
  try {
    const { pathname } = new URL(req.url, `http://${req.headers.host}`);
    if (pathname.startsWith("/assets/") || pathname === "/.assetsignore") {
      await serveAsset(req, res);
    } else {
      await serveWorker(req, res);
    }
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    res.end("Internal server error");
  }
}).listen(port, host, () => {
  console.log(`Savvy Planner running at http://${host}:${port}/`);
});
