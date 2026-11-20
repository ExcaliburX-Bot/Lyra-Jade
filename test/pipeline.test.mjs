/* 运行：node --test test/  （不联网、不调用模型） */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseFeed, parseLinks } from "../scripts/lib/feed.mjs";
import { normalizeUrl, similarity } from "../scripts/lib/text.mjs";
import { toCandidates } from "../scripts/lib/score.mjs";
import { validateArticle } from "../scripts/lib/validate.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FX = path.join(ROOT, "test/fixtures");
const read = f => fs.readFileSync(path.join(FX, f), "utf8");

test("RSS：CDATA、实体、跟踪参数", () => {
  const items = parseFeed(read("feeds/example-official.xml"));
  assert.equal(items.length, 3);
  assert.equal(items[0].title, "Introducing Orbit-7: a 34B open model for coding agents");
  assert.match(items[0].summary, /open-weight model built for coding agents & tool use/);
  assert.equal(items[0].published, "2026-11-18T16:00:00.000Z");
  assert.equal(normalizeUrl(items[0].url), "https://example.com/blog/orbit-7");
});

test("Atom：取 alternate 链接", () => {
  const [e] = parseFeed(read("feeds/example-atom.xml"));
  assert.equal(e.url, "https://example.org/papers/small-reasoner");
  assert.equal(e.published, "2026-11-17T09:00:00.000Z");
});

test("无 RSS 网页：按规则提取链接并去重", () => {
  const links = parseLinks(read("feeds/example-page.html"), { baseUrl: "https://example.com/news", pattern: "^/news/[a-z0-9-]+$" });
  assert.deepEqual(links.map(l => l.url), ["https://example.com/news/orbit-7-safety-card", "https://example.com/news/partnership-with-example-cloud"]);
});

test("同一事件的官方博客和媒体报道合并，招聘帖降权", () => {
  assert.ok(similarity("Introducing Orbit-7: a 34B open model for coding agents", "Example Labs introduces Orbit-7, a 34B open model for coding agents") > 0.55);
  const mk = (title, tier, source, published) => ({ key: normalizeUrl("https://x/" + title), title, url: "https://x/" + encodeURIComponent(title), tier, source, publisher: source, weight: 1, published, fetched_at: published });
  const c = toCandidates([
    mk("Introducing Orbit-7: a 34B open model for coding agents", "official", "lab", "2026-11-18T16:00:00Z"),
    mk("Example Labs introduces Orbit-7, a 34B open model for coding agents", "media", "news", "2026-11-18T18:30:00Z"),
    mk("Example Labs is hiring research engineers", "official", "lab", "2026-11-17T10:00:00Z")
  ], Date.parse("2026-11-18T20:00:00Z"));
  assert.equal(c.length, 2);
  assert.equal(c[0].tier, "official");
  assert.equal(c[0].related.length, 1);
  assert.match(c[1].title, /hiring/);
});

test("校验：找不到出处的数字会被拦下", () => {
  const a = JSON.parse(read("llm-article.json"));
  Object.assign(a, { date: "2026-11-18", sources: { ...a.sources, main: { url: "u" } } });
  const text = read("pages/source.html");
  const r = validateArticle(a, { sourceTexts: { [a.claims[0].source_url]: text } });
  assert.equal(r.errors.length, 1);
  assert.match(r.errors[0], /120ms/);
});

test("端到端：抓取 → 候选 → 写稿（模拟）→ 校验 → 构建", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wg-"));
  const env = { ...process.env, WG_DATA: path.join(tmp, "data"), WG_CONTENT: path.join(tmp, "content"), WG_DIST: path.join(tmp, "dist"), WG_SOURCES: path.join(FX, "sources.test.json") };
  const run = (...a) => execFileSync(process.execPath, a, { cwd: ROOT, env, encoding: "utf8" });

  const out = run("scripts/fetch.mjs", "--fixtures");
  assert.match(out, /没有样例的源（测试）：没有样例，跳过/);
  const cands = JSON.parse(fs.readFileSync(path.join(tmp, "data/candidates.json"), "utf8"));
  assert.match(cands[0].title, /Orbit-7/);
  assert.equal(cands[0].related.length, 1, "媒体报道应并入同一事件");

  run("scripts/draft.mjs", "--top", "1", "--mock", "--min-score", "0");
  const made = JSON.parse(fs.readFileSync(path.join(tmp, "data/new-drafts.json"), "utf8"));
  assert.equal(made.length, 1);
  assert.equal(made[0].errors, 1, "虚构的 120ms 应被标红");
  const article = path.join(tmp, "content", "orbit-7-open-coding-model.json");
  assert.ok(fs.existsSync(article));

  const v = spawnSync(process.execPath, ["scripts/validate.mjs", article], { cwd: ROOT, env, encoding: "utf8" });
  assert.equal(v.status, 1, "有必须修改的问题时，校验应失败");

  /* 编辑删掉那句没有出处的话、核对后，校验通过 */
  const a = JSON.parse(fs.readFileSync(article, "utf8"));
  a.sections[2].blocks[0].p = "想在自己机器上跑编程 Agent、又不想付 API 费用的团队可以试试。";
  a.claims = a.claims.filter(c => c.value !== "120ms");
  a.verified = true;
  fs.writeFileSync(article, JSON.stringify(a, null, 2));
  const v2 = spawnSync(process.execPath, ["scripts/validate.mjs", article], { cwd: ROOT, env, encoding: "utf8" });
  assert.equal(v2.status, 0, v2.stdout);

  run("scripts/build.mjs");
  assert.ok(fs.existsSync(path.join(tmp, "dist/index.html")));
  assert.ok(fs.existsSync(path.join(tmp, "dist/a/orbit-7-open-coding-model.html")));
  assert.match(fs.readFileSync(path.join(tmp, "dist/rss.xml"), "utf8"), /orbit-7-open-coding-model/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("仓库里已发布的文章都能通过校验", () => {
  const v = spawnSync(process.execPath, ["scripts/validate.mjs"], { cwd: ROOT, encoding: "utf8" });
  assert.equal(v.status, 0, v.stdout);
});
