import { test } from "node:test";
import assert from "node:assert/strict";
import { coverSpec, coverHtml } from "../scripts/lib/cover.mjs";
import { validateArticle } from "../scripts/lib/validate.mjs";

const base = { slug: "x-test", publisher: "OpenAI", title: "某公司发布新模型：速度快一倍", sections: [] };

test("封面：有柱状图时用真实数值画小柱图，不带标签", () => {
  const a = { ...base, sections: [{ blocks: [{ fig: { type: "columns", items: [{ label: "A", value: 84.5 }, { label: "B", value: 70 }] } }] }] };
  const c = coverSpec(a);
  assert.equal(c.layout, "split");
  assert.equal(c.glyph.kind, "minibars");
  assert.ok(coverHtml(a).html.includes("84.5"));
  assert.ok(!coverHtml(a).html.includes(">A<"));
});

test("封面：「A 与 B 合作」画成合作关系", () => {
  const c = coverSpec({ ...base, title: "OpenAI 与智利政府合作：帮公务员学 AI" });
  assert.equal(c.glyph.kind, "hub");
  assert.equal(c.glyph.center.label, "OpenAI");
  assert.equal(c.glyph.nodes[0].label, "智利政府");
});

test("封面：没有图就用标题里的数字，再没有就纯排版", () => {
  assert.equal(coverSpec(base).layout, "type");
  const c = coverSpec({ ...base, title: "某公司发布新模型：价格降 80%" });
  assert.equal(c.layout, "number");
  assert.equal(c.big.value, "80");
});

test("封面：同一家公司的几篇颜色不全一样", () => {
  const hues = new Set(["a1", "b2", "c3", "d4", "e5", "f6"].map(s => coverSpec({ ...base, slug: s }).hue));
  assert.ok(hues.size >= 3);
});

test("封面：cover 字段优先，大数字必须在事实清单里", () => {
  const a = { ...base, cover: { headline: "大字", highlight: "结论", big: { value: "42", unit: "%" } } };
  assert.equal(coverSpec(a).head, "大字");
  assert.equal(coverSpec(a).layout, "number");
  const r = validateArticle({ ...a, claims: [{ text: "t", value: "13%" }] });
  assert.ok(r.errors.some(e => e.includes("封面大数字")));
  const r2 = validateArticle({ ...a, cover: { glyph: { kind: "nope" } }, claims: [{ text: "t", value: "13%" }] });
  assert.ok(r2.errors.some(e => e.includes("不认识的示意零件")));
});
