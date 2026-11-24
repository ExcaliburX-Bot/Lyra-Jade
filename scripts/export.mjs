#!/usr/bin/env node
/* 把一篇文章导出成一个独立的 HTML 文件：样式、脚本、动态图都内嵌，双击就能打开，适合发给别人看
   用法：node scripts/export.mjs <slug> [输出文件]      先运行 node scripts/build.mjs
         例：node scripts/export.mjs gemini-4-neon 玲珑玉-gemini-4-neon.html */
import fs from "node:fs";
import path from "node:path";
import { DIST } from "./lib/paths.mjs";

const [slug, out = `${slug}.html`] = process.argv.slice(2);
if (!slug) { console.error("用法：node scripts/export.mjs <slug> [输出文件]"); process.exit(1); }
const page = path.join(DIST, "a", `${slug}.html`);
if (!fs.existsSync(page)) { console.error(`没有 ${path.relative(process.cwd(), page)}，先运行 node scripts/build.mjs`); process.exit(1); }

const read = f => fs.readFileSync(path.join(DIST, "assets", f), "utf8");
const safe = js => js.replace(/<\/script/gi, "<\\/script");
let html = fs.readFileSync(page, "utf8");
const swap = (from, to) => { if (!html.includes(from)) throw new Error(`页面结构变了，找不到：${from}`); html = html.replace(from, () => to); };

swap(`<link rel="stylesheet" href="../assets/site.css">`, `<style>\n${read("site.css")}\n</style>`);
swap(`<link rel="stylesheet" href="../assets/themes/coss.css">`, `<style>\n${read("themes/coss.css")}\n</style>`);
swap(`<script src="../assets/app.js"></script>`, `<script>\n${safe(read("app.js"))}\n</script>`);
swap(`<script type="module">import {initFigures} from "../assets/components.js";initFigures(document);</script>`,
     `<script type="module">\n${safe(read("glyphs.js"))}\n${safe(read("components.js").replace(/^import .*glyphs\.js";$/m, "").replace(/^export \{ glyph, GLYPHS, GLYPH_SPEC \};$/m, ""))}\ninitFigures(document);\n</script>`);
swap(`window.SITE_BASE="../"`, `window.SITE_BASE="#"`);
/* 单文件里没有网站的其他页面：站内链接改成不跳转 */
html = html.replace(/href="\.\.\/[^"]*"/g, 'href="#"');
html = html.replace("<head>", `<head>\n<!-- 玲珑玉 Lyra-Jade 单页导出：${slug}，${new Date().toISOString().slice(0, 10)} -->`);

fs.writeFileSync(out, html);
console.log(`已导出 ${out}（${Math.round(fs.statSync(out).size / 1024)} KB）`);
