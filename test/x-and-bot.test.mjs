/* X 监测、收件箱、写稿模型切换、事件合并的测试（不联网） */
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { parseAnthropic, parseXaiFunctionCall, xaiTextAndCitations, xaiWriteRequest, parseResponsesStream, xPostDate, xPostRequest, xPost } from "../scripts/lib/llm.mjs";
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

test("按链接读 X 帖子：用帖子 ID 推算日期，只认引用了这条帖子的结果", async () => {
  assert.equal(xPostDate("2123506733524136446").toISOString().slice(0, 10), "2026-11-19");
  const q = xPostRequest("https://x.com/OpenAIDevs/status/2123506733524136446");
  assert.deepEqual([q.handle, q.fromDate, q.toDate], ["OpenAIDevs", "2026-11-18", "2026-11-21"]);
  assert.match(q.system, /整串|thread/);
  assert.throws(() => xPostRequest("https://openai.com/a"), /不是 X 帖子链接/);
  /* 样例响应里引用了 …0001 和 …0002，没有引用 …0999 */
  const mock = path.join(FX, "xai/x-labs-test.json");
  assert.match(await xPost("https://x.com/examplelabs/status/1990000000000000001", { mockFile: mock }), /Orbit-7/);
  await assert.rejects(xPost("https://x.com/examplelabs/status/1990000000000000999", { mockFile: mock }), /引用里没有这条帖子/);
});

test("小互选中的 X 帖子：当一手来源、不打折、发布方显示账号", async () => {
  const { extractOriginal, publisherOf } = await import("../scripts/lib/original.mjs");
  const { toCandidates } = await import("../scripts/lib/score.mjs");
  const post = "https://x.com/OpenAIDevs/status/2123506733524136446";
  assert.deepEqual(extractOriginal(`<a href="${post}">查看主材料</a>`, "https://xiaohu.ai/article/gpt-live-1-1-api/"), { url: post, tier: "official" });
  assert.equal(publisherOf(post), "@OpenAIDevs");
  const base = { key: post, url: post, title: "GPT-Live-1.1", published: "2026-11-19T20:00:00Z", tier: "official", weight: 1 };
  const fromX = toCandidates([{ ...base, via: post, source: "x-labs-global", publisher: "@OpenAIDevs" }], Date.parse("2026-11-20T00:00:00Z"))[0];
  const fromXiaohu = toCandidates([{ ...base, via: "https://xiaohu.ai/article/gpt-live-1-1-api/", discovered_by: "xiaohu", source: "xiaohu", publisher: "@OpenAIDevs" }], Date.parse("2026-11-20T00:00:00Z"))[0];
  assert.ok(fromXiaohu.score > fromX.score, "选题入口选中的不打折");
  assert.equal(fromXiaohu.discovered_by, "xiaohu");
});

test("AI 总结：100–300 字必填，渲染在文章最前面", async () => {
  const { validateArticle } = await import("../scripts/lib/validate.mjs");
  const { renderArticleBody } = await import("../site/assets/components.js");
  const a = readJson("llm-article.json");
  const errs = x => validateArticle({ ...a, date: "2026-11-18", sources: { main: { url: "u" } }, ...x }).errors.join("；");
  assert.doesNotMatch(errs({}), /AI 总结/);
  assert.match(errs({ ai_summary: "太短了" }), /AI 总结（ai_summary）要 100–300 字，现在 3 字/);
  assert.match(errs({ ai_summary: "长".repeat(301) }), /现在 301 字/);
  assert.match(errs({ ai_summary: undefined }), /现在 0 字/);
  const html = renderArticleBody({ ...a, verified: false });
  assert.ok(html.indexOf('class="aisum"') < html.indexOf('class="lede"'), "AI 总结在导语之前");
  assert.match(html, /待人工核对/);
  assert.match(renderArticleBody({ ...a, verified: true }), /已人工核对/);
});

