import { build } from "esbuild";
import { cpSync, mkdirSync } from "node:fs";
mkdirSync("docs", { recursive: true });
await build({
  entryPoints: ["src/main.js"],
  bundle: true,
  format: "iife",
  target: "es2020",
  minify: true,
  outfile: "docs/app.js",
  logLevel: "info",
});
cpSync("index.html", "docs/index.html");
cpSync("ja.html", "docs/ja.html");
cpSync("en.html", "docs/en.html");
cpSync("src/style.css", "docs/style.css");
cpSync("src/ql1-logo.png", "docs/ql1-logo.png");
cpSync("src/chain42-logo.png", "docs/chain42-logo.png");
console.log("docs/ ready");
