import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const directory = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(directory, "../..");
const webRoot = path.join(projectRoot, "web");
const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8"
};

const server = createServer(async (request, response) => {
  const url = new URL(request.url, "http://127.0.0.1:4173");
  let file;
  if (url.pathname === "/") {
    file = path.join(directory, "demo.html");
  } else if (url.pathname === "/access-needs") {
    file = path.join(directory, "access-needs.html");
  } else if (url.pathname.startsWith("/web/")) {
    const relative = decodeURIComponent(url.pathname.slice("/web/".length));
    file = path.resolve(webRoot, relative);
    if (!file.startsWith(`${webRoot}${path.sep}`)) {
      response.writeHead(403).end();
      return;
    }
  } else {
    response.writeHead(404).end();
    return;
  }

  try {
    const content = await readFile(file);
    response.writeHead(200, {
      "content-type": mimeTypes[path.extname(file)] || "application/octet-stream",
      "cache-control": "no-store"
    });
    response.end(content);
  } catch (error) {
    console.error(`Unable to serve ${file}.`, error);
    response.writeHead(404).end();
  }
});

server.listen(4173, "0.0.0.0", () => {
  console.log("Accessibility demo available at http://127.0.0.1:4173");
});
