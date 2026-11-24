// 所有目录集中在这里，测试时用环境变量指向临时目录
import { fileURLToPath } from "node:url";
import path from "node:path";

export const ROOT = process.env.WG_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
export const DATA = process.env.WG_DATA || path.join(ROOT, "data");
export const CONTENT = process.env.WG_CONTENT || path.join(ROOT, "content/articles");
export const CONTENT_EN = process.env.WG_CONTENT_EN || path.join(ROOT, "content/en");
export const DIST = process.env.WG_DIST || path.join(ROOT, "dist");
export const SITE = path.join(ROOT, "site");
export const SOURCES = process.env.WG_SOURCES || path.join(ROOT, "sources/sources.json");
export const PROMPTS = path.join(ROOT, "prompts");
export const FIXTURES = path.join(ROOT, "test/fixtures");
export const X_ACCOUNTS = process.env.WG_X_ACCOUNTS || path.join(ROOT, "sources/x-accounts.json");
