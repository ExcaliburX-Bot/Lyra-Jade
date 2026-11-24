import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { topicsOf, topicList } from "../scripts/lib/topics.mjs";

test("专题：按发布方和标题归类，不看正文；可以手动覆盖", () => {
  assert.deepEqual(topicsOf({ publisher: "Anthropic", title: "Claude Ship 上线" }), ["claude"]);
  assert.deepEqual(topicsOf({ publisher: "OpenAI", title: "OpenAI 与思科开源 Shirudo" }), ["openai"]);
  assert.deepEqual(topicsOf({ publisher: "Google DeepMind", title: "Genie 4" }), ["gemini"]);
  assert.deepEqual(topicsOf({ publisher: "xAI", title: "Grok 5 发布" }), ["grok"]);
  assert.deepEqual(topicsOf({ publisher: "Vercel", title: "Board", summary: "比 Claude 和 GPT-6 更快" }), []);
  assert.deepEqual(topicsOf({ publisher: "Microsoft AI", title: "微软发布", topics: ["openai", "microsoft", "nope"] }), ["openai", "microsoft"]);
});

test("专题列表：Claude、OpenAI、Gemini、Grok 固定在前（没文章也显示），其余按篇数", () => {
  const as = [{ publisher: "NVIDIA", title: "RTX" }, { publisher: "Microsoft", title: "a" }, { publisher: "Microsoft", title: "b" }, { publisher: "OpenAI", title: "c" }];
  assert.deepEqual(topicList(as).map(t => `${t.k}:${t.n}`), ["claude:0", "openai:1", "gemini:0", "grok:0", "microsoft:2", "nvidia:1"]);
  assert.equal(topicList(as, "en").find(t => t.k === "microsoft").name, "Microsoft");
});

test("构建：生成专题页，文章页带专题标签，API 带 topics", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lj-tp-"));
  const content = path.join(tmp, "articles"), dist = path.join(tmp, "dist");
  fs.mkdirSync(content);
  const a = JSON.parse(fs.readFileSync("test/fixtures/llm-article.json", "utf8"));
  fs.writeFileSync(path.join(content, "x.json"), JSON.stringify({ ...a, slug: "x", status: "published", publisher: "Anthropic", title: "Claude 新功能：测试" }));
  execFileSync("node", ["scripts/build.mjs"], { env: { ...process.env, WG_CONTENT: content, WG_CONTENT_EN: path.join(tmp, "none"), WG_DIST: dist, WG_SITE_URL: "https://lyra.example" }, stdio: "pipe" });
  for (const k of ["claude", "openai", "gemini", "grok"]) { assert.ok(fs.existsSync(path.join(dist, `t/${k}.html`)), k); assert.ok(fs.existsSync(path.join(dist, `en/t/${k}.html`)), k); }
  assert.match(fs.readFileSync(path.join(dist, "t/claude.html"), "utf8"), /"topic":"claude"/);
  assert.match(fs.readFileSync(path.join(dist, "a/x.html"), "utf8"), /href="\.\.\/t\/claude\.html">Claude</);
  const api = JSON.parse(fs.readFileSync(path.join(dist, "api/v1/articles.json"), "utf8"));
  assert.deepEqual(api.articles[0].topics, ["claude"]);
  assert.equal(JSON.parse(fs.readFileSync(path.join(dist, "api/v1/articles/x.json"), "utf8")).article._topics, undefined);
  assert.match(fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8"), /\/t\/grok\.html/);
  fs.rmSync(tmp, { recursive: true, force: true });
});
