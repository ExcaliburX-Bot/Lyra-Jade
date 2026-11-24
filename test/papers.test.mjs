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
    { formula: { expr: "Attention(Q, K, V) = softmax(Q·Kᵀ / √dₖ)·V\nPE = sin(pos / 10000^{2i/d_{model}})", parts: [{ sym: "W^{Q}", desc: "查询投影" }] } },
    { quiz: { q: "为什么除以 √dₖ？", options: ["更快", "防止 softmax 饱和"], answer: 1, why: "方差等于 dₖ" } },
    { quiz: { q: "第二题", options: ["a", "b"], answer: 0, why: "因为" } },
    { fig: { type: "heatmap", title: "热力图", subtitle: "示意", rows: ["猫", "它"], cols: ["猫", "它"], values: [[0.9, 0.1], [0.7, 0.3]], highlight: { row: 1 } } }] }] };

test("论文精读：提示框、公式（上下标）、自测题、热力图、论文信息卡都能渲染", () => {
  const h = renderArticleBody(paper);
  assert.match(h, /class="paper-card"[\s\S]*Attention Is All You Need[\s\S]*arxiv\.org\/abs\/1706\.03762/);
  assert.match(h, /class="callout co-intuition"[\s\S]*d<sub>model<\/sub>/);
  assert.match(h, /10000<sup>2i\/d<sub>model<\/sub><\/sup>/);
  assert.match(h, /<dt>W<sup>Q<\/sup><\/dt>/);
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
  assert.match(page, /<li class="done"><a href="a\/p\.html"><b>Transformer<\/b>/);
  assert.ok(fs.existsSync(path.join(dist, "en/papers.html")));
  assert.match(fs.readFileSync(path.join(dist, "a/p.html"), "utf8"), /论文 NIPS 2017/);
  const api = JSON.parse(fs.readFileSync(path.join(dist, "api/v1/articles.json"), "utf8"));
  assert.deepEqual(api.articles[0].topics, []);
  fs.rmSync(tmp, { recursive: true, force: true });
});
