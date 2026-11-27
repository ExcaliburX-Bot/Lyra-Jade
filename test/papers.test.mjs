import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { renderArticleBody } from "../site/assets/components.js";
import { validateArticle } from "../scripts/lib/validate.mjs";

const base = JSON.parse(fs.readFileSync("test/fixtures/llm-article.json", "utf8"));
const paper = { ...base, slug: "p", category: "paper", status: "published", publisher: "Vaswani 等 · Google", title: "精读《Attention》：测试",
  paper: { title: "Attention Is All You Need", url: "https://arxiv.org/abs/1706.03762", arxiv: "1706.03762", year: 2017, venue: "NIPS 2017" },
  sections: [...base.sections, { h: "公式和自测", blocks: [
    { callout: { kind: "intuition", title: "比喻", text: "像查资料，d_{model} 是 512" } },
    { formula: { expr: "Attention(Q, K, V) = softmax(Q·Kᵀ / √dₖ)·V\nPE = sin(pos / 10000^{2i/d_{model}})\nE_{(x, y_{w}) ∼ D}", parts: [{ sym: "W^{Q}", desc: "查询投影" }] } },
    { quiz: { q: "为什么除以 √dₖ？", options: ["更快", "防止 softmax 饱和"], answer: 1, why: "方差等于 dₖ" } },
    { quiz: { q: "第二题", options: ["a", "b"], answer: 0, why: "因为" } },
    { fig: { type: "heatmap", title: "热力图", subtitle: "示意：r_{w} 是分数", rows: ["猫", "它"], cols: ["猫", "它"], values: [[0.9, 0.1], [0.7, 0.3]], highlight: { row: 1 } } }] }] };

test("论文精读：提示框、公式（上下标）、自测题、热力图、论文信息卡都能渲染", () => {
  const h = renderArticleBody(paper);
  assert.match(h, /class="paper-card"[\s\S]*Attention Is All You Need[\s\S]*arxiv\.org\/abs\/1706\.03762/);
  assert.match(h, /class="callout co-intuition"[\s\S]*d<sub>model<\/sub>/);
  assert.match(h, /10000<sup>2i\/d<sub>model<\/sub><\/sup>/);
  assert.match(h, /<dt>W<sup>Q<\/sup><\/dt>/);
  assert.match(h, /E<sub>\(x, y<sub>w<\/sub>\) ∼ D<\/sub>/);   /* 嵌套下标 */
  assert.match(h, /class="fig-s">示意：r<sub>w<\/sub>/);         /* 图的副标题也认上下标 */
  assert.match(h, /class="quiz" data-answer="1"/);
  assert.match(h, /class="fheat"[\s\S]*tr class="hr"/);
  assert.match(renderArticleBody(paper, { lang: "en" }), /Check yourself/);
});

test("论文精读：校验自测题答案序号、热力图行列、论文信息", () => {
  assert.equal(validateArticle(paper).errors.filter(e => /自测题|热力图|paper/.test(e)).length, 0);
  const bad = structuredClone(paper);
  const blocks = bad.sections.at(-1).blocks;
  blocks[2].quiz.answer = 5; blocks[4].fig.values = [[1]]; delete bad.paper;
  const e = validateArticle(bad).errors.join("\n");
  assert.match(e, /自测题/); assert.match(e, /热力图/); assert.match(e, /paper 字段/);
});

