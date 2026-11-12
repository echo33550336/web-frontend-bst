/**
 * tools/serve.js —— 零依赖静态服务器，替代 `python -m http.server`
 * 用法：node tools/serve.js [端口]    默认 8000
 * 访问：http://localhost:8000/src/index.html
 *
 * 为什么不能双击打开 HTML：页面用 fetch 读取 ../data/*.json，
 * 浏览器的 file:// 协议会拦截这类请求，必须经 HTTP 访问。
 */
"use strict";

const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.resolve(__dirname, "..");
const PORT = Number(process.argv[2]) || 8000;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

const server = http.createServer((req, res) => {
  const urlPath = decodeURIComponent((req.url || "/").split("?")[0]);
  const rel = urlPath === "/" ? "/src/index.html" : urlPath;
  const filePath = path.join(ROOT, rel);

  // 防止 ../ 跳出仓库目录
  if (filePath !== ROOT && !filePath.startsWith(ROOT + path.sep)) {
    res.writeHead(403, { "content-type": "text/plain; charset=utf-8" });
    res.end("403 越界路径");
    return;
  }

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
      res.end("404 " + rel);
      return;
    }
    res.writeHead(200, {
      "content-type": MIME[path.extname(filePath).toLowerCase()] || "application/octet-stream",
      "cache-control": "no-store",
    });
    res.end(data);
  });
});

server.listen(PORT, "127.0.0.1", () => {
  console.log("静态服务器已启动：http://localhost:" + PORT + "/src/index.html");
  console.log("（Ctrl+C 停止）");
});
