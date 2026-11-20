# 技能：每日选题

**什么时候跑**：每天 2 次，北京时间 9:40 和 15:40（在「抓取」之后、下一次定时写稿之前）。
**目标**：让流水线写对的稿子，而不是只写分数高的稿子；补上脚本抓不到的网站。
**边界**：只动 data 分支（收件箱、跳过清单）和触发「写稿」工作流；不改文章和代码。每次最多指定写 3 篇。

## 步骤

1. 同步：`git switch main && git pull -q && git -C data pull -q --rebase`。
2. 看状态：`node scripts/bot.mjs status`。
3. **补抓浏览器才能看的站**。用浏览器打开下面几个列表页，找最近 48 小时的新发布：
   - Qwen 博客 https://qwen.ai/blog
   - MiniMax 新闻 https://www.minimax.io/news
   - 字节 Seed 博客 https://research.doubao.com/blog
   - 腾讯混元 HY https://hy.tencent.ai

   对每条新发布，打开文章页确认是官方原文，再运行：
   `node scripts/bot.mjs inbox-add --title "<原标题>" --url "<文章链接>" --tier official --publisher "<厂商>" --published "<文章上的发布时间>" --source bot:browser --category product`
   不确定发布时间就不填 `--published`。
4. **逐个看待写候选**（status 里的前 12 个），按 AGENTS.md 第 5 节判断：
   - 先查重：`ls content/articles/`，以及打开的 `draft/*` PR 里有没有同一件事。
   - 打开候选链接，确认是一手来源、内容属实、确有新东西。
   - 不该写的：`node scripts/bot.mjs skip <ID> --reason "<一句话原因>"`。
   - 该写但分数靠后、可能轮不到的：`gh workflow run draft.yml -f id=<ID>`（每次最多 3 个）。
5. 推送 data：`bash scripts/ci/commit-data.sh "bot: 每日选题"`。

## 输出

在对话里给出一张表：候选 · 决定（写 / 跳过 / 交给定时任务）· 一句话理由；再列出这次放进收件箱的条目。

## 何时停下

候选里有你判断不了是否属实的重大消息（例如只有一条传闻帖），或某个列表页打不开且没有替代地址：按 AGENTS.md 第 6 节开 Issue。
