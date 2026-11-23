# 给 Grok Bot 的配置

在 Grok Bot 里建一个 Bot，名字「玲珑玉编辑」，角色说明直接用仓库根目录的 `AGENTS.md`。
然后把下面 5 个技能各存成一个 Skill，并按表格建 Routine（定时任务）：

| 技能文件 | Routine 时间（北京时间） | 需要批准的动作 |
| --- | --- | --- |
| `skills/x-watch.md` X 监测 | 每天 7:30、17:30 | 无（只动 data 分支和触发写稿） |
| `skills/daily-picks.md` 每日选题 | 每天 9:40、15:40 | 无（只动 data 分支和触发写稿） |
| `skills/pr-review.md` 稿件初审 | 每 2 小时 | 无（只改 draft 分支上的那篇稿子） |
| `skills/source-health.md` 源体检 | 每周一 10:00 | 无（只开 PR，由你合并） |
| `skills/weekly-report.md` 周报 | 每周日 20:00 | 无（只开 Issue） |

在 Grok Bot 的审批设置里，把「合并、删除、改设置、发布」设为需要你批准。即使它误操作，仓库规则也会拦住它：机器人账号不能推送 main，也不能合并 PR（见 README「机器人账号与仓库保护」）。

技能里的命令都在仓库里测试过（`npm test`），但 Grok Bot 本身是早期测试版：头两周请每天看一眼它的评论和 PR，确认它在按守则做事。
