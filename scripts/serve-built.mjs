import { createReadStream, existsSync } from "node:fs";
import { mkdir, rename, stat, writeFile } from "node:fs/promises";
import { createServer } from "node:http";
import { dirname, extname, join, normalize } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import worker from "../dist/server/index.js";

const root = fileURLToPath(new URL("../", import.meta.url));
const clientDir = join(root, "dist/client");
const stateFile = process.env.SAVVY_PLANNER_STATE_FILE || join(root, "data/finance-state.json");
const backupDir = process.env.SAVVY_PLANNER_BACKUP_DIR || join(dirname(stateFile), "backups");
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

async function readRequestBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}

function writeJson(res, status, value) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(value));
}

function isBackup(value) {
  return (
    value &&
    typeof value === "object" &&
    value.app === "savvy-planner" &&
    value.schemaVersion === 1 &&
    typeof value.exportedAt === "string" &&
    value.state &&
    typeof value.state === "object"
  );
}

function backupFileName(backup) {
  const stamp = String(backup.exportedAt || new Date().toISOString()).replace(/[:.]/g, "-");
  const reason =
    typeof backup.reason === "string"
      ? `-${backup.reason
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")}`
      : "";
  return `savvy-planner-backup-${stamp}${reason}.json`;
}

async function serveStateApi(req, res) {
  if (req.method === "GET") {
    if (!existsSync(stateFile)) {
      res.writeHead(204);
      res.end();
      return;
    }
    res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
    createReadStream(stateFile).pipe(res);
    return;
  }

  if (req.method === "PUT") {
    const body = await readRequestBody(req);
    let parsed;
    try {
      parsed = JSON.parse(body);
    } catch {
      writeJson(res, 400, { error: "Invalid JSON." });
      return;
    }

    if (!isBackup(parsed)) {
      writeJson(res, 400, { error: "Invalid Savvy Planner backup." });
      return;
    }

    await mkdir(dirname(stateFile), { recursive: true });
    const tmpFile = `${stateFile}.tmp`;
    await writeFile(tmpFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    await rename(tmpFile, stateFile);
    writeJson(res, 200, { ok: true });
    return;
  }

  res.writeHead(405, { allow: "GET, PUT" });
  res.end("Method not allowed");
}

async function serveBackupApi(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405, { allow: "POST" });
    res.end("Method not allowed");
    return;
  }

  const body = await readRequestBody(req);
  let parsed;
  try {
    parsed = JSON.parse(body);
  } catch {
    writeJson(res, 400, { error: "Invalid JSON." });
    return;
  }

  if (!isBackup(parsed)) {
    writeJson(res, 400, { error: "Invalid Savvy Planner backup." });
    return;
  }

  await mkdir(backupDir, { recursive: true });
  const file = join(backupDir, backupFileName(parsed));
  const tmpFile = `${file}.tmp`;
  await writeFile(tmpFile, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
  await rename(tmpFile, file);
  writeJson(res, 200, { ok: true, file });
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
    if (pathname === "/api/state") {
      await serveStateApi(req, res);
    } else if (pathname === "/api/backups") {
      await serveBackupApi(req, res);
    } else if (pathname.startsWith("/assets/") || pathname === "/.assetsignore") {
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
