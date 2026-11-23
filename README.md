# 玲珑玉 Lyra-Jade

AI 资讯解读站：自动从一手来源抓取 → 合并打分 → AI 写稿并配动态解读图 → 自动校验 → 审核 → 发布成静态网站。
日常维护可以交给 Grok Bot（见「机器人账号与仓库保护」和 `AGENTS.md`）。

第一阶段**不需要服务器和数据库**：GitHub 仓库就是内容库，GitHub Actions 负责定时任务，GitHub Pages 负责托管。整个项目零依赖，只要 Node 22。

```
 sources.json（RSS / 列表页）──┐
 x-accounts.json（Grok X 搜索）─┼─► 收件箱 ─► 抓取（每 30 分钟）─► 候选清单
 Grok Bot（浏览器补抓）────────┘                                    │
                                                    写稿（每天 4 次，每次 1 篇，默认 Grok，可换 Claude）
                                                                    │
                                    文章 JSON + 审核报告 ─► 每篇一个 PR
                                                                    │
                                     Grok Bot 初审 ─► 你审核合并（阶段 B 可自动合并）
                                                                    │
                                                         构建 ─► GitHub Pages
```

**两条分支**：`main` 放代码和已发布文章；`data` 放机器写的数据（素材库、候选、原文存档、审核报告、用量）。这样 `main` 可以完全保护起来，机器人和定时任务只往 `data` 写。

## 本地试跑（不联网、不需要 API Key）

```bash
npm run demo        # 用样例订阅和模拟模型把整条流水线跑一遍
npm test            # 28 个测试：解析、合并、打分、X 监测、收件箱、校验、自动合并规则、端到端
npm run dev         # 构建并在 http://localhost:4321 预览
```

本地运行时 `data/` 只是一个被忽略的普通目录。

## 上线步骤

1. **建仓库**：把这个文件夹推到 GitHub 新仓库的 `main` 分支（公开仓库的 Actions 免费）。
2. **允许 Actions 写入**：Settings → Actions → General → Workflow permissions，选 *Read and write permissions*，勾选 *Allow GitHub Actions to create and approve pull requests*。
3. **初始化**：Actions → 初始化 → Run workflow。它会建 `data` 分支和机器人要用的标签。
4. **密钥**（Settings → Secrets and variables → Actions → Secrets）：
   | 名字 | 必填 | 作用 |
   | --- | --- | --- |
   | `XAI_API_KEY` | 是 | Grok 写稿 + X 监测（一个密钥两用） |
   | `DEEPSEEK_API_KEY` | 改用 DeepSeek 写稿时 | 写稿（platform.deepseek.com 申请） |
   | `ANTHROPIC_API_KEY` | 改用 Claude 写稿时 | 写稿 |
   | `WG_BOT_TOKEN` | 建议 | 机器人账号的令牌；用它开的 PR 会自动触发校验 |
   | `WG_MERGE_TOKEN` | 阶段 B 才要 | 你本人的令牌，用于自动合并 |
5. **变量**（同一页的 Variables；`WG_` 是项目早期代号的缩写，变量名保持不变）：
   | 名字 | 默认 | 作用 |
   | --- | --- | --- |
   | `WG_SITE_URL` | 无，必填 | 网站地址，如 `https://<用户名>.github.io/<仓库名>` |
   | `WG_DRAFT_TOP` | `1` | 每次定时写稿写几篇；每天 4 次，默认即每天最多 4 篇 |
   | `WG_REVIEWER` | 仓库主人 | 新稿子自动请谁审核（GitHub 会发邮件和手机推送），多人用逗号分隔 |
   | `WG_PROVIDER` | `xai` | 写稿用哪家：`xai`（Grok）、`deepseek` 或 `anthropic`（Claude）；手动运行「写稿」时也可以临时选 |
   | `WG_MODEL` | `grok-4.7` / `deepseek-v4-pro` / `claude-sonnet-5-5` | 写稿模型；DeepSeek 更便宜的是 `deepseek-flash` |
   | `WG_X_MODEL` | `grok-4.7` | X 监测用的模型 |
   | `WG_REASONING` | `medium` | Grok 写稿的推理强度：`low` / `medium` / `high` / `xhigh`，越高越慢越贵 |
   | `WG_AUTOMERGE` | 关 | 设为 `on` 进入阶段 B 自动合并 |
   | `WG_AUTOMERGE_CATEGORIES` | `product` | 允许自动合并的栏目，逗号分隔 |
6. **开启 Pages**：Settings → Pages → Source 选 *GitHub Actions*。
7. 依次手动运行「X 监测」（如果配了 xAI）、「抓取」、「写稿」，就会看到第一批 PR。

## 日常怎么用

