import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { collectSegments, applySegments, checkTranslation, numbersZh, numbersEn, translateArticle, sourceHash, parseMap } from "../scripts/lib/translate.mjs";
import { translationProblems } from "../scripts/ci/automerge-check.mjs";

const zh = {
  slug: "demo", category: "product", publisher: "Google", date: "2026-11-18", title: "Gemini 发布：100 万 token 上下文，输入每百万 token 3 美元",
  summary: "11 月 18 日上线。", ai_summary: "总结", brief: ["约 101 万", "排第 3"], status: "published", verified: false, pipeline: { tier: "official" },
  sections: [{ h: "这是什么", blocks: [{ p: "参数 3 万亿，增长 50%–80%。" }, { fig: { type: "kpi", title: "数字", items: [{ value: 1, unit: "百万 token", label: "上下文" }] } },
    { fig: { type: "quote", text: "We are excited.", zh: "我们很兴奋。", who: "CEO", source_url: "https://x" } }] }],
  sources: { main: { title: "Intro", url: "https://g.dev/x", date: "2026-11-18", publisher: "Google" }, note: "数据来自官方。" },
  claims: [{ text: "上下文 100 万 token", value: "1M", source_url: "https://g.dev/x", quote: "1M tokens", as_written: "100 万" }]
};

test("翻译：只拆要翻的中文字段，数值、链接、原文引语不进模型", () => {
  const segs = collectSegments(zh);
  const paths = segs.map(s => s.path.join("."));
  assert.ok(paths.includes("title") && paths.includes("sections.0.blocks.1.fig.items.0.unit") && paths.includes("claims.0.as_written"));
  assert.ok(!paths.some(p => /value|url|quote|\.zh$|pipeline|date/.test(p)), paths.join(" "));
  assert.equal(segs.find(s => s.path.join(".") === "title").where, "headline");
});

test("翻译：中文数量级和英文写法按数值对上", () => {
  assert.deepEqual(numbersZh("100 万、3 万亿、1,195 亿、8B、约 101 万"), ["1000000", "3000000000000", "119500000000", "8000000000", "1010000"]);
  const en = numbersEn("1M tokens, 3 trillion, $119.5 billion, 8B, about 1.01 million, Nov. 18, ranked third");
  for (const n of ["1000000", "3000000000000", "119500000000", "8000000000", "1010000", "11", "18", "3"]) assert.ok(en.has(n), n);
});

test("翻译：漏数字、残留中文、缺片段都会被找出来", () => {
  const segs = collectSegments(zh);
  const good = Object.fromEntries(segs.map(s => [s.id, `x ${numbersZh(s.text).join(" ")}`]));
  assert.deepEqual(checkTranslation(segs, good), []);
  const t = segs.find(s => s.path.join(".") === "title").id;
  const bad = { ...good, [t]: "Gemini launches with a 1M-token context", s2: "上线了" };
  delete bad[segs.at(-1).id];
  const p = checkTranslation(segs, bad).map(x => `${x.id} ${x.msg}`).join("\n");
  assert.match(p, new RegExp(`${t} numbers missing or changed: 3`));
  assert.match(p, /s2 still contains Chinese/);
  assert.match(p, /missing translation/);
});

test("翻译：填回结构、去掉引语的中文译文、记下中文稿指纹；数字错时让模型修一次", async () => {
  let fixed = 0;
  const mock = (stage, segs) => {
    if (stage === "fix") { fixed++; return Object.fromEntries(segs.map(s => [s.id, `fixed ${numbersZh(s.text).join(" ")}`])); }
    return Object.fromEntries(segs.map(s => [s.id, s.path[0] === "title" ? "Gemini launches" : `${stage} ${numbersZh(s.text).join(" ")}`]));
  };
  const r = await translateArticle(zh, { mock });
  assert.ok(r.article, JSON.stringify(r.problems));
  assert.ok(fixed >= 1);
  const en = r.article;
  assert.equal(en.lang, "en");
  assert.equal(en.translated_from, sourceHash(zh));
  assert.equal(en.sections[0].blocks[1].fig.items[0].value, 1);
  assert.equal(en.sections[0].blocks[2].fig.zh, undefined);
  assert.equal(en.sections[0].blocks[2].fig.text, "We are excited.");
  assert.equal(en.claims[0].value, "1M");
  assert.equal(en.pipeline, undefined);
  assert.equal(zh.title.startsWith("Gemini 发布"), true, "不改原稿");
  assert.equal(sourceHash({ ...zh, verified: true, _pub: "x" }), sourceHash(zh), "改核对标记不算改稿");
});

