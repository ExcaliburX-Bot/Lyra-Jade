/* 读取文章事实清单引用到的原文存档（data/sources/<sha>.txt） */
import fs from "node:fs";
import { dataFile } from "./store.mjs";
import { sha } from "./text.mjs";

export function loadSourceTexts(article) {
  const texts = {};
  for (const c of article?.claims || []) {
    if (!c.source_url || texts[c.source_url]) continue;
    const f = dataFile(`sources/${sha(c.source_url)}.txt`);
    if (fs.existsSync(f)) texts[c.source_url] = fs.readFileSync(f, "utf8");
  }
  return texts;
}
