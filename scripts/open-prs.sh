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
  for (const d of a) console.log([d.slug, d.file, d.errors, d.warnings, d.title].join("\t"));
' "$LIST" | while IFS=$'\t' read -r SLUG FILE ERRORS WARNINGS TITLE; do
  BR="draft/$SLUG"
  # 重写同一篇（比如按新规则重写）时，旧分支还在：换一个带时间的新分支，旧 PR 由人关闭
  if git ls-remote --exit-code --heads origin "$BR" >/dev/null 2>&1; then
    BR="draft/$SLUG-$(date -u +%m%d%H%M)"
    echo "分支 draft/$SLUG 已存在（之前写过一版），新稿开在 $BR"
  fi
  git switch -c "$BR" "$BASE"
  git add "$FILE"
  git commit -m "draft: $TITLE"
  git push -u origin "$BR"

  LABEL="待审核"; [ "$ERRORS" -gt 0 ] && LABEL="需修改"
  {
    echo "> 自动生成的稿子。合并即发布；关闭即放弃。"
    echo "> 必须修改 **$ERRORS** 处，请人工确认 **$WARNINGS** 处。改完把文章里的 \`\"verified\": false\` 改成 \`true\`，页面才会显示「已核对」。"
    echo
    cat "data/reports/$SLUG.md"
  } > /tmp/pr-body.md

  gh label create "$LABEL" --force >/dev/null 2>&1 || true
  gh pr create --base "$BASE" --head "$BR" --title "稿件：$TITLE" --body-file /tmp/pr-body.md --label "$LABEL" \
    || gh pr create --base "$BASE" --head "$BR" --title "稿件：$TITLE" --body-file /tmp/pr-body.md
  git switch "$BASE"
done
