/* X 监测、收件箱、写稿模型切换、事件合并的测试（不联网） */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseAnthropic, parseXaiFunctionCall, xaiTextAndCitations, xaiWriteRequest, parseResponsesStream } from "../scripts/lib/llm.mjs";
import { postsToItems, extractJson } from "../scripts/x-watch.mjs";
import { cluster } from "../scripts/lib/score.mjs";
import { checkInboxItem } from "../scripts/lib/inbox.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const FX = path.join(ROOT, "test/fixtures");
const readJson = f => JSON.parse(fs.readFileSync(path.join(FX, f), "utf8"));

test("写稿模型：Claude 和 Grok 的返回都能解析成同一篇文章", () => {
  const article = readJson("llm-article.json");
  assert.deepEqual(parseXaiFunctionCall(readJson("xai/function-call.json")), article);
  assert.deepEqual(parseAnthropic({ content: [{ type: "text", text: "好" }, { type: "tool_use", name: "submit_article", input: article }] }), article);
  assert.throws(() => parseXaiFunctionCall({ output: [{ type: "message" }] }), /没有按要求返回/);
  const req = xaiWriteRequest({ system: "s", user: "u", schema: { type: "object" } });
  assert.equal(req.tool_choice, "required", "xAI 不接受指定函数名的 tool_choice 对象（实测 422）");
  assert.equal(req.tools.length, 1);
  assert.equal(req.tools[0].name, "submit_article");
  assert.equal(req.stream, true, "长文要流式接收，否则 5 分钟收不到响应头会被断开");
  assert.equal(req.reasoning.effort, "medium");
  /* 流式返回：有 response.completed 时用它；没有时用逐项完成的输出拼 */
  const fc = readJson("xai/function-call.json").output[0];
  const sse = evs => evs.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join("");
  const s1 = sse([{ type: "response.created" }, { type: "response.output_item.done", item: fc }, { type: "response.completed", response: { output: [fc] } }]);
  assert.deepEqual(parseXaiFunctionCall(parseResponsesStream(s1)), article);
  const s2 = sse([{ type: "response.output_item.added", item: { type: "reasoning" } }, { type: "response.output_item.done", item: fc }]);
  assert.deepEqual(parseXaiFunctionCall(parseResponsesStream(s2)), article);
  assert.throws(() => parseResponsesStream(sse([{ type: "response.failed", response: { error: { message: "rate limited" } } }])), /rate limited/);
});

test("X 搜索：只收引用过的帖子、只收本组账号", async () => {
  const r = xaiTextAndCitations(readJson("xai/x-labs-test.json"));
  assert.equal(r.citations.length, 3);
  assert.equal(r.usage.x_posts_fetched, 37);
  const group = readJson("x-accounts.test.json")[0];
  const { items, dropped } = await postsToItems(group, extractJson(r.text), r.citations, new Date("2026-11-19T00:00:00Z"));
  assert.equal(items.length, 2);
  assert.equal(dropped.length, 2);
  assert.match(dropped.join("\n"), /可能是编的/);
  assert.match(dropped.join("\n"), /不是本组账号 @randomuser/);
  const orbit = items.find(i => i.publisher === "@examplelabs");
  assert.equal(orbit.url, "https://example.com/blog/orbit-7?utm_source=x", "有一手链接时，素材指向一手链接");
  assert.equal(orbit.via, "https://x.com/examplelabs/status/1990000000000000001");
  const nimbus = items.find(i => i.publisher === "@otherlab");
  assert.equal(nimbus.url, "https://x.com/otherlab/status/1990000000000000002", "x.com/i/ 形式的引用也算数");
  assert.match(nimbus.text, /300ms latency/);
  for (const it of items) assert.deepEqual(checkInboxItem(it), []);
});

test("X 搜索：发现类账号只收附了一手链接的帖子", async () => {
  const group = { id: "kol", mode: "discover", tier: "discovery", handles: ["examplelabs", "otherlab"] };
  const r = xaiTextAndCitations(readJson("xai/x-labs-test.json"));
  const { items } = await postsToItems(group, extractJson(r.text), r.citations);
  assert.deepEqual(items.map(i => i.publisher), ["@examplelabs"]);
});

test("事件合并与素材顺序无关，同一链接一定合在一起", () => {
  const mk = (key, title, published, via) => ({ key, title, published, url: key, ...(via ? { via } : {}), tier: "official" });
  const list = [
    mk("https://example.com/blog/orbit-7", "Introducing Orbit-7: a 34B open model for coding agents", "2026-11-18T16:00:00Z"),
    mk("https://news.example.net/orbit-7", "Example Labs introduces Orbit-7, a 34B open model for coding agents", "2026-11-18T18:30:00Z"),
    mk("https://example.com/blog/orbit-7", "Orbit-7 is here", "2026-11-18T16:05:00Z", "https://x.com/examplelabs/status/1"),
    mk("https://example.com/blog/other", "Something unrelated entirely", "2026-11-18T17:00:00Z")
  ];
  const shape = items => cluster(items).map(e => e.items.map(i => i.title).sort().join(" + ")).sort();
  const expected = shape(list);
  assert.equal(expected.length, 2);
  for (let k = 0; k < 6; k++) assert.deepEqual(shape([...list].sort(() => Math.random() - 0.5)), expected);
});