test("重写已写过的候选：从素材库找回；没写成时不留上次的新稿记录", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wg-redo-"));
  const env = { ...process.env, WG_DATA: path.join(tmp, "data"), WG_CONTENT: path.join(tmp, "content"), WG_SOURCES: path.join(FX, "sources.test.json"), WG_X_ACCOUNTS: path.join(FX, "x-accounts.test.json") };
  const run = (...a) => execFileSync(process.execPath, a, { cwd: ROOT, env, encoding: "utf8" });
  run("scripts/fetch.mjs", "--fixtures");
  const top = JSON.parse(fs.readFileSync(path.join(tmp, "data/candidates.json"), "utf8"))[0];
  run("scripts/draft.mjs", "--id", top.id, "--mock");
  run("scripts/fetch.mjs", "--fixtures");   /* 写过的候选会从清单里去掉 */
  assert.ok(!JSON.parse(fs.readFileSync(path.join(tmp, "data/candidates.json"), "utf8")).some(c => c.id === top.id));
  assert.match(run("scripts/draft.mjs", "--id", top.id, "--mock"), /从素材库找回/);
  assert.equal(fs.readdirSync(path.join(tmp, "content")).length, 2, "重写出第二版，不覆盖第一版");
  /* 没写成（ID 不存在）：新稿列表要清空，且工作流变红 */
  const bad = spawnSync(process.execPath, ["scripts/draft.mjs", "--id", "nonexistent", "--mock"], { cwd: ROOT, env, encoding: "utf8" });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /找不到候选 nonexistent/);
  assert.deepEqual(JSON.parse(fs.readFileSync(path.join(tmp, "data/new-drafts.json"), "utf8")), []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("DeepSeek 写稿：开思考时 tool_choice 用 auto；流式分片拼回文章；直接给 JSON 也接受；截断报错", async () => {
  const { deepseekWriteRequest, parseChatStream, parseDeepseekArticle } = await import("../scripts/lib/llm.mjs");
  const article = readJson("llm-article.json");
  const req = deepseekWriteRequest({ system: "s", user: "u", schema: { type: "object" } });
  assert.equal(req.tool_choice, "auto", "DeepSeek 思考模式下不支持强制调用函数（会 400）");
  assert.equal(req.reasoning_effort, "high");
  assert.equal(req.stream, true);
  assert.match(req.messages[0].content, /必须调用 submit_article/);
  const args = JSON.stringify(article), cut = [0, 40, 1000, args.length];
  const chunk = o => `data: ${JSON.stringify(o)}\n\n`;
  const sse = chunk({ choices: [{ delta: { reasoning_content: "先想想" } }] })
    + cut.slice(0, -1).map((c, i) => chunk({ choices: [{ delta: { tool_calls: [{ index: 0, ...(i === 0 ? { id: "c1", type: "function", function: { name: "submit_article", arguments: args.slice(c, cut[i + 1]) } } : { function: { arguments: args.slice(c, cut[i + 1]) } }) }] } }] })).join("")
    + chunk({ choices: [{ delta: {}, finish_reason: "tool_calls" }] }) + chunk({ choices: [], usage: { prompt_tokens: 100, completion_tokens: 200 } }) + "data: [DONE]\n\n";
  const out = parseChatStream(sse);
  assert.equal(out.usage.completion_tokens, 200);
  assert.deepEqual(parseDeepseekArticle(out), article);
  /* 没调用函数、直接在正文里给 JSON */
  const viaText = parseChatStream(chunk({ choices: [{ delta: { content: "好的：\n```json\n" + args + "\n```" }, finish_reason: "stop" }] }));
  assert.deepEqual(parseDeepseekArticle(viaText), article);
  assert.throws(() => parseDeepseekArticle({ content: "", calls: [{ name: "submit_article", arguments: "{" }], finish: "length" }), /截断/);
  assert.throws(() => parseDeepseekArticle({ content: "我写不了", calls: [], finish: "stop" }), /没有按要求提交/);
  assert.throws(() => parseChatStream(chunk({ error: { message: "Insufficient Balance" } })), /Insufficient Balance/);
});

test("模型把文章多包一层（如 {article: {...}}）时自动拆开", async () => {
  const { unwrapArticle, parseDeepseekArticle, parseXaiFunctionCall } = await import("../scripts/lib/llm.mjs");
  const article = readJson("llm-article.json");
  assert.deepEqual(unwrapArticle({ article }), article);
  assert.deepEqual(unwrapArticle({ submit_article: { article } }), article);
  assert.deepEqual(unwrapArticle(JSON.stringify(article)), article);
  assert.deepEqual(unwrapArticle({ article: JSON.stringify(article) }), article);
  assert.deepEqual(unwrapArticle(article), article);
  assert.deepEqual(parseDeepseekArticle({ content: "", calls: [{ name: "submit_article", arguments: JSON.stringify({ article }) }], finish: "tool_calls" }), article);
  assert.deepEqual(parseXaiFunctionCall({ output: [{ type: "function_call", name: "submit_article", arguments: JSON.stringify({ article }) }] }), article);
});

test("措辞规则：标题里的排名词和新增的夸张词会被提醒", async () => {
  const { validateArticle } = await import("../scripts/lib/validate.mjs");
  const a = { ...readJson("llm-article.json"), date: "2026-11-18", sources: { main: { url: "u" } } };
  const warn = x => validateArticle({ ...a, ...x }).warnings.join("；");
  assert.match(warn({ title: "Google 发布 Gemini 4 Neon：编码代理榜第一" }), /标题里有排名或最高级说法「第一」/);
  assert.match(warn({ title: "某模型拿到 SOTA" }), /「SOTA」/);
  assert.doesNotMatch(warn({}), /标题里有排名/);
  assert.match(warn({ summary: "这些 demo 很炫" }), /夸张用词「很炫」/);
});

test("自动修正：图里写成文字的数值转数字；「500,000+」能对上原文；AI 总结超长会被精简", async () => {
  const { normalizeArticle, trimBySentences } = await import("../scripts/lib/normalize.mjs");
  const { validateArticle } = await import("../scripts/lib/validate.mjs");
  const a = { sections: [{ h: "x", blocks: [{ fig: { type: "bars", title: "t", groups: [{ label: "g", items: [{ label: "A", value: "70.9%" }, { label: "B", value: "约 1,336" }, { label: "C", value: "未公布" }] }] } }] }] };
  assert.equal(normalizeArticle(a).length, 2);
  assert.deepEqual(a.sections[0].blocks[0].fig.groups[0].items.map(i => i.value), [70.9, 1336, "未公布"]);
  const base = { ...readJson("llm-article.json"), date: "2026-11-18", sources: { main: { url: "u" } } };
  const src = "over 500,000 live spreadsheet formulas and about 30% faster";
  const claims = [{ text: "公式数", value: "500,000+", source_url: "s" }, { text: "提速", value: "约 30%", source_url: "s" }];
  assert.doesNotMatch(validateArticle({ ...base, claims }, { sourceTexts: { s: src } }).errors.join(""), /找不到/);
  const long = "第一句说清发生了什么，这一句大约有三十个字左右的长度吧。".repeat(12) + "最后一句是限制。";
  const t = trimBySentences(long, 300);
  assert.ok([...t].length <= 300 && [...t].length >= 100);

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "wg-norm-"));
  const art = readJson("llm-article.json"); art.ai_summary = long;
  art.sections[1].blocks.push({ fig: { type: "bars", title: "跑分", subtitle: "单位：%", groups: [{ label: "g", items: [{ label: "SWE", value: "71.2%", tone: "main" }] }] } });
  fs.writeFileSync(path.join(tmp, "mock.json"), JSON.stringify(art));
  const env = { ...process.env, WG_DATA: path.join(tmp, "data"), WG_CONTENT: path.join(tmp, "content"), WG_SOURCES: path.join(FX, "sources.test.json"), WG_X_ACCOUNTS: path.join(FX, "x-accounts.test.json"), WG_MOCK_ARTICLE: path.join(tmp, "mock.json") };
  const run = (...x) => execFileSync(process.execPath, x, { cwd: ROOT, env, encoding: "utf8" });
  run("scripts/fetch.mjs", "--fixtures");
  const out = run("scripts/draft.mjs", "--top", "1", "--mock", "--min-score", "0");
  assert.match(out, /自动修正 1 处格式/);
  assert.match(out, /AI 总结 \d+ 字 → \d+ 字/);
  const made = JSON.parse(fs.readFileSync(path.join(tmp, "data/new-drafts.json"), "utf8"))[0];
  const saved = JSON.parse(fs.readFileSync(path.join(tmp, "content", `${made.slug}.json`), "utf8"));
  assert.ok([...saved.ai_summary.replace(/\s/g, "")].length <= 300);
  assert.equal(made.errors, 1, "只剩样例里故意放的 120ms");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("引文比对：弯引号、破折号写法不同不算改写", async () => {
  const { validateArticle } = await import("../scripts/lib/validate.mjs");
  const base = { ...readJson("llm-article.json"), date: "2026-11-18", sources: { main: { url: "u" } } };
  const src = "Neon achieves #1 overall on both Zapier\u2019s AutomationBench (56.3%) \u2014 a long\u2011horizon test.";
  const claims = [{ text: "x", value: "56.3%", source_url: "s", quote: "achieves #1 overall on both Zapier's AutomationBench (56.3%) - a long-horizon test" }];
  assert.doesNotMatch(validateArticle({ ...base, claims }, { sourceTexts: { s: src } }).warnings.join(""), /引文和原文对不上/);
  const reworded = [{ ...claims[0], quote: "ranks first on Zapier's AutomationBench" }];
  assert.match(validateArticle({ ...base, claims: reworded }, { sourceTexts: { s: src } }).warnings.join(""), /引文和原文对不上/);
});