- **看候选**：`data` 分支的 `candidates.md`，或运行 `node scripts/bot.mjs status`。
- **指定写某一篇**：Actions → 写稿 → Run workflow，填候选 ID。
- **不想写某一篇**：`node scripts/bot.mjs skip <ID> --reason "…"`，再 `bash scripts/ci/commit-data.sh "跳过"`。
- **审核一篇稿子**：打开 PR，先看描述里的「必须修改」，再看机器人的初审评论。核对完确认 `"verified": true`，合并即发布；不要的稿子直接关闭。
- **加 / 修数据源**：编辑 `sources/sources.json`（RSS 写 `rss`；没有 RSS 的写 `page` 加 `pattern`）。先用 `node scripts/bot.mjs source-test --url … --type page --pattern …` 试抓。
- **选题入口（小互）**：`sources.json` 里的 `xiaohu` 源只当线索：每篇只打开一次文章页取「查看主材料」链接，回到一手原文写；不用对方的标题、简介和正文。找不到一手原文的直接跳过，不改写对方的稿子。同样的方式可以接别的解读站：加 `"resolveOriginal": true`。
- **X 监测名单**：`sources/x-accounts.json`，每组最多 20 个账号；KOL 两组默认关着。X 搜索按抓取的帖子数收费，用量记在 `data` 分支的 `usage.json`；目前每天只跑 2 次（北京时间 7:47、17:47），选题主要靠免费的小互入口。
- **换写稿模型**：默认 Grok。改用 DeepSeek：加 `DEEPSEEK_API_KEY`，把变量 `WG_PROVIDER` 设为 `deepseek`；想先试一篇，手动运行「写稿」时在 provider 里选 deepseek 即可。定时写稿已避开 DeepSeek 的工作日高峰（UTC 01–04、06–10 点），按半价计费。
- **导出单页**：`npm run build && node scripts/export.mjs <slug> 文件名.html`，把一篇文章导出成一个独立的 HTML 文件（样式、脚本、动态图都内嵌），双击就能打开，适合发给别人看。
- **调写作规则**：`prompts/writer.md`。**改页面样式**：`site/assets/site.css`，图形组件在 `site/assets/components.js`。

## 机器人账号与仓库保护

目标：Grok Bot 能做日常维护，但无论如何改不了主分支、合并不了 PR、动不了工作流和密钥。

1. **建一个机器人 GitHub 账号**（例如 `lyra-jade-bot`），在仓库 Settings → Collaborators 里邀请它。
2. 机器人账号创建一个 **classic 令牌，只勾 `repo`**，不要勾 `workflow`。不勾 `workflow`，它就改不了 `.github/workflows/`，也就没法写新工作流去读密钥。（细粒度令牌一般用不了别人名下的个人仓库，所以这里用 classic。）把令牌交给 Grok Bot，同时存成本仓库的密钥 `WG_BOT_TOKEN`。
3. 把 `.github/CODEOWNERS.example` 改名为 `CODEOWNERS`，填上你的用户名。
4. Settings → Rules → Rulesets → New branch ruleset，目标选默认分支（`main`）：
   - 勾选 *Require a pull request before merging*，批准数 1，勾选 *Require review from Code Owners*；
   - 勾选 *Require status checks to pass*，加上 `validate`；
   - 勾选 *Block force pushes*；
   - Bypass list 加 *Repository admin*，方式选 *For pull requests only*。
   这样机器人（不是代码负责人）合并不了任何 PR；你作为管理员照常合并。
5. 再建一条规则保护 `data` 分支：只勾 *Restrict deletions* 和 *Block force pushes*（允许正常推送）。
6. 按 `bot/README.md` 在 Grok Bot 里建 Bot、技能和定时任务。

**阶段 B（部分自动合并）**：机器人初审连续两周可靠后，在设置里创建你本人的细粒度令牌（只授权本仓库，Contents 和 Pull requests 可读写），存成 `WG_MERGE_TOKEN`，再把变量 `WG_AUTOMERGE` 设为 `on`。之后机器人打上 `bot-reviewed` 标签的新稿，满足全部条件才会自动合并：draft 分支、只新增一篇文章、校验 0 个必须修改、已核对、主材料是官方来源、栏目在允许范围内、所有事实都有原文存档。不满足的照常等你。条件写在 `scripts/ci/automerge-check.mjs`，有测试。

## 目录

| 路径 | 作用 |
| --- | --- |
| `AGENTS.md` | 机器人工作守则：能做什么、不能做什么、何时停下来问人 |
| `bot/` | Grok Bot 的 4 个技能和配置说明 |
| `sources/sources.json` · `sources/x-accounts.json` | RSS / 列表页数据源 · X 监测名单 |
| `scripts/fetch.mjs` | 抓取、并入收件箱、去重、按事件合并、打分 |
| `scripts/x-watch.mjs` | X 监测（Grok X 搜索），只收真实引用过的帖子 |
| `scripts/draft.mjs` | 回溯并存档原文、调用模型写稿、校验、写审核报告 |
| `scripts/validate.mjs` | 校验文章：每个数字回查原文、图形字段完整、夸张词提醒 |
| `scripts/build.mjs` | 生成首页、文章页、RSS |
| `scripts/bot.mjs` | 机器人工具：状态、收件箱、试抓源、跳过候选、周报 |
| `scripts/open-prs.sh` | 每篇新稿开一个 PR |
| `scripts/ci/` | data 分支的检出与提交、自动合并检查 |
| `schema/article.schema.json` | 文章的数据结构（模型按它输出） |
| `content/articles/` | 已发布的文章（JSON） |
| `site/` | 页面模板、样式、图形组件 |

## 八种解读图

文章正文里 `{"fig": {...}}` 一块就是一张图，字段要求见 `prompts/writer.md`：

`kpi` 关键数字 · `timeline` 时间线 / 甘特 · `capacity` 容量刻度 · `route` 分支路线 · `steps` 步骤 · `pipeline` 流程 · `beforeafter` 前后对比滑块 · `bars` 分组条形

示意性质的图（timeline、route、pipeline、steps）副标题里要写「示意」，校验会检查。