test("翻译：模型回复里的 JSON 能拆出来", () => {
  assert.deepEqual(parseMap('好的\n```json\n{"s1": "A",\n"s2": "B",}\n```'), { s1: "A", s2: "B" });
  assert.deepEqual(parseMap('{"segments": {"s1": "A"}}'), { s1: "A" });
});

test("自动合并：英文版 PR 只能改 content/en，不能有中文", () => {
  const pr = { headRefName: "translate/20261124", labels: [{ name: "auto-publish" }], files: [{ path: "content/en/demo.json" }] };
  const ok = { lang: "en", translated_from: "abc", title: "Gemini launches", sections: [{ blocks: [{ fig: { type: "quote", text: "x" } }] }] };
  assert.deepEqual(translationProblems(pr, { "content/en/demo.json": ok }, { label: "auto-publish" }), []);
  assert.match(translationProblems(pr, { "content/en/demo.json": { ...ok, summary: "还有中文" } }, { label: "auto-publish" }).join(), /还有 1 处中文/);
  assert.match(translationProblems({ ...pr, files: [{ path: "content/articles/demo.json" }] }, {}, { label: "auto-publish" }).join(), /不是英文版文件/);
  assert.match(translationProblems({ ...pr, headRefName: "draft/x" }, { "content/en/demo.json": ok }, { label: "auto-publish" }).join(), /不是翻译流水线/);
});

