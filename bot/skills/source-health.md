# 技能：数据源体检

**什么时候跑**：每周一北京时间 10:00。
**目标**：坏了的源修好或停用；从数据源总表里挑新源接入；确认 X 账号名单没有写错。
**边界**：只改 `sources/sources.json`、`sources/x-accounts.json`，在 `bot/sources-<日期>` 分支上改并开 PR，不自己合并。每周最多新增 3 个源。

## 步骤

1. 同步后运行 `node scripts/bot.mjs status`，看「需要处理的源」。
2. **修坏的源**，逐个：
   - `node scripts/bot.mjs source-test --id <源ID>`，看报错。
   - 用浏览器打开该网站，找新的 RSS 或列表页地址；网站改版的，重新确定文章链接的路径规则 `pattern`。
   - 用 `source-test --url … --type … --pattern …` 试到能解析出最近的文章为止。
   - 修好了：改 `sources.json` 里的 `url` / `type` / `pattern`。
   - 网站确实不再更新或已关闭：改 `"enabled": false`，`note` 写明原因和日期。
3. **加新源**（可选，最多 3 个）：从数据源总表 https://claude.ai/artifact/3P3qCuMxotEbdwumwnfpPr 里挑「已核实」「一手官方 / 一手原始材料」、但还不在 `sources.json` 里的条目；`source-test` 能解析出文章才加。层级照总表填，不要升级。
4. **核对 X 账号**：`x-accounts.json` 里 `unverified` 列出的账号，用浏览器打开 `https://x.com/<账号>`，确认是官方账号（看认证标识、简介、官网链接）。确认了就从 `unverified` 里删掉；账号不存在或不是官方，从 `handles` 里删掉，在 PR 里说明。
5. 开 PR：
   ```bash
   git switch -c bot/sources-$(date +%Y%m%d) main
   git add sources/ && git commit -m "bot: 数据源体检 $(date +%F)"
   git push -u origin HEAD
   gh pr create --title "源：每周体检 $(date +%F)" --body-file /tmp/sources-pr.md
   ```
   正文列出每个改动：哪个源、改了什么、`source-test` 的输出前 3 行。

## 何时停下

同一个源连续 3 天失败且找不到新地址，或者某个重要厂商（OpenAI、Anthropic、Google、Meta、DeepSeek、Qwen）的源坏了：开 Issue「需要人决定」，同时可以先在收件箱手动补上它这几天的发布。
