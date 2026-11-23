#!/usr/bin/env bash
# 把 draft.mjs 新写的稿子各开一个合并请求（PR），审核报告放在 PR 描述里。
# 在 GitHub Actions 里运行；需要 gh（Actions 自带）和 GH_TOKEN；data/ 必须是 data 分支的检出。
set -euo pipefail

LIST=data/new-drafts.json
[ -s "$LIST" ] || { echo "没有新稿"; exit 0; }
COUNT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).length)' "$LIST")
[ "$COUNT" -gt 0 ] || { echo "没有新稿"; exit 0; }

git config user.name  "lyra-jade-bot"
git config user.email "lyra-jade-bot@users.noreply.github.com"
BASE=$(git rev-parse --abbrev-ref HEAD)

# 1) 已写过的候选、原文存档、审核报告提交到 data 分支（这些是数据，不进主分支）
bash scripts/ci/commit-data.sh "data: 记录 $COUNT 篇新稿的原文存档与审核报告"

# 2) 每篇稿子一个分支、一个 PR
node -e '
  const a = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"));
  for (const d of a) console.log([d.slug, d.file, d.errors, d.warnings, `${d.provider || "?"} / ${d.model || "?"}`, d.title].join("\t"));
' "$LIST" | while IFS=$'\t' read -r SLUG FILE ERRORS WARNINGS MODEL TITLE; do
  if [ ! -f "$FILE" ]; then echo "::warning::新稿列表里有 $FILE，但文件不存在，跳过"; continue; fi
  BR="draft/$SLUG"
  # 重写同一篇（比如按新规则重写）时，旧分支还在：换一个带时间的新分支，旧 PR 由人关闭
  if git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then
    BR="draft/$SLUG-$(date -u +%m%d%H%M)"
    echo "分支 draft/$SLUG 已存在（之前写过一版），新稿开在 $BR"
  fi
  git switch -c "$BR" "$BASE"
  git add "$FILE"
  git commit -m "draft: $TITLE（$MODEL）"
  git push -u origin "$BR"

  LABEL="待审核"; [ "$ERRORS" -gt 0 ] && LABEL="需修改"
  {
    echo "> 自动生成的稿子。写稿模型：**$MODEL**。合并即发布；关闭即放弃。"
    echo "> 必须修改 **$ERRORS** 处，请人工确认 **$WARNINGS** 处。改完把文章里的 \`\"verified\": false\` 改成 \`true\`，页面才会显示「已核对」。"
    echo
    cat "data/reports/$SLUG.md"
  } > /tmp/pr-body.md

  gh label create "$LABEL" --force >/dev/null 2>&1 || true
  PR_URL=$(gh pr create --base "$BASE" --head "$BR" --title "稿件：$TITLE" --body-file /tmp/pr-body.md --label "$LABEL" \
    || gh pr create --base "$BASE" --head "$BR" --title "稿件：$TITLE" --body-file /tmp/pr-body.md)
  echo "$PR_URL"
  NUM="${PR_URL##*/}"
  REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"
  # 标签和审核人用 REST 接口加：gh pr edit 走 GraphQL，用机器人的 classic 令牌会失败
  # 0 个必须修改的稿子打上 auto-publish。仓库变量 WG_AUTOMERGE=direct 时，「自动合并」工作流检查后直接合并发布；
  # 没开时这个标签只是「校验通过」的标记。要用机器人令牌（WG_BOT_TOKEN）开 PR 才会触发，GITHUB_TOKEN 打的标签不触发工作流。
  # （不在 draft.yml 里读变量：改带定时的工作流文件会让定时任务失效，见开发指南第 7 节）
  if [ "$ERRORS" -eq 0 ]; then
    gh label create auto-publish --color 0E8A16 --description "校验通过，自动上线" --force >/dev/null 2>&1 || true
    gh api "repos/$REPO/issues/$NUM/labels" -f "labels[]=auto-publish" >/dev/null || echo "::warning::没能打上 auto-publish 标签，这篇需要人工合并"
  fi
  # 点名请人审核：GitHub 一定会发邮件和手机推送。默认是仓库主人，可用变量 WG_REVIEWER 改成别人（逗号分隔）
  REVIEWER="${WG_REVIEWER:-${GITHUB_REPOSITORY_OWNER:-}}"
  if [ -n "$REVIEWER" ]; then
    ARGS=(); IFS=',' read -ra RS <<< "$REVIEWER"; for r in "${RS[@]}"; do ARGS+=(-f "reviewers[]=${r// /}"); done
    gh api "repos/$REPO/pulls/$NUM/requested_reviewers" "${ARGS[@]}" >/dev/null || echo "::warning::没能请 $REVIEWER 审核（不影响稿子）"
  fi
  git switch "$BASE"
done