test("构建：论文精读页有书单，精读过的论文链到文章；论文不进厂商专题", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lj-pp-"));
  const content = path.join(tmp, "articles"), dist = path.join(tmp, "dist");
  fs.mkdirSync(content);
  fs.writeFileSync(path.join(content, "p.json"), JSON.stringify(paper));
  execFileSync("node", ["scripts/build.mjs"], { env: { ...process.env, WG_CONTENT: content, WG_CONTENT_EN: path.join(tmp, "none"), WG_DIST: dist, WG_SITE_URL: "https://lyra.example" }, stdio: "pipe" });
  const page = fs.readFileSync(path.join(dist, "papers.html"), "utf8");
  assert.match(page, /"section":"paper"/);
  assert.match(page, /论文书单/);
  assert.match(page, /<li id="p-transformer" class="done"><a href="a\/p\.html"><b>Transformer<\/b>/);
  /* 学习路线：主线一里 Transformer 已精读，链到文章；没精读的链到书单里的条目 */
  assert.match(page, /id="paths"[\s\S]*主线一[\s\S]*<li class="done"><a href="a\/p\.html"><i>4<\/i><b>Transformer<\/b>/);
  assert.match(page, /<a href="#p-word2vec"><i>1<\/i>/);
  assert.match(page, /已精读 1 \/ 13/);
  assert.ok(fs.existsSync(path.join(dist, "en/papers.html")));
  const art = fs.readFileSync(path.join(dist, "a/p.html"), "utf8");
  assert.match(art, /论文 NIPS 2017/);
  /* 论文精读只属于论文精读页：返回链接回论文精读，不回 AI 解读首页 */
  assert.match(art, /<a href="\.\.\/papers\.html" class="back">[\s\S]{0,120}返回论文精读<\/a>/);
  assert.doesNotMatch(art, /返回 AI 解读<\/a>/);
  /* 首页（AI 解读）和专题页的列表都从“非论文”的文章里取 */
  const app = fs.readFileSync("site/assets/app.js", "utf8");
  assert.match(app, /const NEWS = ARTICLES\.filter\(a=>a\.cat!=="paper"\)/);
  assert.match(app, /const POOL = TOPIC \? NEWS\.filter[\s\S]{0,160}: NEWS;/);
  /* 文章底部的路线导航：Transformer 是主线一第 4 篇，前后两篇都没精读，链到书单 */
  assert.match(art, /class="pathnav"[\s\S]*主线一[\s\S]*第 4 \/ 13 篇/);
  assert.match(art, /class="pn-prev pn-todo" href="\.\.\/papers\.html#p-bahdanau-attention"/);
  assert.match(art, /class="pn-next pn-todo" href="\.\.\/papers\.html#p-gpt-1"/);
  const api = JSON.parse(fs.readFileSync(path.join(dist, "api/v1/articles.json"), "utf8"));
  assert.deepEqual(api.articles[0].topics, []);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("论文书单：学习路线里的每篇论文都在书单里，补充论文都有链接", () => {
  const lib = JSON.parse(fs.readFileSync("content/papers/library.json", "utf8"));
  const ids = new Set(lib.papers.map(p => p.id));
  assert.equal(ids.size, lib.papers.length, "论文 id 不能重复");
  const areas = new Set(lib.areas.map(a => a.k));
  for (const p of lib.papers) assert.ok(areas.has(p.area), `${p.id} 的方向 ${p.area} 不存在`);
  for (const t of lib.tracks) for (const id of t.ids) assert.ok(ids.has(id), `主线 ${t.k} 里的 ${id} 不在书单里`);
  for (const p of lib.papers.filter(p => p.extra)) assert.match(p.url, /^https:\/\//, `${p.id} 缺少链接`);
});

test("回首页的链接：只有首页本身原地回顶部，论文精读页和专题页要真的跳回首页", () => {
  const js = fs.readFileSync("site/assets/app.js", "utf8");
  const m = js.match(/if\("home" in d\)\{if\(([^)]*)\)\{location\.href=HOME\+"index\.html"/);
  assert.ok(m, "找不到 data-home 的点击处理");
  for (const k of ["!LIST", "TOPIC", "SECTION"]) assert.ok(m[1].includes(k), `跳转条件缺少 ${k}`);
});

test("小白版：块上的 plain 会渲染成带插图的旁注，插图文件必须存在", () => {
  const a = { ...paper, sections: [{ h: "公式", blocks: [{ formula: { expr: "a ＝ b" }, plain: { title: "打个比方", text: "像**搬家**。", pic: "flash-cart" } }] }] };
  const h = renderArticleBody(a, { assets: "../assets/" });
  assert.match(h, /class="pl-wrap" data-pl="1"><aside class="plain">/);
  /* 同一小节里挨得近的（中间最多隔一块）合成一张卡，远的单独一张 */
  const g = renderArticleBody({ ...paper, sections: [{ h: "x", blocks: [{ p: "a", plain: { text: "一" } }, { p: "b" }, { p: "c", plain: { text: "二" } }, { p: "d" }, { p: "e" }, { p: "f", plain: { text: "三" } }] }] });
  assert.equal((g.match(/pl-merged/g) || []).length, 1);
  assert.match(g, /pl-merged"><div class="pl-item" data-pl="1">[\s\S]*<div class="pl-item" data-pl="2">/);
  assert.equal((g.match(/pl-wrap pl-grouped/g) || []).length, 2);
  assert.match(g, /class="pl-wrap" data-pl="3"/);
  assert.match(h, /小白版/);
  assert.match(h, /src="\.\.\/assets\/plain\/flash-cart\.svg"/);
  assert.match(h, /<b>搬家<\/b>/);
  assert.match(renderArticleBody(a, { lang: "en", assets: "../../assets/" }), /In plain terms[\s\S]*\.\.\/\.\.\/assets\/plain\//);
  assert.doesNotMatch(renderArticleBody({ ...a, sections: [{ h: "x", blocks: [{ p: "y", plain: { text: "z", pic: "../x" } }] }] }), /<img/);
  for (const dir of ["content/articles", "content/en"]) {
    if (!fs.existsSync(dir)) continue;
    for (const f of fs.readdirSync(dir).filter(f => f.endsWith(".json"))) {
      const art = JSON.parse(fs.readFileSync(path.join(dir, f), "utf8"));
      for (const b of (art.sections || []).flatMap(s => s.blocks || [])) if (b.plain?.pic)
        assert.ok(fs.existsSync(`site/assets/plain/${b.plain.pic}.svg`), `${f} 用到的插图 ${b.plain.pic}.svg 不存在`);
    }
  }
});
