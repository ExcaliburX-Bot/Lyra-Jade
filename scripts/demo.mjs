#!/usr/bin/env node
/* 不联网、不需要 API Key，在临时目录里把整条流水线跑一遍：
   X 监测（样例）→ 抓取（样例订阅）→ 合并打分 → 写稿（模拟模型）→ 校验 → 构建
   产物在 .tmp/demo/，可用 WG_DIST=.tmp/demo/dist node scripts/serve.mjs 预览 */
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { ROOT, CONTENT, FIXTURES } from "./lib/paths.mjs";

const out = path.join(ROOT, ".tmp/demo");
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, "content"), { recursive: true });
for (const f of fs.readdirSync(CONTENT)) fs.copyFileSync(path.join(CONTENT, f), path.join(out, "content", f));

const env = { ...process.env, WG_DATA: path.join(out, "data"), WG_CONTENT: path.join(out, "content"), WG_DIST: path.join(out, "dist"), WG_SOURCES: path.join(FIXTURES, "sources.test.json"), WG_X_ACCOUNTS: path.join(FIXTURES, "x-accounts.test.json") };
const step = (title, ...a) => {
  console.log(`\n━━ ${title}`);
  try { process.stdout.write(execFileSync(process.execPath, a, { cwd: ROOT, env, encoding: "utf8" })); }
  catch (e) { process.stdout.write(e.stdout || ""); console.log(`（退出码 ${e.status}，这一步是预期内的失败）`); }
};
step("1. X 监测（模拟 Grok X 搜索：故意混了一条编造的帖子和一条别人的帖子）", "scripts/x-watch.mjs", "--mock");
step("2. 抓取样例订阅，并入收件箱", "scripts/fetch.mjs", "--fixtures");
step("3. 机器人看状态", "scripts/bot.mjs", "status");
step("4. 写稿（模拟模型）", "scripts/draft.mjs", "--top", "1", "--mock", "--min-score", "0");
step("5. 校验：样例稿里故意放了一个没有出处的数字", "scripts/validate.mjs");
step("6. 构建", "scripts/build.mjs");
console.log(`\n候选清单：${path.relative(ROOT, path.join(out, "data/candidates.md"))}`);
console.log(`审核报告：${path.relative(ROOT, path.join(out, "data/reports"))}/`);
console.log(`预览：WG_DIST=${path.relative(ROOT, env.WG_DIST)} node scripts/serve.mjs`);
