# 技能：周报

**什么时候跑**：每周日北京时间 20:00。
**目标**：让人用 5 分钟看懂这一周：发了什么、哪里出问题、写作规则该怎么改。
**边界**：只开 Issue，不改任何文件。

## 步骤

1. 同步后运行 `node scripts/bot.mjs weekly > /tmp/weekly.md`，它会填好发布、跳过、数据源、用量几节。
2. 补写最后一节「需要人决定的事」，依据：
   - 本周关闭但没合并的 `draft/*` PR：`gh pr list --state closed --json number,title,headRefName,mergedAt --jq '.[] | select(.headRefName | startswith("draft/")) | select(.mergedAt == null)'`。总结被退回的共同原因。
   - 本周合并的稿子里，人在你初审之后又改了什么：看这些 PR 里非机器人账号的提交。这说明你的初审漏了什么、写作规则哪里不够。
   - 据此提出 1–3 条对 `prompts/writer.md` 的修改建议，写成「现在的规则 → 建议改成 → 原因（举本周的例子）」。只提建议，不改文件。
   - 本周 `skip` 最多的类型，是否应该在打分规则里直接降权。
3. 发 Issue：`gh issue create --title "周报 $(date +%F)" --label 周报 --body-file /tmp/weekly.md`。

## 写法

先写结论（一句话：这周好不好、最需要处理的一件事），再放表。不写套话，不重复表格里已有的数字。
