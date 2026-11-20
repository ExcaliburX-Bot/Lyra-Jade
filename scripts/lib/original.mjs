/* 发现渠道（如小互）→ 一手原文：从它的文章页里找出「主材料」链接，并判断这个链接属于哪一层。
   只取链接，不取对方的文字。 */
import { decodeEntities, htmlToText } from "./text.mjs";

const MAIN_LABELS = /查看主材料|阅读原文|主材料|原文地址|原文链接|官方原文|Source|Original/i;
const PRIMARY_HOSTS = /(^|\.)(arxiv\.org|github\.com|huggingface\.co|openreview\.net|aclanthology\.org|paperswithcode\.com)$/;
const MEDIA_HOSTS = /(^|\.)(tweaktown\.com|techradar\.com|tomshardware\.com|theverge\.com|techcrunch\.com|venturebeat\.com|wired\.com|arstechnica\.com|engadget\.com|zdnet\.com|cnbc\.com|bloomberg\.com|reuters\.com|theinformation\.com|36kr\.com|qbitai\.com|jiqizhixin\.com|ifanr\.com|sohu\.com|163\.com|qq\.com|youtube\.com|youtu\.be|bilibili\.com|medium\.com|substack\.com)$/;

/* 链接属于哪一层：论文、代码、模型页是 primary；科技媒体是 media（不能当主材料）；其余按厂商官方算 official */
export function tierOfUrl(url) {
  let h; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch { return null; }
  if (PRIMARY_HOSTS.test(h)) return "primary";
  if (MEDIA_HOSTS.test(h)) return "media";
  return "official";
}

/* 返回 { url, tier } 或 null。优先「查看主材料 / 阅读原文」这类标注的链接；不取本站链接、页脚链接、媒体链接 */
export function extractOriginal(html, pageUrl) {
  let self; try { self = new URL(pageUrl).hostname.replace(/^www\./, "").split(".").slice(-2).join("."); } catch { return null; }
  const links = [];
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)) {
    let u; try { u = new URL(decodeEntities(m[1]), pageUrl); } catch { continue; }
    if (!/^https?:$/.test(u.protocol)) continue;
    const host = u.hostname.replace(/^www\./, "");
    if (host === self || host.endsWith("." + self)) continue;
    links.push({ url: u.href, label: htmlToText(m[2]).replace(/\s+/g, " ").trim() });
  }
  const labelled = links.find(l => MAIN_LABELS.test(l.label) && tierOfUrl(l.url) !== "media");
  if (labelled) return { url: labelled.url, tier: tierOfUrl(labelled.url) };
  return null;   /* 没有明确标注的主材料就不猜：宁可只当线索，也不把页脚或媒体链接当原文 */
}

/* 用原文链接的域名给发布方起个名字 */
const NAMES = { "openai.com": "OpenAI", "anthropic.com": "Anthropic", "deepmind.google": "Google DeepMind", "blog.google": "Google", "ai.google.dev": "Google", "blogs.nvidia.com": "NVIDIA", "nvidia.com": "NVIDIA", "developer.nvidia.com": "NVIDIA", "mistral.ai": "Mistral AI", "x.ai": "xAI", "ai.meta.com": "Meta", "research.meta.ai": "Meta", "microsoft.ai": "Microsoft AI", "microsoft.com": "Microsoft", "huggingface.co": "Hugging Face", "github.com": "GitHub", "arxiv.org": "arXiv", "qwen.ai": "Qwen", "deepseek.com": "DeepSeek", "kimi.ai": "Moonshot AI", "minimax.io": "MiniMax", "z.ai": "Z.ai", "x.com": "X" };
export function publisherOf(url) {
  const xm = String(url).match(/^https?:\/\/(?:www\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]+)\/status\//);
  if (xm) return `@${xm[1]}`;
  let h; try { h = new URL(url).hostname.replace(/^www\./, ""); } catch { return "未知"; }
  return NAMES[h] || NAMES[h.split(".").slice(-2).join(".")] || h;
}
