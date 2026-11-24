#!/usr/bin/env bash
# 把 translate.mjs 新翻好的英文版开成一个 PR（一次运行一个 PR，里面可以有多篇）。
# 直接上线模式（仓库变量 WG_AUTOMERGE=direct）下打上 auto-publish，「自动合并」工作流检查后合并发布。
# 用法：bash scripts/open-translation-pr.sh <new-translations.json>   需要 gh 和 GH_TOKEN
set -euo pipefail

LIST=${1:-data/new-translations.json}
[ -s "$LIST" ] || { echo "没有新译文"; exit 0; }
COUNT=$(node -e 'console.log(JSON.parse(require("fs").readFileSync(process.argv[1],"utf8")).length)' "$LIST")
[ "$COUNT" -gt 0 ] || { echo "没有新译文"; exit 0; }

git config user.name  "lyra-jade-bot"
git config user.email "lyra-jade-bot@users.noreply.github.com"
BASE=$(git rev-parse --abbrev-ref HEAD)
BR="translate/$(date -u +%Y%m%d-%H%M%S)"
REPO="${GITHUB_REPOSITORY:-$(gh repo view --json nameWithOwner --jq .nameWithOwner)}"

git switch -c "$BR"
node -e 'for (const d of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))) console.log(d.file)' "$LIST" | xargs git add --
git commit -m "translate: $COUNT 篇英文版"
git push -u origin "$BR"

{
  echo "> 自动翻译的英文版（DeepSeek：翻译改写 + 母语编辑润色，每个数字都已和中文版核对）。合并即发布；关闭即放弃。"
  echo
  echo "| 中文 | English |"
  echo "| --- | --- |"
  node -e 'for (const d of JSON.parse(require("fs").readFileSync(process.argv[1], "utf8"))) console.log(`| ${d.zh.replace(/\|/g, "\\|")} | ${d.title.replace(/\|/g, "\\|")} |`)' "$LIST"
} > /tmp/tr-body.md

PR_URL=$(gh pr create --base "$BASE" --head "$BR" --title "英文版：$COUNT 篇" --body-file /tmp/tr-body.md)
echo "$PR_URL"
NUM="${PR_URL##*/}"

# 和写稿一样：直接上线模式打 auto-publish（用 REST 接口，机器人的 classic 令牌走 GraphQL 会失败）
MODE=$(gh api "repos/$REPO/actions/variables/WG_AUTOMERGE" --jq .value 2>/dev/null || true)
gh label create 英文版 --color 1D76DB --description "自动翻译的英文版" --force >/dev/null 2>&1 || true
gh api "repos/$REPO/issues/$NUM/labels" -f "labels[]=英文版" >/dev/null || true
if [ "$MODE" = "direct" ]; then
  gh label create auto-publish --color 0E8A16 --description "校验通过，自动上线" --force >/dev/null 2>&1 || true
  gh api "repos/$REPO/issues/$NUM/labels" -f "labels[]=auto-publish" >/dev/null || echo "::warning::没能打上 auto-publish 标签，这个 PR 需要人工合并"
fi
git switch "$BASE"