test("构建：有译文的文章生成 en/ 页面，互相链接；中文稿改过后旧译文不上线", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lj-en-"));
  const content = path.join(tmp, "articles"), contentEn = path.join(tmp, "en"), dist = path.join(tmp, "dist");
  fs.mkdirSync(content); fs.mkdirSync(contentEn);
  const zh2 = { ...zh, slug: "other", title: "另一篇：没有译文" };
  fs.writeFileSync(path.join(content, "demo.json"), JSON.stringify(zh));
  fs.writeFileSync(path.join(content, "other.json"), JSON.stringify(zh2));
  const { article } = await translateArticle(zh, { mock: (stage, segs) => Object.fromEntries(segs.map(s => [s.id, `${s.path[0] === "title" ? "Gemini launches" : "en"} ${numbersZh(s.text).join(" ")}`])) });
  fs.writeFileSync(path.join(contentEn, "demo.json"), JSON.stringify(article));
  fs.writeFileSync(path.join(contentEn, "other.json"), JSON.stringify({ ...article, slug: "other", translated_from: "old" }));
  const env = { ...process.env, WG_CONTENT: content, WG_CONTENT_EN: contentEn, WG_DIST: dist, WG_SITE_URL: "https://lyra.example" };
  execFileSync("node", ["scripts/build.mjs"], { env, stdio: "pipe" });
  const enPage = fs.readFileSync(path.join(dist, "en/a/demo.html"), "utf8");
  assert.match(enPage, /<html lang="en"/);
  assert.match(enPage, /Gemini launches 1000000 3/);
  assert.match(enPage, /href="\.\.\/\.\.\/a\/demo\.html"[^>]*>中文/);
  assert.match(enPage, /hreflang="zh-CN" href="https:\/\/lyra\.example\/a\/demo\.html"/);
  assert.match(enPage, /In one minute/);
  assert.ok(!fs.existsSync(path.join(dist, "en/a/other.html")), "中文稿改过的旧译文不应上线");
  assert.match(fs.readFileSync(path.join(dist, "a/other.html"), "utf8"), /href="\.\.\/en\/index\.html"[^>]*>EN/);
  assert.match(fs.readFileSync(path.join(dist, "a/demo.html"), "utf8"), /href="\.\.\/en\/a\/demo\.html"[^>]*>EN/);
  assert.match(fs.readFileSync(path.join(dist, "en/rss.xml"), "utf8"), /https:\/\/lyra\.example\/en\/a\/demo\.html/);
  assert.match(fs.readFileSync(path.join(dist, "sitemap.xml"), "utf8"), /\/en\/a\/demo\.html/);
  assert.ok(!/\{\{\w+\}\}/.test(enPage), "模板占位符都要替换掉");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("翻译：连字符写法算对，长串数字要改成 trillion / billion", () => {
  assert.deepEqual(checkTranslation([{ id: "s1", text: "后训练 3 万亿参数的模型" }], { s1: "post-training a 3-trillion-parameter model" }), []);
  assert.match(checkTranslation([{ id: "s1", text: "3 万亿参数" }], { s1: "3,000,000,000,000 parameters" })[0].msg, /long digit strings/);
  assert.deepEqual(checkTranslation([{ id: "s1", text: "16,843 美元" }], { s1: "$16,843" }), []);
});

test("翻译：图里写成中文的数值和状态（「数千」「未公布价格」）也要翻", () => {
  const segs = collectSegments({ title: "t", sections: [{ blocks: [{ fig: { type: "columns", items: [{ label: "步数", value: "数千" }, { label: "价格", status: "未公布价格", value: 3 }] } }] }], status: "published" });
  const paths = segs.map(s => s.path.join("."));
  assert.ok(paths.includes("sections.0.blocks.0.fig.items.0.value") && paths.includes("sections.0.blocks.0.fig.items.1.status"), paths.join(" "));
});

test("分享：文章页有分享按钮、X 链接和二维码；开了 WG_OG 每篇用自己的分享图", async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "lj-og-"));
  const content = path.join(tmp, "articles"), dist = path.join(tmp, "dist");
  fs.mkdirSync(content);
  fs.writeFileSync(path.join(content, "demo.json"), JSON.stringify(zh));
  execFileSync("node", ["scripts/build.mjs"], { env: { ...process.env, WG_CONTENT: content, WG_CONTENT_EN: path.join(tmp, "none"), WG_DIST: dist, WG_SITE_URL: "https://lyra.example", WG_OG: "1" }, stdio: "pipe" });
  const page = fs.readFileSync(path.join(dist, "a/demo.html"), "utf8");
  assert.match(page, /og:image" content="https:\/\/lyra\.example\/og\/demo\.png"/);
  assert.match(page, /data-share-open/);
  assert.match(page, /https:\/\/x\.com\/intent\/tweet\?text=Gemini[^"]*&amp;url=https%3A%2F%2Flyra\.example%2Fa%2Fdemo\.html/);
  assert.match(page, /<svg class="qr"/);
  assert.ok(fs.existsSync(path.join(dist, "og/_src/demo.html")));
  assert.match(fs.readFileSync(path.join(dist, "og/_src/demo.html"), "utf8"), /width:1200px;height:630px/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("二维码：版本随网址长度变化，太长会报错", async () => {
  const { qrMatrix } = await import("../scripts/lib/qr.mjs");
  assert.equal(qrMatrix("https://x.co/a").length, 21);
  assert.equal(qrMatrix("https://excaliburx-bot.github.io/Lyra-Jade/en/a/openai-computer-use-healthcare-agents.html").length, 41);
  assert.throws(() => qrMatrix("x".repeat(300)), /太长/);
});

test("翻译：引语卡片的头衔（role）是中文时也要翻", () => {
  const segs = collectSegments({ title: "t", sections: [{ blocks: [{ fig: { type: "quote", text: "Hi.", who: "Greg", role: "OpenAI 总裁", source_url: "https://x" } }] }] });
  assert.ok(segs.some(s => s.path.at(-1) === "role"));
});

test("翻译：长文分批，每批都带全文和已翻好的部分", async () => {
  const { batches, translateUser } = await import("../scripts/lib/translate.mjs");
  const segs = Array.from({ length: 10 }, (_, i) => ({ id: `s${i + 1}`, where: "p", text: "字".repeat(1000) }));
  const bs = batches(segs, 3000);
  assert.deepEqual(bs.map(b => b.length), [3, 3, 3, 1]);
  const u = translateUser({ title: "t" }, segs, "", { only: bs[1], done: { s1: "A" } });
  assert.match(u, /do NOT translate this part/);
  assert.match(u, /Already translated[\s\S]*s1 A/);
  assert.match(u, /\(s4…s6, 3 in total\)/);
  let calls = 0;
  const r = await translateArticle(zh, { mock: (stage, ss, user) => { calls++; return Object.fromEntries(ss.map(s => [s.id, `${s.path[0] === "title" ? "Gemini launches" : "en"} ${numbersZh(s.text).join(" ")}`])); } });
  assert.ok(r.article && calls >= 2);
});
