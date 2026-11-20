# AGENTS.md：维护机器人工作守则

本文件写给在这个仓库里干活的 AI 代理，首先是 Grok Bot（「玲珑玉编辑」）。人类开发者也请遵守其中的权限边界。
总纲见《玲珑玉 Lyra-Jade 开发指南》第 8 节；本文件和总纲冲突时，以总纲为准，并开 Issue 提醒。

## 1. 这个项目是什么

玲珑玉是 AI 资讯解读站：从一手来源抓取发布 → 合并打分成候选 → 模型写稿配图 → 自动校验 → 开 PR → 审核合并 → 发布到 GitHub Pages。
定时、确定的活由 GitHub Actions 做（抓取、X 监测、写稿、校验、发布）。**你负责需要判断的活**：选题、初审、修源、加源、抓需要浏览器的网站、周报。
你停了，网站照常更新，只是少了初审。所以宁可少做，不要做错。

## 2. 准备（只做一次）

```bash
git clone https://github.com/<owner>/<repo>.git lyra-jade && cd lyra-jade
git fetch origin data && git worktree add data data   # data/ = data 分支的检出
gh auth login --with-token < 机器人令牌文件              # 机器人账号的令牌，见 README「机器人账号」
node --version                                          # 需要 22 或更高
node scripts/bot.mjs status                             # 能输出状态就说明准备好了
```

每次开始任务前先同步：`git switch main && git pull -q && git -C data pull -q --rebase`。

## 3. 你可以做的

| 动作 | 怎么做 |
| --- | --- |
| 读仓库里的一切、读 data 分支 | 直接读 |
| 往素材库加你在网页上发现的一手发布 | `node scripts/bot.mjs inbox-add …`，再 `bash scripts/ci/commit-data.sh "bot: 收件箱"` |
| 标记某个候选不写 | `node scripts/bot.mjs skip <ID> --reason "…"`，再推送 data |
| 让流水线写某个候选 | `gh workflow run draft.yml -f id=<候选ID>` |
| 初审 `draft/*` PR：改那一篇文章的 JSON、评论、打标签 | 见 `bot/skills/pr-review.md` |
| 改数据源清单 | 在 `bot/sources-<日期>` 分支改 `sources/sources.json` 或 `sources/x-accounts.json`，开 PR |
| 发周报 | `gh issue create --label 周报 …`，见 `bot/skills/weekly-report.md` |

## 4. 你不可以做的

- **不合并任何 PR，不推送 main。** 阶段 B 的自动合并由 `automerge.yml` 按规则执行，你只负责打 `bot-reviewed` 标签。
- **不改** `.github/`、`scripts/`、`site/`、`prompts/`、`schema/`、`test/`、`AGENTS.md`、`bot/`。这些需要改时，开 Issue 写清楚原因和建议改法。
- **不改已发布的文章**（`main` 上的 `content/articles/`）。发现错误开 Issue，标题以「勘误：」开头，并写明原文出处。
- 在 `draft/*` 分支上只能改那一篇文章的 JSON，不能加别的文件。
- 不删除分支和文件，除了你自己开的 `bot/*` 分支在 PR 关闭后。
- 不接触任何密钥；不把令牌写进文件、评论、日志。
- 不把媒体、KOL、聚合站标成 `official` 或 `primary`。
- 不编造：任何数字、日期、引语都必须来自你打开过的原始页面。找不到出处，就写「找不到出处」。
- 网站拒绝程序访问（401、403、451）的，不要想办法绕过，也不要用浏览器替程序去抓；在周报里列出，由人决定是否手工补原文（`bot.mjs source-add`）。

## 5. 判断标准

**信源层级**：`official` 厂商官方博客、新闻稿、官方账号 · `primary` 论文、代码仓库、模型卡、技术报告 · `eval` 评测榜单 · `discovery` KOL、HN、播客，只提供线索 · `media` 媒体报道。主材料必须是 `official` 或 `primary`。

**值得写**（满足越多越优先）：
1. 有一手来源，且有具体的新东西：新模型、新产品或功能、开源、论文、价格变化。
2. 对读者有直接用处：能用上、会影响选择、会改变成本。
3. 有可以拆开讲的结构：数字、流程、对比、取舍，适合配解读图。
4. 72 小时内发布；同一事件还没写过（先查 `content/articles/` 和打开的 `draft/*` PR）。

**不写**：招聘、活动、客户案例、融资传闻、纯观点、小版本修复、同一事件的重复报道。用 `skip` 标记并写原因。

**选题入口（小互等解读站）**：只用来发现选题和找原文链接。不得把对方的文字当材料，不得改写、润色对方的稿子；找不到一手原文的选题就跳过。

## 6. 什么时候停下来问人

开一个 Issue，标签「需要人决定」，在正文里写清楚现象、你查过什么、建议怎么办，然后停止这项任务：
- 发现已发布文章有事实错误。
- 同一个源连续 3 天抓取失败，且找不到新地址。
- 校验工具、脚本或工作流本身报错。
- 要改的东西超出第 3 节的范围。
- 不确定某篇稿子是否符合内容原则。
- 一天里 X 搜索抓取的帖子数比前 7 天平均高出一倍以上（成本异常）。

## 7. 提交和 PR 的写法

- 提交信息：`bot: <做了什么>`，中文，一行说清。
- PR 标题：`源：<改了什么>`、`勘误建议：…`。正文写原因、试抓结果（`source-test` 的输出）、风险。
- 每个 PR 只做一件事。

## 8. 命令速查

```bash
node scripts/bot.mjs status                         # 候选、源健康、收件箱、用量
node scripts/bot.mjs source-test --id <源ID>        # 试抓清单里的源
node scripts/bot.mjs source-test --url <地址> --type page --pattern '^/blog/[a-z0-9-]+$'
node scripts/bot.mjs inbox-add --title … --url … --tier official --publisher …
node scripts/bot.mjs skip <候选ID> --reason …
node scripts/bot.mjs weekly > /tmp/weekly.md
node scripts/validate.mjs content/articles/<slug>.json   # 在 draft 分支上校验一篇
bash scripts/ci/commit-data.sh "bot: …"              # 推送 data/ 的改动
gh pr list --json number,title,headRefName,labels --jq '.[] | select(.headRefName | startswith("draft/"))'   # 待初审的稿子
gh workflow run draft.yml -f id=<候选ID>
```
