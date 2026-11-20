# 技能：稿件初审

**什么时候跑**：每 2 小时一次；或者在「写稿」工作流跑完后手动触发。
**目标**：每篇自动写出的稿子，在人看之前先被对照原文核对一遍；能改的直接改，改不了的写清楚。
**边界**：只在 `draft/<slug>` 分支上改 `content/articles/<slug>.json` 这一个文件；不合并、不关闭 PR。

## 找到要审的 PR

```bash
gh pr list --json number,title,headRefName,labels \
  --jq '.[] | select(.headRefName | startswith("draft/")) | select([.labels[].name] | index("bot-reviewed") or index("bot-needs-human") | not) | "\(.number)\t\(.headRefName)\t\(.title)"'
```

## 每篇的步骤

1. `gh pr checkout <编号>`，`git -C data pull -q --rebase`。
2. 读 PR 描述里的自动校验报告：先处理「必须修改」，再看「请人工确认」。
3. 打开主材料原文（文章 `sources.main.url`），同时打开 data 分支里的存档 `data/sources/`，逐条核对：
   - [ ] `claims` 里每个数字都能在原文找到，单位和口径一致（例如「最高」「起」「约」没有丢）。
   - [ ] 正文里的数字都在 `claims` 里；没有原文支持的句子删掉。
   - [ ] 标题和导语没有夸大；厂商自称的数字写了「官方称」。
   - [ ] 重要限制条件写了：地区、价格档位、需要什么硬件、是否预览版。
   - [ ] 示意图的副标题有「示意」；图里的数字和正文一致。
   - [ ] 栏目 `category` 选对了。
4. 能改的直接改这个 JSON。改完运行 `node scripts/validate.mjs content/articles/<slug>.json`，必须 0 个「必须修改」。
5. 全部核对通过：把 `"verified": false` 改成 `true`，提交 `bot: 初审 <slug>`，推送到这个 PR 分支。
6. 在 PR 里留一条评论（模板见下），然后打标签：
   - 全部通过 → `gh pr edit <编号> --add-label bot-reviewed --remove-label 需修改`
   - 有你解决不了的问题 → `gh pr edit <编号> --add-label bot-needs-human`，评论里写清楚是什么问题

## 评论模板

```
初审结果：通过 / 需要人看
- 核对了 N 条事实，改了 M 处：<逐条列出改了什么、依据原文哪句话>
- 删掉了：<没有出处的句子>
- 需要人决定：<没有就写「无」>
主材料：<链接>
```

## 不要做

- 不要为了通过校验去改 `claims` 的数值去迁就正文；应该改正文去符合原文。
- 不要补充原文里没有的背景知识，哪怕你确定它是对的。
- 稿子整体方向不对（选题错了、主材料不是一手）：打 `bot-needs-human`，评论建议关闭，不要大改。
