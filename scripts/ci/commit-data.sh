#!/usr/bin/env bash
# 提交并推送 data/ 目录（它是 data 分支的检出）。Actions 和 Grok Bot 共用。
# 用法：bash scripts/ci/commit-data.sh "提交说明"
set -euo pipefail
MSG="${1:-data: 更新}"
BR="${WG_DATA_BRANCH:-data}"
cd "$(dirname "$0")/../../data"
TOP="$(git rev-parse --show-toplevel 2>/dev/null || true)"
HEADREF="$(git rev-parse --abbrev-ref HEAD 2>/dev/null || true)"
if [ "$TOP" != "$(pwd -P)" ]; then echo "data/ 不是 $BR 分支的单独检出，拒绝提交（见 AGENTS.md「准备」）"; exit 1; fi
if [ "$HEADREF" != "$BR" ] && [ "$HEADREF" != "HEAD" ]; then echo "data/ 检出的是 $HEADREF，不是 $BR，拒绝提交"; exit 1; fi
git config user.name  >/dev/null || git config user.name  "lyra-jade-bot"
git config user.email >/dev/null || git config user.email "lyra-jade-bot@users.noreply.github.com"
git add -A
if git diff --cached --quiet; then echo "data 没有变化"; exit 0; fi
git commit -qm "$MSG"
for i in 1 2 3; do
  if git pull --rebase -q origin "$BR" && git push -q origin "HEAD:$BR"; then echo "已推送 $BR 分支"; exit 0; fi
  sleep $((i * 5))
done
echo "推送 $BR 分支失败"; exit 1