test("收件箱：格式不对的条目被跳过，坏文件保留", () => {
  assert.match(checkInboxItem({ title: "x", url: "ftp://a", tier: "boss", source: "" }).join("；"), /url.*tier.*source/);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wg-inbox-"));
  const env = { ...process.env, WG_DATA: tmp, WG_SOURCES: path.join(FX, "sources.test.json") };
  fs.mkdirSync(path.join(tmp, "inbox"));
  fs.writeFileSync(path.join(tmp, "inbox/bot-ok.json"), JSON.stringify([
    { title: "Qwen4 发布", url: "https://qwen.ai/blog?id=qwen4", tier: "official", source: "bot:browser", publisher: "Qwen" },
    { title: "", url: "https://a.b", tier: "official", source: "bot:browser" }
  ]));
  fs.writeFileSync(path.join(tmp, "inbox/bot-broken.json"), "{oops");
  const out = execFileSync(process.execPath, ["scripts/fetch.mjs", "--fixtures"], { cwd: ROOT, env, encoding: "utf8" });
  assert.match(out, /收件箱 bot-ok\.json：新增 1 条，1 条格式不对/);
  assert.match(out, /bot-broken\.json：不是合法 JSON，已保留/);
  assert.ok(fs.existsSync(path.join(tmp, "inbox/bot-broken.json")));
  assert.ok(!fs.existsSync(path.join(tmp, "inbox/bot-ok.json")));
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("端到端：X 监测 → 抓取 → 写稿；只有 X 帖子的事件用帖子原文作主材料；不覆盖已有文章", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wg-x-"));
  const env = { ...process.env, WG_DATA: path.join(tmp, "data"), WG_CONTENT: path.join(tmp, "content"), WG_DIST: path.join(tmp, "dist"),
    WG_SOURCES: path.join(FX, "sources.test.json"), WG_X_ACCOUNTS: path.join(FX, "x-accounts.test.json") };
  const run = (...a) => execFileSync(process.execPath, a, { cwd: ROOT, env, encoding: "utf8" });
  assert.match(run("scripts/x-watch.mjs", "--mock"), /收 2 条，丢弃 2 条/);
  run("scripts/fetch.mjs", "--fixtures");
  const cands = JSON.parse(fs.readFileSync(path.join(tmp, "data/candidates.json"), "utf8"));
  assert.equal(cands[0].url, "https://example.com/blog/orbit-7?utm_source=rss&utm_medium=feed", "同层级时官方博客当主材料，X 帖子并入相关");
  assert.ok(cands[0].related.some(r => r.publisher === "@examplelabs"));
  const nimbus = cands.find(c => c.url.includes("x.com/otherlab"));
  run("scripts/draft.mjs", "--id", nimbus.id, "--mock");
  const archived = fs.readdirSync(path.join(tmp, "data/sources")).map(f => fs.readFileSync(path.join(tmp, "data/sources", f), "utf8"));
  assert.ok(archived.some(t => /NOTE: X 帖子原文/.test(t) && /300ms latency/.test(t)));
  run("scripts/draft.mjs", "--id", cands[0].id, "--mock");
  assert.equal(fs.readdirSync(path.join(tmp, "content")).length, 2, "模拟模型两次返回同一个 slug，第二篇应改名而不是覆盖");
  const second = JSON.parse(fs.readFileSync(path.join(tmp, "data/new-drafts.json"), "utf8"))[0];
  const art = JSON.parse(fs.readFileSync(path.join(tmp, "content", `${second.slug}.json`), "utf8"));
  assert.equal(art.pipeline.tier, "official");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("自动合并（阶段 B）：只合并符合全部条件的新稿", async () => {
  const { automergeProblems } = await import("../scripts/ci/automerge-check.mjs");
  const src = fs.readFileSync(path.join(FX, "pages/source.html"), "utf8");
  const base = readJson("llm-article.json");
  const fixed = () => {
    const a = structuredClone(base);
    Object.assign(a, { date: "2026-11-18", verified: true, pipeline: { tier: "official" }, sources: { ...a.sources, main: { url: "https://example.com/blog/orbit-7" } } });
    a.sections[2].blocks[0].p = "想在自己机器上跑编程 Agent 的团队可以试试。";
    a.claims = a.claims.filter(c => c.value !== "120ms");
    return a;
  };
  const pr = { headRefName: "draft/orbit-7-open-coding-model", labels: [{ name: "bot-reviewed" }], files: [{ path: "content/articles/orbit-7-open-coding-model.json" }], fileIsNew: true };
  const opts = a => ({ sourceTexts: Object.fromEntries(a.claims.map(c => [c.source_url, src])), categories: ["product"] });
  const ok = fixed();
  assert.deepEqual(automergeProblems(pr, ok, opts(ok)), []);

  const cases = [
    [{ ...pr, headRefName: "bot/fix-sources" }, ok, /draft\//],
    [{ ...pr, isCrossRepository: true }, ok, /fork/],
    [{ ...pr, labels: [] }, ok, /bot-reviewed/],
    [{ ...pr, labels: [{ name: "bot-reviewed" }, { name: "需修改" }] }, ok, /需修改/],
    [{ ...pr, files: [...pr.files, { path: "scripts/build.mjs" }] }, ok, /2 个文件/],
    [{ ...pr, fileIsNew: false }, ok, /不是新增/],
    [pr, { ...ok, verified: false }, /verified/],
    [pr, { ...ok, pipeline: { tier: "discovery" } }, /不是 official/],
    [pr, { ...ok, category: "insight" }, /不在自动合并范围/],
    [pr, (() => { const a = fixed(); a.claims = base.claims; a.sections = base.sections; return a; })(), /必须修改/]
  ];
  for (const [p, a, re] of cases) assert.match(automergeProblems(p, a, opts(a)).join("；"), re);
  assert.match(automergeProblems(pr, ok, { categories: ["product"], sourceTexts: {} }).join("；"), /没有存档/);
});

test("机器人标记不写的候选，定时写稿会跳过", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wg-skip-"));
  const env = { ...process.env, WG_DATA: path.join(tmp, "data"), WG_CONTENT: path.join(tmp, "content"), WG_SOURCES: path.join(FX, "sources.test.json"), WG_X_ACCOUNTS: path.join(FX, "x-accounts.test.json") };
  const run = (...a) => execFileSync(process.execPath, a, { cwd: ROOT, env, encoding: "utf8" });
  run("scripts/fetch.mjs", "--fixtures");
  const top = JSON.parse(fs.readFileSync(path.join(tmp, "data/candidates.json"), "utf8"))[0];
  assert.match(run("scripts/bot.mjs", "skip", top.id, "--reason", "测试：已有同类稿"), /已标记不写/);
  run("scripts/draft.mjs", "--top", "1", "--mock", "--min-score", "0");
  const made = JSON.parse(fs.readFileSync(path.join(tmp, "data/drafted.json"), "utf8"));
  assert.ok(!made.includes(top.id), "被跳过的候选不应被写");
  assert.equal(made.length, 1);
  assert.match(run("scripts/bot.mjs", "weekly"), /测试：已有同类稿/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("列表页：标题取 h 标签、日期从链接文字或其后取出、导航词跳过", async () => {
  const { parseLinks, extractDate } = await import("../scripts/lib/feed.mjs");
  assert.equal(extractDate("Featured October 12, 2026 Muse Wonder").iso, "2026-10-12T12:00:00.000Z");
  assert.equal(extractDate("发布于 2026年11月9日").iso, "2026-11-09T12:00:00.000Z");
  assert.equal(extractDate("Nov 9, 2026").iso, "2026-11-09T12:00:00.000Z");
  assert.equal(extractDate("9 Sept 2026").iso, "2026-09-09T12:00:00.000Z");
  assert.equal(extractDate("version 2026.13.40"), null);
  const html = `
    <nav><a href="/news/product">Product</a><a href="/news/policy">Policy</a></nav>
    <a href="/blog/muse-wonder"><span>Featured</span> <span>October 12, 2026</span> <h3>Muse Wonder: A Frontier Model</h3><p>Muse Wonder is Meta's frontier AI model that keeps track of what matters.</p></a>
    <a href="/blog/muse-ember">Introducing Our Smallest Model: Muse Ember November 9, 2026</a>
    <a href="/news/public-benefit-fund"><h4>Investing in the public benefit</h4> We're committing a portion of shares.</a><time>Nov 10, 2026</time>
    <a href="/news/no-date-post">A post whose date is nowhere</a>`;
  const out = parseLinks(html, { baseUrl: "https://ex.com/", pattern: "^/(blog|news)/[a-z0-9-]+$", exclude: "^/news/(product)$" });
  assert.deepEqual(out.map(o => [o.title, o.published?.slice(0, 10) || null]), [
    ["Muse Wonder: A Frontier Model", "2026-10-12"],
    ["Introducing Our Smallest Model: Muse Ember", "2026-11-09"],
    ["Investing in the public benefit", "2026-11-10"],
    ["A post whose date is nowhere", null]
  ]);
  assert.match(out[0].summary, /keeps track/);
});

test("只有短推文的候选：打折排后；定时写稿跳过它并记进不写清单，接着写下一个", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wg-thin-"));
  const env = { ...process.env, WG_DATA: path.join(tmp, "data"), WG_CONTENT: path.join(tmp, "content"), WG_SOURCES: path.join(FX, "sources.test.json"), WG_X_ACCOUNTS: path.join(FX, "x-accounts.test.json") };
  const run = (...a) => execFileSync(process.execPath, a, { cwd: ROOT, env, encoding: "utf8" });
  run("scripts/x-watch.mjs", "--mock");
  run("scripts/fetch.mjs", "--fixtures");
  const cands = JSON.parse(fs.readFileSync(path.join(tmp, "data/candidates.json"), "utf8"));
  const nimbus = cands.find(c => c.url.includes("x.com/otherlab"));
  assert.ok(cands.findIndex(c => c === nimbus) > 0 && nimbus.score < cands[0].score);
  /* 除了 Nimbus 和一篇普通候选，其他都标记不写，让 Nimbus 排第一 */
  const keep = cands.find(c => c !== nimbus && !c.url.includes("x.com"));
  for (const c of cands) if (c !== nimbus && c !== keep) run("scripts/bot.mjs", "skip", c.id, "--reason", "测试");
  if (nimbus.score < keep.score) fs.writeFileSync(path.join(tmp, "data/candidates.json"), JSON.stringify([nimbus, keep]));
  const out = run("scripts/draft.mjs", "--top", "1", "--mock", "--min-score", "0");
  assert.match(out, /材料只有 \d+ 字/);
  const skips = JSON.parse(fs.readFileSync(path.join(tmp, "data/skip.json"), "utf8"));
  assert.ok(skips.some(s => s.id === nimbus.id && /材料太短/.test(s.reason)));
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp, "data/drafted.json"), "utf8")), [keep.id], "跳过后接着写下一个");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("选题入口（发现渠道）：只取「查看主材料」链接回到原文，不用对方文字；找不到一手原文的不写", async () => {
  const { extractOriginal, tierOfUrl } = await import("../scripts/lib/original.mjs");
  const page = fs.readFileSync(path.join(FX, "pages/discovery/orbit-7-explained.html"), "utf8");
  assert.deepEqual(extractOriginal(page, "https://disc.example/article/orbit-7-explained/"), { url: "https://example.com/blog/orbit-7?utm_source=disc", tier: "official" });
  assert.equal(extractOriginal(fs.readFileSync(path.join(FX, "pages/discovery/no-label.html"), "utf8"), "https://disc.example/article/no-label/"), null, "没有标注主材料就不猜");
  assert.equal(tierOfUrl("https://arxiv.org/abs/2611.00001"), "primary");
  assert.equal(tierOfUrl("https://www.tomshardware.com/x"), "media");

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wg-disc-"));
  const env = { ...process.env, WG_DATA: path.join(tmp, "data"), WG_CONTENT: path.join(tmp, "content"), WG_SOURCES: path.join(FX, "sources.discovery.test.json"), WG_X_ACCOUNTS: path.join(FX, "x-accounts.test.json") };
  const run = (...a) => execFileSync(process.execPath, a, { cwd: ROOT, env, encoding: "utf8" });
  assert.match(run("scripts/fetch.mjs", "--fixtures"), /打开 3 篇找原文，找到 1 个一手链接/);
  const items = Object.values(JSON.parse(fs.readFileSync(path.join(tmp, "data/items.json"), "utf8")));
  assert.ok(items.filter(i => i.source === "example-discovery").every(i => i.summary === ""), "对方的简介不保留");
  const cands = JSON.parse(fs.readFileSync(path.join(tmp, "data/candidates.json"), "utf8"));
  const orbit = cands.find(c => /Orbit-7/.test(c.title));
  assert.equal(orbit.url, "https://example.com/blog/orbit-7?utm_source=rss&utm_medium=feed", "和官方博客合成同一事件，主材料仍是官方博客");
  assert.ok(orbit.related.some(r => r.publisher === "example.com"));
  const mediaOnly = cands.find(c => c.url.includes("media-only"));
  assert.equal(mediaOnly.tier, "discovery");
  const out = run("scripts/draft.mjs", "--top", "5", "--mock", "--min-score", "0");
  assert.match(out, /主材料不是一手来源（discovery/);
  const skips = JSON.parse(fs.readFileSync(path.join(tmp, "data/skip.json"), "utf8"));
  assert.ok(skips.some(s => s.id === mediaOnly.id));
  fs.rmSync(tmp, { recursive: true, force: true });
});
